"""Temporary (session-scoped) JWT sessions with an ABSOLUTE maximum lifetime.

Every refresh token carries a ``session_start`` claim, written once when the user authenticates
(password login, Google login, Google account linking, registration). It is never changed afterwards.

* The refresh token expires ``SESSION_MAX_LIFETIME`` (12 h) after login; it is NOT extended by use.
* Refreshing is refused once ``session_start + SESSION_MAX_LIFETIME`` has passed, and a refreshed access
  token never outlives that deadline, so the whole session is capped at 12 h in total.
* Refresh tokens are not rotated. Rotation re-issues a token with a brand-new lifetime (a sliding window),
  which would defeat an absolute cap, and it breaks when several tabs of one browser session share the token.
  The refresh token is still blacklisted on logout (``/auth/token/blacklist/``).
* Refresh tokens that carry no ``session_start`` (issued before this policy existed) are refused,
  which forces one fresh login after deployment.
"""
import time
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework_simplejwt.exceptions import InvalidToken
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.tokens import RefreshToken

SESSION_CLAIM = 'session_start'


def session_max_seconds() -> int:
    return int(settings.SESSION_MAX_LIFETIME.total_seconds())


def issue_session_tokens(user) -> RefreshToken:
    """Refresh token for a fresh login (its ``.access_token`` is the matching access token)."""
    refresh = RefreshToken.for_user(user)
    refresh[SESSION_CLAIM] = int(time.time())
    return refresh


class SessionTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Password login: same response as SimpleJWT, plus the session start claim."""

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token[SESSION_CLAIM] = int(time.time())
        return token


class SessionTokenRefreshSerializer(serializers.Serializer):
    refresh = serializers.CharField()
    access = serializers.CharField(read_only=True)

    def validate(self, attrs):
        refresh = RefreshToken(attrs['refresh'])          # signature, exp and blacklist checks
        start = refresh.get(SESSION_CLAIM)
        if not isinstance(start, int):
            raise InvalidToken('Session is not valid any more; please sign in again.')
        deadline = start + session_max_seconds()
        now = int(time.time())
        if now >= deadline:
            raise InvalidToken('Session expired; please sign in again.')

        # A deactivated account must not be able to keep minting access tokens.
        user_id = refresh.get(api_settings.USER_ID_CLAIM)
        user = get_user_model().objects.filter(**{api_settings.USER_ID_FIELD: user_id}).first()
        if user is None or not user.is_active:
            raise InvalidToken('Session is not valid any more; please sign in again.')

        access = refresh.access_token
        remaining = deadline - now
        access.set_exp(lifetime=min(api_settings.ACCESS_TOKEN_LIFETIME, timedelta(seconds=remaining)))
        return {'access': str(access)}
