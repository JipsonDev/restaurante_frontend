import test from 'node:test';
import assert from 'node:assert/strict';
import { PRODUCT_BRAND, brandInitials, brandTones, contrast, parseHex } from '../src/utils/brandPalette.mjs';

const ok = (fg, bg, min) => assert.ok(contrast(parseHex(fg), parseHex(bg)) >= min, `${fg} sobre ${bg}: ${contrast(parseHex(fg), parseHex(bg)).toFixed(2)}`);

test('cualquier color de marca da botones y textos legibles', () => {
  for (const hex of ['#D63B20', '#FFD400', '#0A1F44', '#00C2A8', '#FF6B00', '#7A3E9D', '#FFFFFF', '#000000', PRODUCT_BRAND]) {
    for (const dark of [false, true]) {
      const t = brandTones(hex, { dark });
      ok(t.onPrimary, t.primary, 4.5);                      // texto del botón
      ok(t.primaryText, dark ? '#191A1F' : '#FFFFFF', 4.5);  // la marca usada como texto
    }
  }
});

test('amarillo lleva texto oscuro; azul marino, texto blanco', () => {
  assert.equal(brandTones('#FFD400').onPrimary, '#14161A');
  assert.equal(brandTones('#FFD400').brandIsLight, true);
  assert.equal(brandTones('#0A1F44').onPrimary, '#FFFFFF');
  assert.notEqual(brandTones('#0A1F44', { dark: true }).primary, '#0A1F44'); // se aclara para verse en modo oscuro
});

test('sin color válido se usa el del producto', () => {
  assert.equal(brandTones('').primary, PRODUCT_BRAND.toUpperCase());
  assert.equal(brandTones('rojo').primary, PRODUCT_BRAND.toUpperCase());
});

test('iniciales del local', () => {
  assert.equal(brandInitials('Morena Mía'), 'MM');
  assert.equal(brandInitials('Café de la Esquina'), 'CE');
  assert.equal(brandInitials('Sabor'), 'SA');
  assert.equal(brandInitials(''), '?');
});
