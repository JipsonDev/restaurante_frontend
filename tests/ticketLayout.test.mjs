import test from 'node:test';
import assert from 'node:assert/strict';
import { build, businessHeader, itemTable, parseTicket, t, toHtml, toPlain, WIDTH } from '../src/utils/ticketLayout.mjs';

test('el ticket usa el nombre de cada local y nunca pasa de 42 columnas', () => {
  const markup = build(businessHeader({ nombre_restaurante: 'La Esquina', ruc: '1790012345001', direccion: 'Av. Amazonas y Colón, Quito, frente al parque grande' }),
    itemTable([{ cantidad: 2, nombre: 'Hamburguesa doble con queso cheddar y tocino ahumado', precio: 4.5, modificadores: [{ tipo: 'EXCLUSION', nombre: 'cebolla' }] }]),
    t.row('TOTAL', '$9.00', 'H'));
  const plain = toPlain(markup);
  assert.match(plain, /LA ESQUINA/);
  assert.match(plain, /RUC 1790012345001/);
  assert.ok(plain.split('\n').every(l => l.length <= WIDTH), 'alguna línea pasa de 42');
  assert.match(plain, /\$9\.00$/m);
  assert.equal(parseTicket(markup)[0].style, 'T');
  assert.match(toHtml(markup), /class="T"/);
  assert.doesNotMatch(plain, /\u001f/);
});

test('un nombre largo no va en letra doble (no cabría)', () => {
  const lines = parseTicket(build(t.title('Restaurante y Cafetería Los Almendros del Valle')));
  assert.ok(lines.every(l => l.style === 'c'));
});
