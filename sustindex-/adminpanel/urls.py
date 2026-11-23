from django.urls import path

from . import api_views as v

urlpatterns = [
    path('overview/', v.OverviewView.as_view(), name='admin-overview'),
    path('users/', v.UserListView.as_view(), name='admin-users'),
    path('users/export/', v.UserExportView.as_view(), name='admin-users-export'),
    path('users/<int:pk>/', v.UserDetailView.as_view(), name='admin-user-detail'),
    path('assessments/', v.AssessmentListView.as_view(), name='admin-assessments'),
    path('assessments/export/', v.AssessmentExportView.as_view(), name='admin-assessments-export'),
    path('content/', v.ContentView.as_view(), name='admin-content'),
    path('surveys/<int:pk>/', v.SurveyToggleView.as_view(), name='admin-survey'),
    path('courses/<int:pk>/', v.CourseToggleView.as_view(), name='admin-course'),
]
