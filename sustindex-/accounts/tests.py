"""
Accounts app tests.

Covers:
  - User registration via API (success, duplicate username, duplicate email,
    password mismatch, weak password)
  - JWT token issuance on registration
  - /api/users/me/ returns the authenticated user
  - Non-staff cannot create users via POST /api/users/ (Fix R)
  - Non-staff cannot delete users via DELETE /api/users/{id}/ (Fix R)
"""

from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from django.contrib.auth import get_user_model

User = get_user_model()


class UserRegistrationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.register_url = '/api/users/register/'

    def _payload(self, **overrides):
        base = {
            'username': 'testuser',
            'email': 'test@example.com',
            'password': 'StrongPass1!',
            'password_confirm': 'StrongPass1!',
            'first_name': 'Test',
            'last_name': 'User',
        }
        base.update(overrides)
        return base

    def test_successful_registration_returns_201_with_tokens(self):
        resp = self.client.post(self.register_url, self._payload(), format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertIn('access', resp.data)
        self.assertIn('refresh', resp.data)
        self.assertIn('user', resp.data)
        self.assertEqual(resp.data['user']['username'], 'testuser')

    def test_duplicate_username_returns_400(self):
        User.objects.create_user(username='testuser', password='x', email='other@example.com')
        resp = self.client.post(self.register_url, self._payload(), format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_duplicate_email_returns_400(self):
        """Fix F (Round 2): unique email enforced at serializer level."""
        User.objects.create_user(
            username='existing', password='x', email='test@example.com'
        )
        resp = self.client.post(
            self.register_url,
            self._payload(username='newuser'),
            format='json'
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('email', resp.data)

    def test_case_insensitive_email_duplicate_rejected(self):
        User.objects.create_user(username='existing', password='x', email='Test@Example.COM')
        resp = self.client.post(
            self.register_url,
            self._payload(username='newuser', email='test@example.com'),
            format='json'
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_password_mismatch_returns_400(self):
        resp = self.client.post(
            self.register_url,
            self._payload(password_confirm='WrongPass99!'),
            format='json'
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_short_password_returns_400(self):
        resp = self.client.post(
            self.register_url,
            self._payload(password='abc', password_confirm='abc'),
            format='json'
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)


class UserMeEndpointTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='meuser', email='me@example.com', password='StrongPass1!'
        )
        self.client.force_authenticate(user=self.user)

    def test_me_returns_authenticated_user(self):
        resp = self.client.get('/api/users/me/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data['username'], 'meuser')

    def test_unauthenticated_me_returns_401(self):
        self.client.force_authenticate(user=None)
        resp = self.client.get('/api/users/me/')
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)


class UserViewSetRestrictionTests(TestCase):
    """Fix R (Round 4): non-staff cannot create or delete users via the ViewSet."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='regular', email='regular@example.com', password='StrongPass1!'
        )
        self.client.force_authenticate(user=self.user)

    def test_non_staff_cannot_post_to_users_list(self):
        resp = self.client.post('/api/users/', {
            'username': 'hacker', 'email': 'h@h.com',
            'password': 'x', 'password_confirm': 'x'
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_non_staff_cannot_delete_own_account(self):
        resp = self.client.delete(f'/api/users/{self.user.id}/')
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(User.objects.filter(id=self.user.id).exists())
