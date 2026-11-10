"""
Google sign-in tests. Google's token endpoint is mocked — no network access.

Policy under test (see accounts/google_auth.py):
  * linked Google account            -> normal sign-in
  * email matches an UNLINKED account -> never auto-link / never authenticate;
                                         password + explicit confirmation required
  * admin accounts                   -> never linked
  * unknown email                    -> new account
Plus the security checks: claim validation, replay, error hygiene, throttling,
and that JWT issuance / refresh / logout (blacklist) behave exactly like password login.
"""
import base64
import json
import time
import urllib.error
from unittest import mock

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from accounts import google_auth
from accounts.models import GoogleIdentity
from accounts.throttles import LoginRateThrottle

User = get_user_model()
URL = '/api/v1/auth/google/'
LINK_URL = '/api/v1/auth/google/link/'
CID = 'test-client.apps.googleusercontent.com'
SECRET = 'super-secret-value-123'
PW = 'pw-Str0ng!x'


def _id_token(**claims):
    base = {'iss': 'https://accounts.google.com', 'aud': CID, 'exp': int(time.time()) + 600,
            'iat': int(time.time()) - 5, 'sub': 'g-123', 'email': 'new.person@example.com',
            'email_verified': True, 'given_name': 'New', 'family_name': 'Person'}
    base.update(claims)
    seg = lambda o: base64.urlsafe_b64encode(json.dumps(o).encode()).decode().rstrip('=')
    return f"{seg({'alg': 'RS256'})}.{seg(base)}.sig"


class _Resp:
    def __init__(self, payload): self._p = json.dumps(payload).encode()
    def read(self): return self._p
    def __enter__(self): return self
    def __exit__(self, *a): return False


class _Base(TestCase):
    """Throttle off by default; tests that exercise throttling use ThrottleTests."""
    patch_throttle = True

    def setUp(self):
        cache.clear()
        self.client = APIClient()
        if self.patch_throttle:
            p = mock.patch.object(LoginRateThrottle, 'allow_request', return_value=True)
            p.start(); self.addCleanup(p.stop)

    def _google(self, **claims):
        with mock.patch('urllib.request.urlopen', return_value=_Resp({'id_token': _id_token(**claims)})):
            return self.client.post(URL, {'code': 'abc'}, format='json')

    def _link(self, token, password=PW, confirm=True, **extra):
        body = {'link_token': token, 'password': password, 'confirm': confirm}
        body.update(extra)
        return self.client.post(LINK_URL, body, format='json')


# ───────────────────────── Google login ─────────────────────────
@override_settings(GOOGLE_OAUTH_CLIENT_ID=CID, GOOGLE_OAUTH_CLIENT_SECRET=SECRET)
class GoogleLoginTests(_Base):
    # configuration / request shape
    @override_settings(GOOGLE_OAUTH_CLIENT_ID='', GOOGLE_OAUTH_CLIENT_SECRET='')
    def test_not_configured_returns_503(self):
        r = self.client.post(URL, {'code': 'abc'}, format='json')
        self.assertEqual(r.status_code, 503)
        self.assertEqual(r.data['code'], 'not_configured')

    def test_missing_code(self):
        r = self.client.post(URL, {}, format='json')
        self.assertEqual((r.status_code, r.data['code']), (400, 'missing_code'))

    def test_non_object_json_body_is_400_not_500(self):
        r = self.client.post(URL, ['x'], format='json')
        self.assertEqual(r.status_code, 400)

    # token validation (iss / aud / exp / iat / sub / verified email)
    def test_wrong_audience_rejected(self):
        r = self._google(aud='someone-elses-client')
        self.assertEqual((r.status_code, r.data['code']), (400, 'invalid_token'))

    def test_wrong_issuer_rejected(self):
        self.assertEqual(self._google(iss='https://evil.example').status_code, 400)

    def test_expired_token_rejected(self):
        self.assertEqual(self._google(exp=int(time.time()) - 5).status_code, 400)

    def test_garbage_exp_is_400_not_500(self):
        self.assertEqual(self._google(exp='soon').status_code, 400)

    def test_token_issued_in_the_future_rejected(self):
        self.assertEqual(self._google(iat=int(time.time()) + 3600).status_code, 400)

    def test_missing_subject_rejected(self):
        self.assertEqual(self._google(sub='').status_code, 400)

    def test_unverified_email_rejected_for_new_user(self):
        r = self._google(email_verified=False)
        self.assertEqual((r.status_code, r.data['code']), (400, 'email_not_verified'))
        self.assertFalse(User.objects.filter(email='new.person@example.com').exists())

    def test_email_verified_must_be_boolean_true(self):
        # a string "true"/"false" is not accepted as proof
        self.assertEqual(self._google(email_verified='true').status_code, 400)

    # upstream failures + replay
    def test_google_rejects_code(self):
        err = urllib.error.HTTPError('u', 400, 'bad', {}, None)
        with mock.patch('urllib.request.urlopen', side_effect=err):
            r = self.client.post(URL, {'code': 'stale'}, format='json')
        self.assertEqual((r.status_code, r.data['code']), (400, 'invalid_code'))

    def test_network_failure_is_502(self):
        with mock.patch('urllib.request.urlopen', side_effect=OSError('down')):
            r = self.client.post(URL, {'code': 'abc'}, format='json')
        self.assertEqual((r.status_code, r.data['code']), (502, 'google_unreachable'))

    def test_code_replay_is_rejected_and_creates_nothing_extra(self):
        """Google makes codes single-use: first exchange works, the replay gets invalid_grant."""
        ok = _Resp({'id_token': _id_token()})
        err = urllib.error.HTTPError('u', 400, 'invalid_grant', {}, None)
        with mock.patch('urllib.request.urlopen', side_effect=[ok, err]):
            first = self.client.post(URL, {'code': 'one-time'}, format='json')
            replay = self.client.post(URL, {'code': 'one-time'}, format='json')
        self.assertEqual(first.status_code, 201)
        self.assertEqual((replay.status_code, replay.data['code']), (400, 'invalid_code'))
        self.assertEqual(User.objects.count(), 1)

    def test_exchange_request_is_sent_server_side_with_secret_and_postmessage(self):
        with mock.patch('urllib.request.urlopen', return_value=_Resp({'id_token': _id_token()})) as m:
            self.client.post(URL, {'code': 'the-code'}, format='json')
        req = m.call_args[0][0]
        self.assertEqual(req.full_url, 'https://oauth2.googleapis.com/token')
        body = req.data.decode()
        self.assertIn('client_secret=' + SECRET, body)
        self.assertIn('redirect_uri=postmessage', body)
        self.assertIn('grant_type=authorization_code', body)

    # error hygiene
    def test_error_responses_never_leak_secret_code_or_internals(self):
        cases = []
        err = urllib.error.HTTPError('u', 400, 'invalid_grant: client_secret=' + SECRET, {}, None)
        with mock.patch('urllib.request.urlopen', side_effect=err):
            cases.append(self.client.post(URL, {'code': 'LEAK-ME-CODE'}, format='json'))
        with mock.patch('urllib.request.urlopen', side_effect=OSError('conn to oauth2.googleapis.com secret=' + SECRET)):
            cases.append(self.client.post(URL, {'code': 'LEAK-ME-CODE'}, format='json'))
        cases.append(self._google(aud='other'))
        for r in cases:
            text = r.content.decode()
            for needle in (SECRET, 'LEAK-ME-CODE', 'Traceback', 'oauth2.googleapis.com', 'client_secret'):
                self.assertNotIn(needle, text, f'{needle!r} leaked in {r.status_code} response')

    # new users / linked users
    def test_creates_new_user_and_returns_jwt(self):
        r = self._google()
        self.assertEqual(r.status_code, 201)
        self.assertTrue(r.data['created'])
        self.assertIn('access', r.data); self.assertIn('refresh', r.data)
        u = User.objects.get(email='new.person@example.com')
        self.assertEqual((u.first_name, u.last_name), ('New', 'Person'))
        self.assertFalse(u.has_usable_password())
        self.assertTrue(GoogleIdentity.objects.filter(user=u, sub='g-123').exists())
        c = APIClient(); c.credentials(HTTP_AUTHORIZATION=f"Bearer {r.data['access']}")
        me = c.get('/api/v1/users/me/')
        self.assertEqual((me.status_code, me.data['email']), (200, 'new.person@example.com'))

    def test_existing_linked_google_account_signs_in_even_if_email_changed(self):
        self._google()
        r = self._google(email='renamed@example.com')
        self.assertEqual(r.status_code, 200)
        self.assertFalse(r.data['created'])
        self.assertEqual(User.objects.count(), 1)

    def test_username_collision_gets_suffix(self):
        User.objects.create_user('new.person', 'other@example.com', PW)
        r = self._google()
        self.assertEqual((r.status_code, r.data['user']['username']), (201, 'new.person2'))

    def test_stale_bearer_token_does_not_block_google_login(self):
        self.client.credentials(HTTP_AUTHORIZATION='Bearer not-a-real-token')
        self.assertEqual(self._google().status_code, 201)

    # ── NO AUTOMATIC LINKING ──
    def test_existing_email_match_is_not_linked_and_not_authenticated(self):
        local = User.objects.create_user('elif', 'new.person@example.com', PW)
        r = self._google()
        self.assertEqual(r.status_code, 409)
        self.assertEqual(r.data['code'], 'link_required')
        self.assertNotIn('access', r.data); self.assertNotIn('refresh', r.data); self.assertNotIn('user', r.data)
        self.assertIn('link_token', r.data)
        self.assertEqual(r.data['email'], 'new.person@example.com')
        self.assertNotIn('elif', r.content.decode())            # username never exposed
        self.assertFalse(GoogleIdentity.objects.exists())        # nothing linked
        self.assertEqual(User.objects.count(), 1)                # no duplicate account either
        local.refresh_from_db()
        self.assertTrue(local.check_password(PW))

    def test_email_match_is_case_insensitive(self):
        User.objects.create_user('elif', 'New.Person@Example.com', PW)
        r = self._google()
        self.assertEqual((r.status_code, r.data['code']), (409, 'link_required'))
        self.assertFalse(GoogleIdentity.objects.exists())

    def test_admin_account_is_never_auto_linked(self):
        User.objects.create_superuser('boss', 'new.person@example.com', PW)
        r = self._google()
        self.assertEqual((r.status_code, r.data['code']), (403, 'admin_link_blocked'))
        self.assertNotIn('link_token', r.data)
        self.assertFalse(GoogleIdentity.objects.exists())

    def test_staff_account_is_never_auto_linked(self):
        User.objects.create_user('mod', 'new.person@example.com', PW, is_staff=True)
        r = self._google()
        self.assertEqual((r.status_code, r.data['code']), (403, 'admin_link_blocked'))

    def test_inactive_account_refused(self):
        User.objects.create_user('gone', 'new.person@example.com', PW, is_active=False)
        r = self._google()
        self.assertEqual((r.status_code, r.data['code']), (403, 'inactive'))

    # ── JWT / session behaviour is identical to password login ──
    def test_google_issued_tokens_refresh_and_blacklist_like_password_login(self):
        r = self._google()
        refresh, access = r.data['refresh'], r.data['access']
        rr = self.client.post('/api/v1/auth/token/refresh/', {'refresh': refresh}, format='json')
        self.assertEqual(rr.status_code, 200)
        self.assertIn('access', rr.data)
        new_refresh = rr.data.get('refresh', refresh)             # ROTATE_REFRESH_TOKENS=True
        bl = self.client.post('/api/v1/auth/token/blacklist/', {'refresh': new_refresh}, format='json')
        self.assertEqual(bl.status_code, 200)                     # logout path
        again = self.client.post('/api/v1/auth/token/refresh/', {'refresh': new_refresh}, format='json')
        self.assertEqual(again.status_code, 401)                  # blacklisted -> unusable


# ───────────────────── Linking with password ─────────────────────
@override_settings(GOOGLE_OAUTH_CLIENT_ID=CID, GOOGLE_OAUTH_CLIENT_SECRET=SECRET)
class GoogleLinkTests(_Base):
    def setUp(self):
        super().setUp()
        self.local = User.objects.create_user('elif', 'new.person@example.com', PW)

    def _token(self):
        r = self._google()
        self.assertEqual(r.data['code'], 'link_required')
        return r.data['link_token']

    def test_successful_link_after_password_and_confirmation(self):
        r = self._link(self._token())
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.data['linked'])
        self.assertEqual(r.data['user']['id'], self.local.id)
        self.assertIn('access', r.data); self.assertIn('refresh', r.data)
        self.assertTrue(GoogleIdentity.objects.filter(user=self.local, sub='g-123').exists())
        self.assertEqual(User.objects.count(), 1)
        self.local.refresh_from_db()
        self.assertTrue(self.local.check_password(PW))            # password login keeps working
        # the issued tokens authenticate
        c = APIClient(); c.credentials(HTTP_AUTHORIZATION=f"Bearer {r.data['access']}")
        self.assertEqual(c.get('/api/v1/users/me/').status_code, 200)

    def test_after_linking_google_signs_in_directly(self):
        self._link(self._token())
        r = self._google()
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['user']['id'], self.local.id)
        self.assertFalse(r.data['created'])

    def test_wrong_password_rejected_and_nothing_linked(self):
        r = self._link(self._token(), password='wrong-password')
        self.assertEqual((r.status_code, r.data['code']), (400, 'invalid_password'))   # 400 not 401: SPA interceptor
        self.assertNotIn('access', r.data)
        self.assertFalse(GoogleIdentity.objects.exists())

    def test_empty_or_non_string_password_rejected(self):
        t = self._token()
        for pw in ('', None, 12345, ['x']):
            r = self._link(t, password=pw)
            self.assertEqual((r.status_code, r.data['code']), (400, 'invalid_password'))
        self.assertFalse(GoogleIdentity.objects.exists())

    def test_explicit_confirmation_is_required(self):
        t = self._token()
        for c in (False, None, 'true', 1, 'yes'):
            r = self._link(t, confirm=c)
            self.assertEqual((r.status_code, r.data['code']), (400, 'confirmation_required'))
        body = {'link_token': t, 'password': PW}                  # confirm omitted
        self.assertEqual(self.client.post(LINK_URL, body, format='json').status_code, 400)
        self.assertFalse(GoogleIdentity.objects.exists())

    def test_tampered_or_garbage_token_rejected(self):
        t = self._token()
        for bad in (t[:-3] + 'abc', 'garbage', '', None, 123):
            r = self._link(bad)
            self.assertEqual((r.status_code, r.data['code']), (400, 'invalid_link_token'))
        self.assertFalse(GoogleIdentity.objects.exists())

    def test_token_signed_for_other_purpose_rejected(self):
        from django.core import signing
        forged = signing.dumps({'sub': 'g-123', 'email': 'new.person@example.com'}, salt='something-else')
        self.assertEqual(self._link(forged).data['code'], 'invalid_link_token')

    def test_expired_token_rejected(self):
        t = self._token()
        with mock.patch('time.time', return_value=time.time() + google_auth.LINK_TOKEN_TTL + 5):
            r = self._link(t)
        self.assertEqual((r.status_code, r.data['code']), (400, 'link_expired'))
        self.assertFalse(GoogleIdentity.objects.exists())

    def test_admin_cannot_be_linked_via_link_endpoint_even_with_valid_token(self):
        boss = User.objects.create_superuser('boss', 'boss@example.com', PW)
        forged = google_auth._make_link_token('g-boss', 'boss@example.com')   # worst case: token obtained somehow
        r = self._link(forged)
        self.assertEqual((r.status_code, r.data['code']), (403, 'admin_link_blocked'))
        self.assertFalse(GoogleIdentity.objects.filter(user=boss).exists())

    def test_account_without_password_cannot_link_and_is_pointed_to_recovery(self):
        self.local.set_unusable_password(); self.local.save()
        r = self._link(self._token())
        self.assertEqual((r.status_code, r.data['code']), (400, 'password_not_set'))
        self.assertFalse(GoogleIdentity.objects.exists())

    def test_inactive_account_cannot_link(self):
        t = self._token()
        self.local.is_active = False; self.local.save()
        r = self._link(t)
        self.assertEqual((r.status_code, r.data['code']), (403, 'inactive'))

    def test_google_account_already_linked_elsewhere_is_refused(self):
        other = User.objects.create_user('someone', 'someone@example.com', PW)
        t = self._token()
        GoogleIdentity.objects.create(user=other, sub='g-123', email='someone@example.com')
        r = self._link(t)
        self.assertEqual((r.status_code, r.data['code']), (409, 'already_linked'))
        self.assertFalse(GoogleIdentity.objects.filter(user=self.local).exists())

    def test_ambiguous_duplicate_email_never_guesses(self):
        t = self._token()
        User.objects.create_user('twin', 'NEW.PERSON@example.com', PW)
        r = self._link(t)
        self.assertEqual((r.status_code, r.data['code']), (400, 'link_failed'))
        self.assertFalse(GoogleIdentity.objects.exists())

    def test_link_errors_do_not_leak_account_details(self):
        r = self._link(self._token(), password='nope')
        text = r.content.decode()
        for needle in ('elif', 'pbkdf2', PW, 'Traceback'):
            self.assertNotIn(needle, text)


# ───────────────────── Rate limiting (real throttle) ─────────────────────
@override_settings(GOOGLE_OAUTH_CLIENT_ID=CID, GOOGLE_OAUTH_CLIENT_SECRET=SECRET)
class ThrottleTests(_Base):
    patch_throttle = False

    def test_google_endpoint_is_rate_limited(self):
        codes = []
        with mock.patch('urllib.request.urlopen', side_effect=urllib.error.HTTPError('u', 400, 'x', {}, None)):
            for _ in range(7):
                codes.append(self.client.post(URL, {'code': 'x'}, format='json').status_code)
        self.assertEqual(codes[:5], [400] * 5)
        self.assertIn(429, codes[5:])

    def test_link_endpoint_is_rate_limited_against_password_guessing(self):
        codes = [self._link('tok', password=f'guess{i}').status_code for i in range(7)]
        self.assertIn(429, codes)
        self.assertEqual(codes[0], 400)

    def test_login_endpoints_share_one_bucket(self):
        """Alternating between the two Google endpoints can't double the allowed guess rate."""
        with mock.patch('urllib.request.urlopen', side_effect=urllib.error.HTTPError('u', 400, 'x', {}, None)):
            codes = []
            for i in range(7):
                codes.append(self.client.post(URL, {'code': 'x'}, format='json').status_code if i % 2 == 0
                             else self._link('tok').status_code)
        self.assertIn(429, codes)


# ───────────────────── Password login unaffected ─────────────────────
class PasswordLoginUnaffectedTests(_Base):
    def test_password_login_still_works(self):
        User.objects.create_user('elif', 'e@example.com', PW)
        r = self.client.post('/api/v1/auth/token/', {'username': 'elif', 'password': PW}, format='json')
        self.assertEqual(r.status_code, 200)
        self.assertIn('access', r.data); self.assertIn('refresh', r.data)

    def test_wrong_password_still_401(self):
        User.objects.create_user('elif', 'e@example.com', PW)
        r = self.client.post('/api/v1/auth/token/', {'username': 'elif', 'password': 'nope'}, format='json')
        self.assertEqual(r.status_code, 401)

    @override_settings(GOOGLE_OAUTH_CLIENT_ID=CID, GOOGLE_OAUTH_CLIENT_SECRET=SECRET)
    def test_password_login_works_after_google_link(self):
        User.objects.create_user('elif', 'new.person@example.com', PW)
        t = self._google().data['link_token']
        self._link(t)
        r = self.client.post('/api/v1/auth/token/', {'username': 'elif', 'password': PW}, format='json')
        self.assertEqual(r.status_code, 200)
