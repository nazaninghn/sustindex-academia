"""
Google sign-in helpers (OAuth 2.0 authorization-code flow, popup / "postmessage").

The browser opens Google's consent popup and receives a one-time *authorization
code*.  Only the code is sent to our API.  This module exchanges it with Google's
token endpoint over HTTPS using the client secret (which never leaves the server)
and validates the claims of the ID token Google returns.

An ID token received directly from Google's token endpoint over TLS may be
trusted without re-verifying its signature (Google's documented guidance), so no
extra packages are required.  The issuer / audience / expiry / subject claims
are still checked explicitly, and email_verified is required before any email
is used.

ACCOUNT LINKING POLICY
----------------------
SustIndex does not verify email ownership at registration, so an email match
alone is NOT proof that a Google user owns the existing SustIndex account
(an attacker could have pre-registered the victim's address).  Therefore:

  * Google account already linked (by Google's stable `sub`)  -> sign in.
  * No link, email matches an existing account                -> NEVER authenticate
    or link automatically.  We answer "link_required" with a short-lived signed
    token; the user must prove ownership with the existing SustIndex PASSWORD
    and explicitly confirm before the link is created (`link_with_password`).
  * Administrator / staff accounts are never linked this way.
  * No link, no matching account                              -> create a new user.
"""
import base64
import json
import logging
import re
import time
import urllib.error
import urllib.parse
import urllib.request

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core import signing
from django.db import IntegrityError, transaction

from .models import GoogleIdentity

logger = logging.getLogger(__name__)
User = get_user_model()

TOKEN_URL = 'https://oauth2.googleapis.com/token'
VALID_ISSUERS = ('https://accounts.google.com', 'accounts.google.com')
LINK_SALT = 'sustindex.google-link.v1'
LINK_TOKEN_TTL = 10 * 60          # seconds the user has to enter their password
CLOCK_SKEW = 60                   # tolerated seconds for `iat` in the future


class GoogleAuthError(Exception):
    """Raised for any failure; `code` is a stable machine-readable string for the UI.
    Messages are deliberately generic: no tokens, secrets or Google error bodies."""
    def __init__(self, code, message, http_status=400, extra=None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.http_status = http_status
        self.extra = extra or {}


def is_configured():
    return bool(settings.GOOGLE_OAUTH_CLIENT_ID and settings.GOOGLE_OAUTH_CLIENT_SECRET)


def _decode_jwt_payload(id_token):
    try:
        payload = id_token.split('.')[1]
        payload += '=' * (-len(payload) % 4)
        claims = json.loads(base64.urlsafe_b64decode(payload.encode()))
        if not isinstance(claims, dict):
            raise ValueError('claims is not an object')
        return claims
    except Exception:
        raise GoogleAuthError('invalid_token', 'Google returned an unreadable token.', 502)


def _validate_claims(claims):
    if claims.get('iss') not in VALID_ISSUERS:
        raise GoogleAuthError('invalid_token', 'Unexpected token issuer.', 400)
    if claims.get('aud') != settings.GOOGLE_OAUTH_CLIENT_ID:
        raise GoogleAuthError('invalid_token', 'Token was issued for a different application.', 400)
    try:
        exp = int(claims.get('exp', 0))
        iat = int(claims.get('iat', 0)) if claims.get('iat') is not None else None
    except (TypeError, ValueError):
        raise GoogleAuthError('invalid_token', 'Token has invalid timestamps.', 400)
    now = time.time()
    if exp < now:
        raise GoogleAuthError('invalid_token', 'Token has expired.', 400)
    if iat is not None and iat > now + CLOCK_SKEW:
        raise GoogleAuthError('invalid_token', 'Token was issued in the future.', 400)
    sub = claims.get('sub')
    if not sub or not isinstance(sub, str):
        raise GoogleAuthError('invalid_token', 'Token has no subject.', 400)


def exchange_code(code):
    """Exchange an authorization code for validated ID-token claims.

    Replay protection: Google authorization codes are single-use and bound to our
    client id and the popup redirect ("postmessage").  A reused, expired or
    foreign code makes Google answer HTTP 400 `invalid_grant`, which we surface as
    `invalid_code`.  We deliberately store nothing about codes.
    """
    if not is_configured():
        raise GoogleAuthError('not_configured', 'Google sign-in is not configured on the server.', 503)

    body = urllib.parse.urlencode({
        'code': code,
        'client_id': settings.GOOGLE_OAUTH_CLIENT_ID,
        'client_secret': settings.GOOGLE_OAUTH_CLIENT_SECRET,
        'redirect_uri': 'postmessage',          # required value for the GIS popup code flow
        'grant_type': 'authorization_code',
    }).encode()
    req = urllib.request.Request(TOKEN_URL, data=body, method='POST',
                                 headers={'Content-Type': 'application/x-www-form-urlencoded'})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        # 400 invalid_grant = expired / reused / wrong code.  Never log the code or Google's body.
        logger.info('Google token exchange rejected (HTTP %s)', e.code)
        raise GoogleAuthError('invalid_code', 'Google rejected the sign-in attempt. Please try again.', 400)
    except Exception:
        logger.warning('Google token exchange failed (network)')   # no traceback: it can embed the request
        raise GoogleAuthError('google_unreachable', 'Could not reach Google. Please try again.', 502)

    id_token = data.get('id_token') if isinstance(data, dict) else None
    if not id_token or not isinstance(id_token, str):
        raise GoogleAuthError('invalid_token', 'Google did not return an identity token.', 502)

    claims = _decode_jwt_payload(id_token)
    _validate_claims(claims)
    return claims


def _unique_username(email):
    base = re.sub(r'[^a-z0-9._-]', '', email.split('@')[0].lower())[:30] or 'user'
    candidate, n = base, 1
    while User.objects.filter(username__iexact=candidate).exists():
        n += 1
        candidate = f'{base}{n}'
    return candidate


def _make_link_token(sub, email):
    return signing.dumps({'sub': sub, 'email': email}, salt=LINK_SALT)


def get_or_create_user(claims):
    """Resolve the SustIndex user for validated Google claims. Returns (user, created).

    Raises GoogleAuthError('link_required', ...) when an existing account shares the
    email but is not linked — the caller must NOT authenticate in that case.
    """
    sub = claims['sub']
    email = (claims.get('email') or '').strip()

    # 1) Already linked -> sign in normally.
    ident = GoogleIdentity.objects.select_related('user').filter(sub=sub).first()
    if ident:
        if not ident.user.is_active:
            raise GoogleAuthError('inactive', 'This account is disabled.', 403)
        return ident.user, False

    # Everything below depends on an email Google has verified.
    if not email or claims.get('email_verified') is not True:
        raise GoogleAuthError('email_not_verified', 'Your Google email address is not verified.', 400)

    # 2) Email belongs to an existing SustIndex account -> do NOT link or authenticate.
    existing = User.objects.filter(email__iexact=email).order_by('id').first()
    if existing:
        if existing.is_staff or existing.is_superuser:
            raise GoogleAuthError('admin_link_blocked',
                                  'Administrator accounts cannot be linked to Google sign-in.', 403)
        if not existing.is_active:
            raise GoogleAuthError('inactive', 'This account is disabled.', 403)
        raise GoogleAuthError(
            'link_required',
            'An account with this email already exists. Confirm your SustIndex password to link Google.',
            409,
            extra={'email': email, 'link_token': _make_link_token(sub, email)},
        )

    # 3) Genuinely new user.
    try:
        with transaction.atomic():
            user = User(
                username=_unique_username(email),
                email=email,
                first_name=(claims.get('given_name') or '')[:150],
                last_name=(claims.get('family_name') or '')[:150],
            )
            user.set_unusable_password()   # Google-only until they use "forgot password"
            user.save()
            GoogleIdentity.objects.create(user=user, sub=sub, email=email)
    except IntegrityError:
        # Two simultaneous first sign-ins for the same Google account: use the winner.
        ident = GoogleIdentity.objects.select_related('user').filter(sub=sub).first()
        if ident:
            return ident.user, False
        raise GoogleAuthError('invalid_request', 'Could not create the account.', 400)
    return user, True


def link_with_password(link_token, password, confirm):
    """Finish a 'link_required' flow: verify the existing account's password, then link.

    Returns the user.  Every failure is a GoogleAuthError with a generic message.
    """
    if confirm is not True:
        raise GoogleAuthError('confirmation_required', 'Please confirm that you want to link your Google account.', 400)
    if not isinstance(link_token, str) or not link_token:
        raise GoogleAuthError('invalid_link_token', 'This linking request is not valid. Please start again.', 400)
    try:
        data = signing.loads(link_token, salt=LINK_SALT, max_age=LINK_TOKEN_TTL)
        sub, email = data['sub'], data['email']
    except signing.SignatureExpired:
        raise GoogleAuthError('link_expired', 'This linking request has expired. Please start again.', 400)
    except Exception:
        raise GoogleAuthError('invalid_link_token', 'This linking request is not valid. Please start again.', 400)

    matches = list(User.objects.filter(email__iexact=email).order_by('id')[:2])
    if len(matches) != 1:
        # none (account changed) or ambiguous -> never guess which account to link
        raise GoogleAuthError('link_failed', 'We could not link this account. Please contact support.', 400)
    user = matches[0]

    if user.is_staff or user.is_superuser:
        raise GoogleAuthError('admin_link_blocked', 'Administrator accounts cannot be linked to Google sign-in.', 403)
    if not user.is_active:
        raise GoogleAuthError('inactive', 'This account is disabled.', 403)
    if not user.has_usable_password():
        raise GoogleAuthError('password_not_set', 'This account has no password yet. Use "Forgot password" first.', 400)
    if not isinstance(password, str) or not password or not user.check_password(password):
        raise GoogleAuthError('invalid_password', 'The password is incorrect.', 400)

    try:
        with transaction.atomic():
            GoogleIdentity.objects.create(user=user, sub=sub, email=email)
    except IntegrityError:
        # `sub` is already linked: fine if it's this same user, otherwise refuse.
        existing = GoogleIdentity.objects.filter(sub=sub).first()
        if not existing or existing.user_id != user.id:
            raise GoogleAuthError('already_linked', 'This Google account is already linked to another account.', 409)
    return user
