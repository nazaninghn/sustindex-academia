from django.db import models
from django.conf import settings
from ckeditor.fields import RichTextField
from django.utils.translation import gettext_lazy as _
from django.utils import timezone


class Survey(models.Model):
    """
    Different sustainability assessment surveys
    Each survey can have multiple sessions
    """
    name = models.CharField(max_length=200, verbose_name=_('Survey Name'))
    name_tr = models.CharField(max_length=200, blank=True, verbose_name=_('Survey Name (Turkish)'))
    name_en = models.CharField(max_length=200, blank=True, verbose_name=_('Survey Name (English)'))
    description = models.TextField(blank=True, verbose_name=_('Description'))
    description_tr = models.TextField(blank=True, verbose_name=_('Description (Turkish)'))
    description_en = models.TextField(blank=True, verbose_name=_('Description (English)'))
    is_active = models.BooleanField(default=True, verbose_name=_('Active'))
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('Created At'))
    updated_at = models.DateTimeField(auto_now=True, verbose_name=_('Updated At'))
    
    allow_multiple_attempts = models.BooleanField(default=False, verbose_name=_('Allow Multiple Attempts'))
    show_results_immediately = models.BooleanField(default=True, verbose_name=_('Show Results Immediately'))
    
    class Meta:
        verbose_name = _('Survey')
        verbose_name_plural = _('Surveys')
        ordering = ['-created_at']
    
    def __str__(self):
        return self.name
    
    def get_total_questions(self):
        """Get total number of active questions in this survey"""
        return self.questions.filter(is_active=True).count()
    
    def get_active_sessions(self):
        """Get active sessions for this survey"""
        return self.sessions.filter(is_active=True)


class SurveySession(models.Model):
    """Assessment sessions with specific time periods"""
    survey = models.ForeignKey(Survey, on_delete=models.CASCADE, related_name='sessions', verbose_name=_('Survey'), null=True, blank=True)
    name = models.CharField(max_length=200, verbose_name=_('Session Name'))
    description = models.TextField(blank=True, verbose_name=_('Description'))
    start_date = models.DateTimeField(verbose_name=_('Start Date'))
    end_date = models.DateTimeField(verbose_name=_('End Date'))
    is_active = models.BooleanField(default=True, verbose_name=_('Active'))
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('Created At'))
    
    class Meta:
        verbose_name = _('Survey Session')
        verbose_name_plural = _('Survey Sessions')
        ordering = ['-start_date']
    
    def __str__(self):
        survey_name = self.survey.name if self.survey else 'No Survey'
        return f"{survey_name} - {self.name}"
    
    def is_open(self):
        """Check if session is currently open"""
        now = timezone.now()
        return self.is_active and self.start_date <= now <= self.end_date
    
    def get_status(self):
        """Get session status"""
        now = timezone.now()
        if not self.is_active:
            return 'inactive'
        elif now < self.start_date:
            return 'upcoming'
        elif now > self.end_date:
            return 'closed'
        else:
            return 'open'
    
    def get_status_display(self):
        """Get human-readable status"""
        status = self.get_status()
        status_map = {
            'inactive': _('Inactive'),
            'upcoming': _('Upcoming'),
            'closed': _('Closed'),
            'open': _('Open')
        }
        return status_map.get(status, _('Unknown'))


class Category(models.Model):
    """Question categories for organizing questionnaire"""
    name = models.CharField(max_length=200, verbose_name=_('Name'))
    name_tr = models.CharField(max_length=200, blank=True, verbose_name=_('Name (Turkish)'))
    name_en = models.CharField(max_length=200, blank=True, verbose_name=_('Name (English)'))
    description = models.TextField(blank=True, verbose_name=_('Description'))
    description_tr = models.TextField(blank=True, verbose_name=_('Description (Turkish)'))
    description_en = models.TextField(blank=True, verbose_name=_('Description (English)'))
    order = models.IntegerField(default=0, verbose_name=_('Display Order'))
    environmental_weight = models.FloatField(default=0.0, verbose_name=_('Environmental Weight'))
    social_weight = models.FloatField(default=0.0, verbose_name=_('Social Weight'))
    governance_weight = models.FloatField(default=0.0, verbose_name=_('Governance Weight'))
    max_score = models.IntegerField(default=100, verbose_name=_('Maximum Score'))
    
    class Meta:
        verbose_name = _('Category')
        verbose_name_plural = _('Categories')
        ordering = ['order', 'name']
    
    def __str__(self):
        return self.name
    
    def get_category_score(self, attempt):
        """Calculate category score for an attempt"""
        questions = self.questions.filter(is_active=True)
        if not questions.exists():
            return 0
        
        total_score = 0
        total_possible = 0
        
        for question in questions:
            answer = attempt.answers.filter(question=question).first()
            if answer:
                total_score += answer.get_total_score()
                max_choice_score = question.choices.aggregate(models.Max('score'))['score__max'] or 0
                total_possible += max_choice_score
        
        if total_possible == 0:
            return 0
        
        percentage = (total_score / total_possible) * 100
        return min(percentage, self.max_score)


class Question(models.Model):
    """Questionnaire questions"""
    survey = models.ForeignKey(Survey, on_delete=models.CASCADE, related_name='questions', verbose_name=_('Survey'), null=True, blank=True)
    category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name='questions', verbose_name=_('Category'))
    text = RichTextField(verbose_name=_('Question Text'))
    text_tr = RichTextField(blank=True, verbose_name=_('Question Text (Turkish)'))
    text_en = RichTextField(blank=True, verbose_name=_('Question Text (English)'))
    order = models.IntegerField(default=0, verbose_name=_('Display Order'))
    is_active = models.BooleanField(default=True, verbose_name=_('Active'))
    allow_multiple = models.BooleanField(default=False, verbose_name=_('Allow Multiple Choices'), help_text=_('Allow users to select multiple answers'))
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('Created At'))
    attachment = models.FileField(upload_to='question_attachments/', blank=True, verbose_name=_('Question Attachment'))
    
    class Meta:
        verbose_name = _('Question')
        verbose_name_plural = _('Questions')
        ordering = ['survey', 'category', 'order']
    
    def __str__(self):
        survey_name = self.survey.name if self.survey else 'No Survey'
        return f"{survey_name} - {self.category.name} - Q{self.order}"


class Choice(models.Model):
    """Answer choices for each question"""
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name='choices', verbose_name=_('Question'))
    text = models.CharField(max_length=500, verbose_name=_('Choice Text'))
    text_tr = models.CharField(max_length=500, blank=True, verbose_name=_('Choice Text (Turkish)'))
    text_en = models.CharField(max_length=500, blank=True, verbose_name=_('Choice Text (English)'))
    score = models.IntegerField(default=0, verbose_name=_('Score'))
    order = models.IntegerField(default=0, verbose_name=_('Display Order'))
    
    class Meta:
        verbose_name = _('Choice')
        verbose_name_plural = _('Choices')
        ordering = ['order']
    
    def __str__(self):
        return f"{self.text} (Score: {self.score})"


class QuestionnaireAttempt(models.Model):
    """User attempts to complete questionnaire"""
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='attempts', verbose_name=_('User'))
    survey = models.ForeignKey(Survey, on_delete=models.CASCADE, related_name='attempts', verbose_name=_('Survey'), null=True, blank=True)
    session = models.ForeignKey(SurveySession, on_delete=models.SET_NULL, null=True, blank=True, related_name='attempts', verbose_name=_('Survey Session'))
    started_at = models.DateTimeField(auto_now_add=True, verbose_name=_('Started At'))
    completed_at = models.DateTimeField(null=True, blank=True, verbose_name=_('Completed At'))
    is_completed = models.BooleanField(default=False, verbose_name=_('Completed'))
    total_score = models.IntegerField(default=0, verbose_name=_('Total Score'))
    
    environmental_score = models.FloatField(default=0.0, verbose_name=_('Environmental Score'))
    social_score = models.FloatField(default=0.0, verbose_name=_('Social Score'))
    governance_score = models.FloatField(default=0.0, verbose_name=_('Governance Score'))
    overall_grade = models.CharField(max_length=2, blank=True, verbose_name=_('Overall Grade'))
    
    class Meta:
        verbose_name = _('Questionnaire Attempt')
        verbose_name_plural = _('Questionnaire Attempts')
        ordering = ['-started_at']
    
    def __str__(self):
        survey_name = self.survey.name if self.survey else 'No Survey'
        return f"{self.user.username} - {survey_name} - {self.started_at.strftime('%Y-%m-%d')}"
    
    def calculate_score(self):
        """Calculate total score from all answers"""
        total = sum(answer.choice.score for answer in self.answers.all())
        self.total_score = total
        self.save()
        return total
    
    def calculate_scores(self):
        """Calculate separate scores"""
        categories = Category.objects.all()
        
        env_score = 0
        social_score = 0
        gov_score = 0
        
        for category in categories:
            category_score = category.get_category_score(self)
            
            env_score += category_score * category.environmental_weight
            social_score += category_score * category.social_weight  
            gov_score += category_score * category.governance_weight
        
        self.environmental_score = round(env_score, 2)
        self.social_score = round(social_score, 2)
        self.governance_score = round(gov_score, 2)
        
        total = (self.environmental_score + self.social_score + self.governance_score) / 3
        self.total_score = round(total, 2)
        
        self.overall_grade = self.get_overall_grade()
        
        self.save()
        return {
            'environmental': self.environmental_score,
            'social': self.social_score,
            'governance': self.governance_score,
            'total': self.total_score,
            'grade': self.overall_grade
        }
    
    def get_overall_grade(self):
        """Determine grade based on total score"""
        if self.total_score >= 80:
            return 'A+'
        elif self.total_score >= 70:
            return 'A'
        elif self.total_score >= 60:
            return 'B+'
        elif self.total_score >= 50:
            return 'B'
        elif self.total_score >= 40:
            return 'C+'
        elif self.total_score >= 30:
            return 'C'
        else:
            return 'D'
    
    def get_recommendations(self):
        """Provide recommendations based on scores"""
        recommendations = []
        
        if self.environmental_score < 50:
            recommendations.append({
                'category': 'Environmental',
                'priority': 'High',
                'suggestion': 'Focus on waste management and renewable energy adoption'
            })
        
        if self.social_score < 50:
            recommendations.append({
                'category': 'Social',
                'priority': 'High', 
                'suggestion': 'Improve employee training and diversity programs'
            })
        
        if self.governance_score < 50:
            recommendations.append({
                'category': 'Governance',
                'priority': 'High',
                'suggestion': 'Strengthen board independence and transparency reporting'
            })
        
        return recommendations


class Answer(models.Model):
    """User answers to questions"""
    attempt = models.ForeignKey(QuestionnaireAttempt, on_delete=models.CASCADE, related_name='answers', verbose_name=_('Attempt'))
    question = models.ForeignKey(Question, on_delete=models.CASCADE, verbose_name=_('Question'))
    choice = models.ForeignKey(Choice, on_delete=models.CASCADE, null=True, blank=True, verbose_name=_('Selected Choice (Single)'))
    choices = models.ManyToManyField(Choice, related_name='answers_multiple', blank=True, verbose_name=_('Selected Choices (Multiple)'))
    notes = models.TextField(blank=True, null=True, verbose_name=_('Notes/Comments'), help_text=_('Additional notes or comments for this answer'))
    answered_at = models.DateTimeField(auto_now_add=True, verbose_name=_('Answered At'))
    
    class Meta:
        verbose_name = _('Answer')
        verbose_name_plural = _('Answers')
        unique_together = ['attempt', 'question']
    
    def __str__(self):
        return f"{self.attempt.user.username} - {self.question}"
    
    def get_total_score(self):
        """Calculate total score for this answer"""
        if not self.choice and not self.choices.exists():
            return 0
        
        if self.question.allow_multiple:
            return sum(choice.score for choice in self.choices.all())
        else:
            return self.choice.score if self.choice else 0
    
    def is_cannot_answer(self):
        """Check if user selected 'cannot answer'"""
        return not self.choice and not self.choices.exists()
    
    def get_selected_choices_display(self):
        """Display selected choices"""
        if self.is_cannot_answer():
            return "Cannot answer"
        
        if self.question.allow_multiple:
            return ", ".join([choice.text for choice in self.choices.all()])
        else:
            return self.choice.text if self.choice else "-"



class UserDocument(models.Model):
    """User uploaded documents for questions"""
    answer = models.ForeignKey(Answer, on_delete=models.CASCADE, related_name='documents', verbose_name=_('Answer'))
    title = models.CharField(max_length=200, verbose_name=_('Document Title'))
    description = models.TextField(blank=True, verbose_name=_('Description'))
    file = models.FileField(upload_to='user_documents/', verbose_name=_('Document File'))
    uploaded_at = models.DateTimeField(auto_now_add=True, verbose_name=_('Uploaded At'))
    file_size = models.IntegerField(default=0, verbose_name=_('File Size (bytes)'))

    class Meta:
        verbose_name = _('User Document')
        verbose_name_plural = _('User Documents')
        ordering = ['-uploaded_at']

    def __str__(self):
        return f"{self.answer.attempt.user.username} - {self.title}"

    def get_file_size_display(self):
        """Return human readable file size"""
        if self.file_size < 1024:
            return f"{self.file_size} B"
        elif self.file_size < 1024 * 1024:
            return f"{self.file_size // 1024} KB"
        else:
            return f"{self.file_size // (1024 * 1024)} MB"


