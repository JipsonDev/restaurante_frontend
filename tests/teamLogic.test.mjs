import test from 'node:test';
import assert from 'node:assert/strict';
import { teamGroup, teamPayload } from '../src/utils/teamLogic.mjs';

test('team groups supervisors with administration and keeps operational roles separate', () => {
  assert.equal(teamGroup('admin'), 'administracion');
  assert.equal(teamGroup('supervisor'), 'administracion');
  assert.equal(teamGroup('cocina'), 'cocina');
  assert.equal(teamGroup('caja'), 'caja');
});

test('new team members require valid identity, credentials and unique email', () => {
  const base = { nombre: ' Ana ', correo: 'ANA@CAFE.COM ', password: 'secreto', pin: '1234', rol: 'mesero', activo: true };
  assert.deepEqual(teamPayload(base), { nombre: 'Ana', correo: 'ana@cafe.com', rol: 'mesero', activo: 1, password: 'secreto', pin: '1234' });
  assert.throws(() => teamPayload({ ...base, correo: 'ana' }));
  assert.throws(() => teamPayload({ ...base, password: '123' }));
  assert.throws(() => teamPayload(base, { workers: [{ id: 2, correo: 'ana@cafe.com' }] }));
});

test('editing can keep or explicitly clear the PIN and protects the current admin', () => {
  const base = { nombre: 'Ana', correo: 'ana@cafe.com', password: '', pin: '', rol: 'admin', activo: true };
  assert.equal('pin' in teamPayload(base, { editing: true, workerId: 1, currentUserId: 1 }), false);
  assert.equal(teamPayload({ ...base, clearPin: true }, { editing: true }).pin, '');
  assert.throws(() => teamPayload({ ...base, activo: false }, { editing: true, workerId: 1, currentUserId: 1 }));
  assert.throws(() => teamPayload({ ...base, rol: 'caja' }, { editing: true, workerId: 1, currentUserId: 1 }));
});
