from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils.translation import gettext_lazy as _


class User(AbstractUser):
    """Custom User Model with membership tiers"""
    MEMBERSHIP_CHOICES = [
        ('free', _('Free')),
        ('silver', _('Silver')),
        ('gold', _('Gold')),
    ]
    
    membership_type = models.CharField(
        max_length=10,
        choices=MEMBERSHIP_CHOICES,
        default='free',
        verbose_name=_('Membership Type')
    )
    company_name = models.CharField(max_length=200, blank=True, verbose_name=_('Company Name'))
    phone = models.CharField(max_length=20, blank=True, verbose_name=_('Phone'))
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('Registration Date'))
    
    class Meta:
        verbose_name = _('User')
        verbose_name_plural = _('Users')
    
    def __str__(self):
        return f"{self.username} - {self.get_membership_type_display()}"


class CompanyProfile(models.Model):
    """Company profile with additional information"""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile', verbose_name=_('User'))
    company_name = models.CharField(max_length=200, verbose_name=_('Company Name'))
    registration_number = models.CharField(max_length=50, blank=True, verbose_name=_('Registration Number'))
    address = models.TextField(blank=True, verbose_name=_('Address'))
    website = models.URLField(blank=True, verbose_name=_('Website'))
    industry = models.CharField(max_length=100, blank=True, verbose_name=_('Industry'))
    employee_count = models.IntegerField(null=True, blank=True, verbose_name=_('Employee Count'))
    logo = models.ImageField(upload_to='company_logos/', blank=True, verbose_name=_('Logo'))
    additional_data = models.JSONField(default=dict, blank=True, verbose_name=_('Additional Data'))
    
    class Meta:
        verbose_name = _('Company Profile')
        verbose_name_plural = _('Company Profiles')
    
    def __str__(self):
        return self.company_name


class MembershipHistory(models.Model):
    """Membership history tracking"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='membership_history', verbose_name=_('User'))
    membership_type = models.CharField(max_length=10, verbose_name=_('Membership Type'))
    start_date = models.DateTimeField(auto_now_add=True, verbose_name=_('Start Date'))
    end_date = models.DateTimeField(null=True, blank=True, verbose_name=_('End Date'))
    is_active = models.BooleanField(default=True, verbose_name=_('Active'))
    
    class Meta:
        verbose_name = _('Membership History')
        verbose_name_plural = _('Membership Histories')
        ordering = ['-start_date']
    
    def __str__(self):
        # Fix R13-01: self.user.username fires a SELECT per admin row (FK lazy-load).
        # Use local fields only — zero extra DB queries.
        return f"Membership #{self.pk} ({self.membership_type})"
