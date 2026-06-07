"""
Custom DRF throttle scopes for sensitive authentication endpoints.

Rates are configured in settings.py under REST_FRAMEWORK['DEFAULT_THROTTLE_RATES']:
    'login'    → strict per-IP limit on POST /api/v1/auth/token/
    'register' → strict per-IP limit on POST /api/v1/users/register/
"""
from rest_framework.throttling import AnonRateThrottle


class LoginRateThrottle(AnonRateThrottle):
    """
    Max 5 login attempts per minute per IP.
    Prevents credential-stuffing and brute-force attacks.
    """
    scope = 'login'


class RegisterRateThrottle(AnonRateThrottle):
    """
    Max 5 registration attempts per hour per IP.
    Prevents bulk account creation / spam.
    """
    scope = 'register'


class PasswordResetThrottle(AnonRateThrottle):
    """
    Fix R4-C-01: max 5 password-reset requests per hour per IP.
    Applied to both forgot_password and reset_password endpoints to prevent
    email enumeration via timing, link flooding, and brute-force token guessing.
    """
    scope = 'password_reset'
