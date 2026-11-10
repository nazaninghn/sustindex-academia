"""
Temporary-session policy (see accounts/session_tokens.py):
  * every login path stamps ``session_start`` into the refresh token
  * the refresh token lives 12 h from LOGIN and is not extended by use (no rotation)
  * refreshing is refused once 12 h have passed since login; a refreshed access token never outlives that deadline
  * tokens without the claim (pre-policy sessions) are refused
  * logout blacklists the refresh token; other users' sessions are unaffected
"""
import time
from datetime import timedelta
from unittest import mock

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken

from accounts import test_google as tg
from accounts.session_tokens import SESSION_CLAIM
from accounts.throttles import LoginRateThrottle

User = get_user_model()
TOKEN = '/api/v1/auth/token/'
REFRESH = '/api/v1/auth/token/refresh/'
BLACKLIST = '/api/v1/auth/token/blacklist/'
H12 = 12 * 3600


class SessionPolicyTests(TestCase):
    def setUp(self):
        cache.clear()
        p = mock.patch.object(LoginRateThrottle, 'allow_request', return_value=True)
        p.start(); self.addCleanup(p.stop)
        self.client = APIClient()
        self.user = User.objects.create_user('sess_a', 'a@example.test', 'pw-Str0ng!x')
        self.other = User.objects.create_user('sess_b', 'b@example.test', 'pw-Str0ng!x')

    def login(self, username='sess_a'):
        r = self.client.post(TOKEN, {'username': username, 'password': 'pw-Str0ng!x'}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        return r.data

    def refresh_with(self, refresh):
        return self.client.post(REFRESH, {'refresh': str(refresh)}, format='json')

    def aged_refresh(self, age_seconds, user=None):
        """A genuine, correctly signed refresh token whose session started `age_seconds` ago."""
        t = RefreshToken.for_user(user or self.user)
        t[SESSION_CLAIM] = int(time.time()) - age_seconds
        return t

    # ── issuance ──
    def test_password_login_stamps_session_start_and_12h_lifetime(self):
        now = int(time.time())
        tokens = self.login()
        r = RefreshToken(tokens['refresh'])
        self.assertAlmostEqual(r[SESSION_CLAIM], now, delta=5)
        self.assertAlmostEqual(r['exp'] - r[SESSION_CLAIM], H12, delta=5)       # dies with the session
        self.assertAlmostEqual(AccessToken(tokens['access'])['exp'] - now, 30 * 60, delta=5)

    def test_register_google_login_and_google_link_stamp_session_start(self):
        now = int(time.time())
        reg = self.client.post('/api/v1/users/register/', {
            'username': 'sess_new', 'email': 'new@example.test', 'password': 'pw-Str0ng!x9', 'password_confirm': 'pw-Str0ng!x9'}, format='json')
        self.assertEqual(reg.status_code, 201, getattr(reg, 'data', None))
        self.assertAlmostEqual(RefreshToken(reg.data['refresh'])[SESSION_CLAIM], now, delta=5)

        with override_settings(GOOGLE_OAUTH_CLIENT_ID=tg.CID, GOOGLE_OAUTH_CLIENT_SECRET=tg.SECRET):
            with mock.patch('urllib.request.urlopen', return_value=tg._Resp({'id_token': tg._id_token(sub='g-sess', email='g.sess@example.test')})):
                g = self.client.post(tg.URL, {'code': 'abc'}, format='json')
            self.assertEqual(g.status_code, 201, g.data)
            self.assertAlmostEqual(RefreshToken(g.data['refresh'])[SESSION_CLAIM], now, delta=5)
            # account linking (existing password account + explicit confirmation)
            with mock.patch('urllib.request.urlopen', return_value=tg._Resp({'id_token': tg._id_token(sub='g-link', email='a@example.test')})):
                lr = self.client.post(tg.URL, {'code': 'abc'}, format='json')
            self.assertEqual(lr.status_code, 409)
            linked = self.client.post(tg.LINK_URL, {'link_token': lr.data['link_token'], 'password': 'pw-Str0ng!x', 'confirm': True}, format='json')
            self.assertEqual(linked.status_code, 200, linked.data)
            self.assertAlmostEqual(RefreshToken(linked.data['refresh'])[SESSION_CLAIM], now, delta=5)

    # ── refreshing ──
    def test_refresh_returns_access_only_and_does_not_rotate(self):
        tokens = self.login()
        r = self.client.post(REFRESH, {'refresh': tokens['refresh']}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        self.assertIn('access', r.data)
        self.assertNotIn('refresh', r.data)                    # same refresh token keeps working (multi-tab safe)
        self.assertEqual(self.client.post(REFRESH, {'refresh': tokens['refresh']}, format='json').status_code, 200)

    def test_refresh_never_extends_the_session_beyond_12h_from_login(self):
        # 11 h 50 m into the session: the new access token may live only until the 12 h deadline (10 min), not 30 min
        t = self.aged_refresh(H12 - 600)
        r = self.refresh_with(t)
        self.assertEqual(r.status_code, 200, r.data)
        deadline = t[SESSION_CLAIM] + H12
        self.assertLessEqual(AccessToken(r.data['access'])['exp'], deadline + 1)
        self.assertGreater(AccessToken(r.data['access'])['exp'], deadline - 30)

    def test_session_older_than_12h_cannot_be_refreshed(self):
        self.assertEqual(self.refresh_with(self.aged_refresh(H12 + 1)).status_code, 401)
        self.assertEqual(self.refresh_with(self.aged_refresh(24 * 3600)).status_code, 401)

    def test_login_then_12_hours_pass_requires_new_login(self):
        tokens = self.login()
        self.assertEqual(self.client.post(REFRESH, {'refresh': tokens['refresh']}, format='json').status_code, 200)
        later = time.time() + H12 + 1
        with mock.patch('accounts.session_tokens.time.time', return_value=later):
            r = self.client.post(REFRESH, {'refresh': tokens['refresh']}, format='json')
        self.assertEqual(r.status_code, 401)
        self.assertNotIn('access', r.data)
        self.assertEqual(self.login()['refresh'] != tokens['refresh'], True)      # a fresh login works again

    def test_expired_refresh_token_is_refused(self):
        t = RefreshToken.for_user(self.user)
        t[SESSION_CLAIM] = int(time.time())
        t.set_exp(lifetime=timedelta(seconds=-5))
        self.assertEqual(self.refresh_with(t).status_code, 401)

    def test_pre_policy_token_without_session_start_is_refused(self):
        legacy = RefreshToken.for_user(self.user)                    # exactly what the old code issued
        self.assertNotIn(SESSION_CLAIM, legacy.payload)
        self.assertEqual(self.refresh_with(legacy).status_code, 401)

    def test_tampered_session_start_is_rejected(self):
        t = str(self.aged_refresh(0))
        head, payload, sig = t.split('.')
        self.assertEqual(self.client.post(REFRESH, {'refresh': f'{head}.{payload}x.{sig}'}, format='json').status_code, 401)

    def test_deactivated_account_cannot_refresh(self):
        tokens = self.login()
        User.objects.filter(pk=self.user.pk).update(is_active=False)
        self.assertEqual(self.client.post(REFRESH, {'refresh': tokens['refresh']}, format='json').status_code, 401)

    # ── logout / isolation ──
    def test_logout_blacklists_refresh_token_and_leaves_other_users_alone(self):
        a, b = self.login('sess_a'), self.login('sess_b')
        self.assertEqual(self.client.post(BLACKLIST, {'refresh': a['refresh']}, format='json').status_code, 200)
        self.assertEqual(self.client.post(REFRESH, {'refresh': a['refresh']}, format='json').status_code, 401)
        self.assertEqual(self.client.post(REFRESH, {'refresh': b['refresh']}, format='json').status_code, 200)

    def test_second_login_of_same_user_is_an_independent_session(self):
        first, second = self.login(), self.login()
        self.client.post(BLACKLIST, {'refresh': first['refresh']}, format='json')
        self.assertEqual(self.client.post(REFRESH, {'refresh': second['refresh']}, format='json').status_code, 200)
