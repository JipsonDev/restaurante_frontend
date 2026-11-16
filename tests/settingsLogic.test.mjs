import assert from 'node:assert/strict';
import test from 'node:test';
import { settingsPayload, ticketPreview } from '../src/utils/settingsLogic.mjs';

test('settings normalize billing values and preview the same percentages', () => {
  const payload = settingsPayload({ nombre_restaurante: ' Morena Mia ', iva_porcentaje: '15,5', servicio_porcentaje: '10', moneda: 'usd', simbolo_moneda: '$', correo: '', ruc: '' });
  assert.equal(payload.nombre_restaurante, 'Morena Mia');
  assert.equal(payload.iva_porcentaje, '15.5');
  assert.equal(payload.moneda, 'USD');
  assert.deepEqual(ticketPreview(payload, 10), { subtotal: 10, tax: 1.55, service: 1, total: 12.55 });
});

test('settings reject invalid fiscal values before sending them', () => {
  const base = { nombre_restaurante: 'Morena Mia', iva_porcentaje: '15', servicio_porcentaje: '0', moneda: 'USD', simbolo_moneda: '$', correo: '', ruc: '' };
  assert.throws(() => settingsPayload({ ...base, iva_porcentaje: '120' }), /entre 0 y 100/);
  assert.throws(() => settingsPayload({ ...base, moneda: 'dólar' }), /tres letras/);
  assert.throws(() => settingsPayload({ ...base, correo: 'incorrecto' }), /no es válido/);
});

test('settings validate delay thresholds before saving', () => {
  const base = { nombre_restaurante:'Morena Mia',iva_porcentaje:'0',servicio_porcentaje:'0',moneda:'USD',simbolo_moneda:'$',alertas_demora_activas:'1',alerta_espera_minutos:'20',alerta_lista_minutos:'5' };
  assert.equal(settingsPayload(base).alerta_lista_minutos,'5');
  for (const value of ['0','241','3.5','']) assert.throws(()=>settingsPayload({...base,alerta_lista_minutos:value}),/1 y 240/);
  assert.throws(()=>settingsPayload({...base,alertas_demora_activas:'yes'}),/0 o 1/);
});
