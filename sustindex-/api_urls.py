from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework_simplejwt.views import (
    TokenObtainPairView, TokenRefreshView, TokenBlacklistView,
)
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from accounts.api_views import UserViewSet, CompanyProfileViewSet, MembershipHistoryViewSet
from accounts.throttles import LoginRateThrottle


# Subclass so we can attach our strict login-rate throttle without modifying
# simplejwt's built-in view directly.
class ThrottledTokenObtainPairView(TokenObtainPairView):
    throttle_classes = [LoginRateThrottle]
from questionnaire.api_views import (
    SurveyViewSet, SurveySessionViewSet, CategoryViewSet,
    QuestionViewSet, QuestionnaireAttemptViewSet, AnswerViewSet, UserDocumentViewSet
)
from elearning.api_views import CourseViewSet, LessonViewSet, LessonAttachmentViewSet, LessonProgressViewSet

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
# Fix R6-03: authenticated download endpoint for lesson attachments
router.register(r'lesson-attachments', LessonAttachmentViewSet, basename='lessonattachment')
router.register(r'lesson-progress', LessonProgressViewSet, basename='lessonprogress')

urlpatterns = [
    path('auth/token/', ThrottledTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    # Security fix: lets clients blacklist a refresh token server-side on logout,
    # preventing reuse for up to REFRESH_TOKEN_LIFETIME (7 days) after the user logs out.
    path('auth/token/blacklist/', TokenBlacklistView.as_view(), name='token_blacklist'),

    # Fix R6-13: restrict schema and docs to authenticated staff only —
    # exposing the full OpenAPI schema publicly reveals all endpoints,
    # request/response shapes, and authentication mechanisms to attackers.
    path('schema/', SpectacularAPIView.as_view(permission_classes=[IsAdminUser]), name='schema'),
    path('docs/',   SpectacularSwaggerView.as_view(url_name='schema', permission_classes=[IsAdminUser]), name='swagger-ui'),

    path('', include(router.urls)),
]
