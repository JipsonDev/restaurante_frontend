import test from 'node:test';
import assert from 'node:assert/strict';
import { isOwnApiRequest, shouldExpireSession } from '../src/utils/sessionLogic.mjs';
const base = 'https://restaurant.example/api';
const error = (url, token = 'current') => ({ response: { status: 401 }, config: { url, headers: { Authorization: `Bearer ${token}` } } });

test('authentication is scoped to the restaurant API', () => {
  assert.ok(isOwnApiRequest({ url: `${base}/mesas` }, base));
  assert.ok(isOwnApiRequest({ url: 'mesas', baseURL: base }, base));
  for (const url of ['https://other.example/api/mesas', 'https://restaurant.example.attacker.test/api', 'https://restaurant.example/api-other', 'https://restaurant.example/uploads/image']) {
    assert.equal(isOwnApiRequest({ url }, base), false);
  }
});

test('only an expired current API session returns the user to login', () => {
  assert.ok(shouldExpireSession(error(`${base}/mesas`), 'current', base));
  assert.equal(shouldExpireSession(error(`${base}/mesas`, 'old'), 'current', base), false);
  assert.equal(shouldExpireSession(error(`${base}/auth/login`), 'current', base), false);
  assert.equal(shouldExpireSession(error('https://other.example/api'), 'current', base), false);
  assert.equal(shouldExpireSession({ ...error(`${base}/mesas`), response: { status: 403 } }, 'current', base), false);
});
