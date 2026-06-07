import logging

from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth.decorators import login_required
from django.db import transaction
from django.http import JsonResponse, HttpResponse
from django.utils import timezone
from django.template.loader import render_to_string
from questionnaire.models import QuestionnaireAttempt
from .models import Report, ReportSection
import json

logger = logging.getLogger(__name__)

@login_required
def generate_report(request, attempt_id):
    """Generate report for an attempt"""
    attempt = get_object_or_404(QuestionnaireAttempt, id=attempt_id, user=request.user)
    
    if not attempt.is_completed:
        return JsonResponse({'error': 'Questionnaire not completed'}, status=400)

    # Fix BC: was attempt.calculate_esg_scores() — method does not exist.
    # calculate_scores() is the correct name; it saves sub-scores and returns the dict.
    # Fix CRIT-03: pass save=False so we don't overwrite the frozen scores on a
    # completed attempt.  The report is generated from the fresh calculation but
    # the stored score record (which was locked at completion time) is preserved.
    scores = attempt.calculate_scores(save=False)
    esg_scores = {
        'total':         scores['total_percentage'],
        'grade':         scores['grade'],
        'environmental': attempt.environmental_score or 0,
        'social':        attempt.social_score or 0,
        'governance':    attempt.governance_score or 0,
        'categories':    scores['categories'],
    }

    with transaction.atomic():
        report, created = Report.objects.get_or_create(
            attempt=attempt,
            defaults={'generated_at': timezone.now()}
        )

        report.sections.all().delete()

        create_report_sections(report, attempt, esg_scores)

    return redirect('view_report', report_id=report.id)

@login_required
def view_report(request, report_id):
    """View report"""
    # Fix R11-01: select_related('attempt__user') so report.attempt.xxx accesses
    # below read from the pre-fetched JOIN row instead of issuing lazy-load queries.
    report = get_object_or_404(
        Report.objects.select_related('attempt__user'),
        id=report_id, attempt__user=request.user,
    )
    
    context = {
        'report': report,
        'attempt': report.attempt,
        'esg_scores': {
            'environmental': report.attempt.environmental_score,
            'social': report.attempt.social_score,
            'governance': report.attempt.governance_score,
            'total': report.attempt.total_score,
            'grade': report.attempt.overall_grade
        },
        'recommendations': report.attempt.get_recommendations(),
        'sections': report.sections.all()
    }
    
    return render(request, 'reports/view_report.html', context)

@login_required
def download_report_pdf(request, report_id):
    """Download report as PDF"""
    # Fix R11-01: select_related so all report.attempt.user.xxx accesses below
    # read from the pre-fetched JOIN row instead of issuing lazy-load queries.
    report = get_object_or_404(
        Report.objects.select_related('attempt__user'),
        id=report_id, attempt__user=request.user,
    )
    
    try:
        from reportlab.lib.pagesizes import letter, A4
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import inch
        from reportlab.lib import colors
        from io import BytesIO
        
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4)
        styles = getSampleStyleSheet()
        story = []
        
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=24,
            spaceAfter=30,
            textColor=colors.HexColor('#1b4332')
        )
        story.append(Paragraph("Sustainability Assessment Report", title_style))
        story.append(Spacer(1, 20))
        
        company_info = [
            ['Company:', report.attempt.user.company_name or 'N/A'],
            ['Assessment Date:', report.attempt.completed_at.strftime('%Y-%m-%d') if report.attempt.completed_at else 'N/A'],
            ['ESG Grade:', report.attempt.overall_grade],
            ['Total Score:', f"{report.attempt.total_score:.1f}/100"]
        ]
        
        company_table = Table(company_info, colWidths=[2*inch, 3*inch])
        company_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#f0f0f0')),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 12),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        story.append(company_table)
        story.append(Spacer(1, 30))
        
        esg_data = [
            ['ESG Component', 'Score', 'Grade'],
            # Fix BUG-11: environmental/social/governance are FloatField(null=True);
            # without `or 0` f-format crashes with TypeError when value is None.
            ['Environmental', f"{report.attempt.environmental_score or 0:.1f}", get_component_grade(report.attempt.environmental_score or 0)],
            ['Social',        f"{report.attempt.social_score        or 0:.1f}", get_component_grade(report.attempt.social_score        or 0)],
            ['Governance',    f"{report.attempt.governance_score    or 0:.1f}", get_component_grade(report.attempt.governance_score    or 0)],
            ['Overall ESG',   f"{report.attempt.total_score         or 0:.1f}", report.attempt.overall_grade]
        ]
        
        esg_table = Table(esg_data, colWidths=[2*inch, 1.5*inch, 1.5*inch])
        esg_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1b4332')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 12),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#e8f5e8'))
        ]))
        story.append(Paragraph("ESG Scores Breakdown", styles['Heading2']))
        story.append(Spacer(1, 12))
        story.append(esg_table)
        story.append(Spacer(1, 30))
        
        recommendations = report.attempt.get_recommendations()
        if recommendations:
            story.append(Paragraph("Recommendations for Improvement", styles['Heading2']))
            story.append(Spacer(1, 12))
            
            for i, rec in enumerate(recommendations, 1):
                story.append(Paragraph(f"{i}. {rec['category']} ({rec['priority']} Priority)", styles['Heading3']))
                story.append(Paragraph(rec['description'], styles['Normal']))
                story.append(Spacer(1, 12))
        
        doc.build(story)
        buffer.seek(0)
        
        response = HttpResponse(buffer.getvalue(), content_type='application/pdf')
        # Fix R11-02: sanitize filename — company_name could contain " or \n which
        # would break the Content-Disposition header or enable header-injection.
        safe_company = (
            (report.attempt.user.company_name or 'report')
            .replace('"', "'").replace('\n', '').replace('\r', '').replace('/', '-')
        )
        response['Content-Disposition'] = (
            f'attachment; filename="ESG_Report_{safe_company}_{report.generated_at.strftime("%Y%m%d")}.pdf"'
        )
        
        return response
        
    except ImportError:
        return JsonResponse({'error': 'PDF generation not available. Please install reportlab.'}, status=500)
    except Exception:
        logger.exception('PDF generation failed for report %s', report_id)
        return JsonResponse({'error': 'An error occurred while generating the PDF. Please try again.'}, status=500)

def create_report_sections(report, attempt, esg_scores):
    """Create report sections"""

    executive_summary = f"""
    This sustainability assessment evaluates your organization's Environmental, Social, and Governance (ESG) performance.

    Overall ESG Score: {esg_scores['total'] or 0:.1f}/100 (Grade: {esg_scores['grade']})

    • Environmental Score: {esg_scores['environmental'] or 0:.1f}/100
    • Social Score: {esg_scores['social'] or 0:.1f}/100
    • Governance Score: {esg_scores['governance'] or 0:.1f}/100

    This assessment is based on internationally recognized ESG frameworks and best practices.

    Supporting Documents: {get_total_documents_count(attempt)} files uploaded as evidence.
    """

    ReportSection.objects.create(
        report=report,
        title="Executive Summary",
        content=executive_summary,
        order=1
    )

    from questionnaire.models import Category, UserDocument

    # Fix BE: was Category.objects.all() — loaded ALL categories from every survey.
    # Now scoped to the attempt's survey (or falls back to questions' implied survey).
    if attempt.survey:
        categories = list(Category.objects.filter(
            survey=attempt.survey
        ).order_by('order'))
    else:
        categories = list(Category.objects.filter(
            questions__is_active=True
        ).distinct().order_by('order'))

    # Fix N+1: build a {category_id: percentage} lookup from the already-computed
    # category breakdown that was passed in via esg_scores['categories'], so we
    # never call category.get_category_score(attempt) (3 DB queries per category).
    score_by_cat_id = {
        c['id']: c['percentage']
        for c in (esg_scores.get('categories') or [])
    }

    # Fix N+1: batch-count documents per category in a single query instead of
    # one COUNT per category in the loop.
    from django.db.models import Count
    doc_counts_qs = (
        UserDocument.objects
        .filter(answer__attempt=attempt)
        .values('answer__question__category_id')
        .annotate(cnt=Count('id'))
    )
    doc_count_by_cat_id = {row['answer__question__category_id']: row['cnt'] for row in doc_counts_qs}

    for i, category in enumerate(categories, 2):
        # Use pre-computed score; fall back to per-category DB call only when the
        # breakdown data is unavailable (e.g. called from a non-standard code path).
        if category.id in score_by_cat_id:
            category_score = score_by_cat_id[category.id]
        else:
            category_score = category.get_category_score(attempt)

        documents_count = doc_count_by_cat_id.get(category.id, 0)

        content = f"""
        Category: {category.name}
        Score: {category_score:.1f}/100
        Supporting Documents: {documents_count} files

        {category.description}

        Performance Analysis:
        """

        if category_score >= 70:
            content += "Excellent performance in this category. Continue current practices and look for opportunities to share best practices."
        elif category_score >= 50:
            content += "Good performance with room for improvement. Focus on addressing gaps identified in the assessment."
        else:
            content += "Significant improvement needed. This should be a priority area for your sustainability initiatives."

        # Add document details if available
        if documents_count > 0:
            content += f"\n\nEvidence provided: {documents_count} supporting documents were submitted for questions in this category, demonstrating commitment to transparency and documentation."

        ReportSection.objects.create(
            report=report,
            title=f"{category.name} Analysis",
            content=content,
            order=i
        )

def get_total_documents_count(attempt):
    """Get total number of uploaded documents for an attempt"""
    from questionnaire.models import UserDocument
    return UserDocument.objects.filter(answer__attempt=attempt).count()

def get_component_grade(score):
    """Determine grade for each component"""
    if score >= 80:
        return 'A+'
    elif score >= 70:
        return 'A'
    elif score >= 60:
        return 'B+'
    elif score >= 50:
        return 'B'
    elif score >= 40:
        return 'C+'
    elif score >= 30:
        return 'C'
    else:
        return 'D'

@login_required
def reports_dashboard(request):
    """User reports dashboard"""
    # Fix HIGH-04: evaluate the queryset once so the template render and
    # .count() don't issue two separate SQL queries for the same data.
    reports_list = list(
        Report.objects
        .filter(attempt__user=request.user)
        .select_related('attempt__user', 'attempt__survey')
        .order_by('-generated_at')
    )

    context = {
        'reports':       reports_list,
        'total_reports': len(reports_list),
    }
    
    return render(request, 'reports/dashboard.html', context)
