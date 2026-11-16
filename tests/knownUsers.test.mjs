import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_KNOWN_USERS, forgetUser, initials, parseKnownUsers, rememberUser } from '../src/utils/knownUsers.mjs';

test('remembers the most recent user first, without duplicates and normalized', () => {
  let list = rememberUser([], { correo: 'Ana@Morena.com ', nombre: 'Ana Pérez', rol: 'mesero' });
  list = rememberUser(list, { correo: 'luis@morena.com', nombre: 'Luis' });
  list = rememberUser(list, { correo: 'ana@morena.com', nombre: 'Ana Pérez' });
  assert.deepEqual(list.map(u => u.correo), ['ana@morena.com', 'luis@morena.com']);
});

test('keeps a bounded list and ignores invalid entries', () => {
  let list = [];
  for (let i = 0; i < 10; i += 1) list = rememberUser(list, { correo: `u${i}@x.com`, nombre: `U${i}` });
  assert.equal(list.length, MAX_KNOWN_USERS);
  assert.equal(rememberUser(list, { correo: 'nope' }), list);
  assert.deepEqual(parseKnownUsers('{bad json'), []);
  assert.deepEqual(parseKnownUsers(JSON.stringify([{ correo: 'a@b.c' }, null, { correo: 3 }])), [{ correo: 'a@b.c' }]);
});

test('forgets a user and builds initials', () => {
  const list = rememberUser([], { correo: 'a@b.com', nombre: 'Ana' });
  assert.deepEqual(forgetUser(list, 'A@B.com'), []);
  assert.equal(initials('María José Pérez'), 'MJ');
  assert.equal(initials(''), '?');
});
