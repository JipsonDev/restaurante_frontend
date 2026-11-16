import test from 'node:test';
import assert from 'node:assert/strict';
import { validateLogin, validatePinSetup } from '../src/utils/loginLogic.mjs';

test('password login validates identity but preserves the exact password', () => {
  assert.deepEqual(validateLogin({ mode: 'password', correo: '  TEST@example.com ', password: ' pass with spaces ' }), {});
  assert.ok(validateLogin({ mode: 'password', correo: 'not-an-email', password: '' }).correo);
  assert.ok(validateLogin({ mode: 'password', correo: 'test@example.com', password: '' }).password);
});

test('PIN access and setup reject incomplete or nonnumeric values and mismatches', () => {
  for (const pin of ['', '123', '12345', '12a4']) assert.ok(validateLogin({ mode: 'pin', correo: 'a@b.com', pin }).pin);
  assert.deepEqual(validateLogin({ mode: 'pin', correo: 'a@b.com', pin: '0123' }), {});
  assert.ok(validatePinSetup('1234', '4321').confirmPin);
  assert.ok(validatePinSetup('123', '123').newPin);
  assert.deepEqual(validatePinSetup('0123', '0123'), {});
});

test('PIN access is tied to one account: without a user it is rejected', () => {
  assert.ok(validateLogin({ mode: 'pin', pin: '0123' }).correo);
  assert.ok(validateLogin({ mode: 'pin', correo: 'sin-arroba', pin: '0123' }).correo);
});
