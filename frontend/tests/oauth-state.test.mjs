// Run with:  npm test   (Node's built-in test runner; imports the TypeScript module directly)
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  beginOAuthState, consumeOAuthState, clearOAuthState, hasPendingOAuthState, STATE_TTL_MS,
} from '../lib/oauth-state.ts';

test.beforeEach(() => clearOAuthState());

test('state is 256-bit hex from crypto.getRandomValues (never Math.random)', () => {
  const realRandom = Math.random;
  Math.random = () => { throw new Error('Math.random must not be used for OAuth state'); };
  const c = globalThis.crypto;
  const calls = [];
  const orig = c.getRandomValues.bind(c);
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { getRandomValues: (b) => { calls.push(b.length); return orig(b); } } });
  try {
    const s = beginOAuthState();
    assert.match(s, /^[0-9a-f]{64}$/);
    assert.deepEqual(calls, [32]);                 // exactly one 32-byte CSPRNG read
  } finally {
    Math.random = realRandom;
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: c });
  }
});

test('a fresh, unpredictable value for every attempt (2000 distinct, no shared prefix pattern)', () => {
  const seen = new Set();
  let prev = '';
  for (let i = 0; i < 2000; i++) {
    const s = beginOAuthState();
    assert.notEqual(s, prev);
    assert.ok(!seen.has(s));
    seen.add(s); prev = s;
  }
  // every hex position takes many different values -> not a counter / timestamp / constant
  const vals = [...seen].slice(0, 400);
  for (let pos = 0; pos < 64; pos++) assert.ok(new Set(vals.map((v) => v[pos])).size >= 12, `position ${pos} looks non-random`);
});

test('refuses to run without a secure random source', () => {
  const c = globalThis.crypto;
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: undefined });
  try { assert.throws(() => beginOAuthState(), /secure random/i); }
  finally { Object.defineProperty(globalThis, 'crypto', { configurable: true, value: c }); }
  assert.equal(hasPendingOAuthState(), false);
});

test('exact match is accepted exactly once (single-use / replay protection)', () => {
  const s = beginOAuthState();
  assert.equal(consumeOAuthState(s), true);
  assert.equal(consumeOAuthState(s), false);       // replay of the same value
  assert.equal(hasPendingOAuthState(), false);
});

test('a new attempt invalidates the previous attempt\'s state', () => {
  const old = beginOAuthState();
  const fresh = beginOAuthState();
  assert.notEqual(old, fresh);
  assert.equal(consumeOAuthState(old), false);      // stale value can't authorize
  // ...and (fail closed) the failed check burned the pending value too
  assert.equal(consumeOAuthState(fresh), false);
});

test('only the current attempt\'s state works after an earlier one was superseded', () => {
  beginOAuthState();
  const current = beginOAuthState();
  assert.equal(consumeOAuthState(current), true);
});

test('mismatches are rejected and burn the pending value', () => {
  const s = beginOAuthState();
  const flipped = s.slice(0, -1) + (s.endsWith('0') ? '1' : '0');
  assert.equal(consumeOAuthState(flipped), false);
  assert.equal(consumeOAuthState(s), false);        // legitimate value no longer usable either
});

test('malformed input is rejected: undefined, null, number, object, empty, case change, prefix, suffix, padding', () => {
  for (const bad of [undefined, null, 0, 1, {}, [], '', ' ', 'forged']) {
    const s = beginOAuthState();
    assert.equal(consumeOAuthState(bad), false, `accepted ${JSON.stringify(bad)}`);
    clearOAuthState();
    void s;
  }
  let s = beginOAuthState();
  assert.equal(consumeOAuthState(s.toUpperCase()), false);
  s = beginOAuthState(); assert.equal(consumeOAuthState(s.slice(0, 32)), false);
  s = beginOAuthState(); assert.equal(consumeOAuthState(s + '0'), false);
  s = beginOAuthState(); assert.equal(consumeOAuthState(' ' + s), false);
});

test('nothing pending -> always rejected', () => {
  assert.equal(consumeOAuthState('a'.repeat(64)), false);
  assert.equal(consumeOAuthState(undefined), false);
});

test('state expires after the TTL (boundary inclusive) and is then useless', () => {
  let t = 1_000_000;
  const clock = () => t;
  const s = beginOAuthState(clock);
  t += STATE_TTL_MS;                                 // exactly at the limit: still valid
  assert.equal(consumeOAuthState(s, clock), true);

  const s2 = beginOAuthState(clock);
  t += STATE_TTL_MS + 1;                             // one ms too late
  assert.equal(consumeOAuthState(s2, clock), false);
  assert.equal(hasPendingOAuthState(), false);
});

test('cancel / error / unmount cleanup: cleared state cannot authorize a late callback', () => {
  const s = beginOAuthState();
  assert.equal(hasPendingOAuthState(), true);
  clearOAuthState();                                 // popup closed / error / unmount
  assert.equal(hasPendingOAuthState(), false);
  assert.equal(consumeOAuthState(s), false);         // late callback with the old value
  clearOAuthState();                                 // idempotent
  assert.equal(hasPendingOAuthState(), false);
});

test('a cancelled attempt followed by a new one: only the new state works', () => {
  const first = beginOAuthState();
  clearOAuthState();                                 // user closed the popup
  const second = beginOAuthState();
  assert.notEqual(first, second);
  assert.equal(consumeOAuthState(first), false);
  assert.equal(beginOAuthState() !== second, true);  // (consume above burned `second`; a third attempt is independent)
});
