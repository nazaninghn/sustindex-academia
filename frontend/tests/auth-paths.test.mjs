// Regression tests for the "wrong password reloads the page and hides the error" bug.
// lib/api.ts skips its refresh-and-redirect-to-/login logic for these endpoints only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { isCredentialEndpoint } from '../lib/auth-paths.ts';

test('login and Google credential endpoints are exempt from session-refresh/redirect', () => {
  for (const url of [
    '/api/v1/auth/token/',
    '/api/v1/auth/token',
    '/api/v1/auth/token/?lang=en',
    '/api/v1/auth/google/',
    '/api/v1/auth/google/link/',
    'http://localhost:8000/api/v1/auth/token/',
    'https://sustindex.onrender.com/api/v1/auth/google/link/',
  ]) assert.equal(isCredentialEndpoint(url), true, url);
});

test('every other API call still goes through automatic token refresh', () => {
  for (const url of [
    '/api/v1/auth/token/refresh/',            // the refresh call itself
    '/api/v1/auth/token/blacklist/',          // logout
    '/api/v1/users/me/',
    '/api/v1/users/register/',
    '/api/v1/surveys/',
    '/api/v1/attempts/my_attempts/?lang=en',
    '/api/v1/courses/',
    '/api/v1/documents/12/download/',
    '/api/v1/auth/google/extra/',
    '/api/v1/auth/googleX/',
    '/api/v1/auth/tokens/',
    '/x/api/v1/auth/token/',                  // must be anchored at the API root
  ]) assert.equal(isCredentialEndpoint(url), false, url);
});

test('missing / empty URLs never exempt a request', () => {
  for (const u of [undefined, null, '', ' ']) assert.equal(isCredentialEndpoint(u), false);
});
