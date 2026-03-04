from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from accounts.api_views import UserViewSet, CompanyProfileViewSet, MembershipHistoryViewSet
from questionnaire.api_views import (
    SurveyViewSet, SurveySessionViewSet, CategoryViewSet,
    QuestionViewSet, QuestionnaireAttemptViewSet, AnswerViewSet, UserDocumentViewSet
)
from elearning.api_views import CourseViewSet, LessonViewSet, LessonProgressViewSet

router = DefaultRouter()

router.register(r'users', UserViewSet, basename='user')
router.register(r'company-profiles', CompanyProfileViewSet, basename='companyprofile')
router.register(r'membership-history', MembershipHistoryViewSet, basename='membershiphistory')

router.register(r'surveys', SurveyViewSet, basename='survey')
router.register(r'survey-sessions', SurveySessionViewSet, basename='surveysession')
router.register(r'categories', CategoryViewSet, basename='category')
router.register(r'questions', QuestionViewSet, basename='question')
router.register(r'attempts', QuestionnaireAttemptViewSet, basename='attempt')
router.register(r'answers', AnswerViewSet, basename='answer')
router.register(r'documents', UserDocumentViewSet, basename='document')

router.register(r'courses', CourseViewSet, basename='course')
router.register(r'lessons', LessonViewSet, basename='lesson')
router.register(r'lesson-progress', LessonProgressViewSet, basename='lessonprogress')

urlpatterns = [
    path('auth/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    
    path('schema/', SpectacularAPIView.as_view(), name='schema'),
    path('docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    
    path('', include(router.urls)),
]
