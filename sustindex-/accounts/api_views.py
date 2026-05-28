import logging
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny, IsAdminUser
from rest_framework.exceptions import PermissionDenied
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.mail import send_mail
from django.conf import settings
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str

logger = logging.getLogger(__name__)

# Fields a user is allowed to edit through update_me — explicit whitelist prevents
# membership_type, is_staff, is_superuser and other sensitive fields from being changed.
_USER_EDITABLE_FIELDS = {'first_name', 'last_name', 'email', 'company_name', 'phone'}
from .models import CompanyProfile, MembershipHistory
from .serializers import (
    UserSerializer, UserRegistrationSerializer,
    CompanyProfileSerializer, MembershipHistorySerializer
)
from .throttles import RegisterRateThrottle

User = get_user_model()


class UserViewSet(viewsets.ModelViewSet):
    # M2: .none() prevents full-table exposure during schema generation /
    # router introspection — actual data is served by get_queryset().
    queryset = User.objects.none()
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    # Fix R (Round 4): non-staff users must not be able to create users via
    # POST /api/users/ (registration goes through the `register` action), and
    # must not be able to delete their own account silently.
    # Staff retains full CRUD access.
    def get_queryset(self):
        if self.request.user.is_staff:
            return User.objects.all().prefetch_related('profile')   # Fix N
        return User.objects.filter(id=self.request.user.id)

    def create(self, request, *args, **kwargs):
        # Fix R: block direct POST /api/users/ for non-staff.
        if not request.user.is_staff:
            raise PermissionDenied('Use /api/users/register/ to create an account.')
        # Fix #30: use UserRegistrationSerializer for proper validation + password hashing.
        serializer = UserRegistrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)

    def destroy(self, request, *args, **kwargs):
        # Fix R: disallow account self-deletion via the API.
        if not request.user.is_staff:
            raise PermissionDenied('Account deletion is not permitted via the API.')
        return super().destroy(request, *args, **kwargs)

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def me(self, request):
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)

    @action(detail=False, methods=['patch'], permission_classes=[IsAuthenticated],
            url_path='update_me')
    def update_me(self, request):
        """Partially update the authenticated user's own profile.

        Only fields in _USER_EDITABLE_FIELDS are accepted — this prevents a user from
        elevating their membership_type, is_staff, or is_superuser via this endpoint.
        """
        data = {k: v for k, v in request.data.items() if k in _USER_EDITABLE_FIELDS}
        serializer = self.get_serializer(request.user, data=data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated],
            url_path='change_password')
    def change_password(self, request):
        """Change the authenticated user's password (requires current password)."""
        old_password = request.data.get('old_password', '').strip()
        new_password = request.data.get('new_password', '').strip()

        if not old_password or not new_password:
            return Response(
                {'detail': 'Both old_password and new_password are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not request.user.check_password(old_password):
            return Response(
                {'detail': 'Current password is incorrect.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            validate_password(new_password, request.user)
        except DjangoValidationError as exc:
            return Response(
                {'detail': list(exc.messages)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        request.user.set_password(new_password)
        request.user.save(update_fields=['password'])
        return Response({'detail': 'Password changed successfully.'})

    @action(detail=False, methods=['post'], permission_classes=[AllowAny])
    def forgot_password(self, request):
        """
        Step 1 of password reset.
        Send a reset link to the user's email address.

        Always returns HTTP 200 — even when the email is not found — to prevent
        user-enumeration attacks.  The actual email is only sent when a matching
        account exists.
        """
        email = (request.data.get('email') or '').strip().lower()
        if email:
            try:
                user = User.objects.get(email__iexact=email)
            except User.DoesNotExist:
                pass  # Intentional: never reveal whether the email exists
            else:
                uid   = urlsafe_base64_encode(force_bytes(user.pk))
                token = default_token_generator.make_token(user)
                frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
                reset_link   = f'{frontend_url}/reset-password?uid={uid}&token={token}'

                try:
                    send_mail(
                        subject='Reset your Sustindex password',
                        message=(
                            f'Hello {user.username},\n\n'
                            f'Click the link below to set a new password.\n'
                            f'This link is valid for 3 days.\n\n'
                            f'{reset_link}\n\n'
                            f'If you did not request this, you can safely ignore this email.'
                        ),
                        from_email=settings.DEFAULT_FROM_EMAIL,
                        recipient_list=[user.email],
                        fail_silently=False,
                    )
                except Exception:
                    # Fix #33: escalate to error so it reaches alerting tools (Sentry etc).
                    # HTTP response stays 200 to prevent user enumeration.
                    logger.error(
                        'forgot_password: failed to send reset email to uid=%s', user.pk,
                        exc_info=True,
                    )

        return Response({'detail': 'If that email is registered, a reset link has been sent.'})

    @action(detail=False, methods=['post'], permission_classes=[AllowAny])
    def reset_password(self, request):
        """
        Step 2 of password reset.
        Validate the uid + token from the email link, then set the new password.
        """
        uid          = (request.data.get('uid')          or '').strip()
        token        = (request.data.get('token')        or '').strip()
        new_password = (request.data.get('new_password') or '').strip()

        if not uid or not token or not new_password:
            return Response(
                {'detail': 'uid, token and new_password are all required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Decode uid → user pk
        try:
            pk   = force_str(urlsafe_base64_decode(uid))
            user = User.objects.get(pk=pk)
        except (User.DoesNotExist, ValueError, TypeError, OverflowError):
            return Response(
                {'detail': 'Reset link is invalid or has expired.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate the token (time-limited, single-use after password change)
        if not default_token_generator.check_token(user, token):
            return Response(
                {'detail': 'Reset link is invalid or has expired.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate the new password against Django's AUTH_PASSWORD_VALIDATORS
        try:
            validate_password(new_password, user)
        except DjangoValidationError as exc:
            return Response(
                {'detail': list(exc.messages)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(new_password)
        user.save(update_fields=['password'])
        return Response({'detail': 'Password has been reset successfully.'})

    @action(detail=False, methods=['post'], permission_classes=[AllowAny],
            throttle_classes=[RegisterRateThrottle])
    def register(self, request):
        serializer = UserRegistrationSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            refresh = RefreshToken.for_user(user)
            return Response({
                'user': UserSerializer(user).data,
                'access': str(refresh.access_token),
                'refresh': str(refresh),
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class CompanyProfileViewSet(viewsets.ModelViewSet):
    # M2: .none() prevents full-table exposure during schema generation.
    queryset = CompanyProfile.objects.none()
    serializer_class = CompanyProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if self.request.user.is_staff:
            return CompanyProfile.objects.select_related('user').all()   # Fix N
        return CompanyProfile.objects.select_related('user').filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class MembershipHistoryViewSet(viewsets.ReadOnlyModelViewSet):
    # M2: .none() prevents full-table exposure during schema generation.
    queryset = MembershipHistory.objects.none()
    serializer_class = MembershipHistorySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if self.request.user.is_staff:
            return MembershipHistory.objects.select_related('user').all()   # Fix N
        return MembershipHistory.objects.select_related('user').filter(user=self.request.user)
