from django.shortcuts import render, redirect
from django.contrib.auth import login
from django.contrib.auth.decorators import login_required
from .forms import CompanyRegistrationForm, CompanyProfileForm
from .models import CompanyProfile

def register(request):
    if request.method == 'POST':
        form = CompanyRegistrationForm(request.POST)
        if form.is_valid():
            user = form.save()
            login(request, user)
            return redirect('dashboard')
    else:
        form = CompanyRegistrationForm()
    return render(request, 'accounts/register.html', {'form': form})

@login_required
def profile_setup(request):
    try:
        profile = request.user.profile
    except CompanyProfile.DoesNotExist:
        profile = None
    
    if request.method == 'POST':
        form = CompanyProfileForm(request.POST, request.FILES, instance=profile)
        if form.is_valid():
            profile = form.save(commit=False)
            profile.user = request.user
            profile.save()
            return redirect('dashboard')
    else:
        form = CompanyProfileForm(instance=profile)
    
    return render(request, 'accounts/profile_setup.html', {'form': form})

@login_required
def dashboard(request):
    # Calculate stats for dashboard
    # Fix L-7: single query — evaluate once, derive both values from the same list.
    completed_attempts = list(request.user.attempts.filter(is_completed=True).order_by('-completed_at'))
    completed_count = len(completed_attempts)
    last_attempt    = completed_attempts[0] if completed_attempts else None
    last_score = last_attempt.total_score if last_attempt else 0
    
    # Get latest ESG scores if available
    esg_scores = None
    if last_attempt:
        esg_scores = {
            'environmental': last_attempt.environmental_score,
            'social': last_attempt.social_score,
            'governance': last_attempt.governance_score,
            'total': last_attempt.total_score,
            'grade': last_attempt.overall_grade
        }
    
    # Get reports count
    from reports.models import Report
    reports_count = Report.objects.filter(attempt__user=request.user).count()
    
    context = {
        'completed_count': completed_count,
        'last_score': last_score,
        'esg_scores': esg_scores,
        'reports_count': reports_count,
        'last_attempt': last_attempt,
    }
    return render(request, 'accounts/dashboard.html', context)
