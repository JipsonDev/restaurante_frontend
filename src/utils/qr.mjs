// Generador de códigos QR sin dependencias (modo byte, corrección de errores M, versiones 1 a 10).
// Suficiente para la dirección del menú de cada mesa. qrMatrix(texto) → matriz de true/false (true = módulo oscuro).

// [palabras de corrección por bloque, [cantidad de bloques, palabras de datos por bloque]...] para el nivel M.
const BLOCKS = [null,
  [10, [1, 16]], [16, [1, 28]], [26, [1, 44]], [18, [2, 32]], [24, [2, 43]],
  [16, [4, 27]], [18, [4, 31]], [22, [2, 38], [2, 39]], [22, [3, 36], [2, 37]], [26, [4, 43], [1, 44]],
];
const ALIGN = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];

// Aritmética en GF(256) con el polinomio 0x11D.
const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
for (let i = 0, x = 1; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11D; }
for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
const mul = (a, b) => a && b ? EXP[LOG[a] + LOG[b]] : 0;

function generator(degree) {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) { next[j] ^= poly[j]; next[j + 1] ^= mul(poly[j], EXP[i]); }
    poly = next;
  }
  return poly;
}
function remainder(data, degree) {
  const gen = generator(degree), out = new Array(degree).fill(0);
  for (const byte of data) {
    const factor = byte ^ out.shift(); out.push(0);
    for (let i = 0; i < degree; i++) out[i] ^= mul(gen[i + 1], factor);
  }
  return out;
}

const dataCapacity = version => BLOCKS[version].slice(1).reduce((n, [count, size]) => n + count * size, 0);

function utf8(text) {
  if (typeof TextEncoder !== 'undefined') return [...new TextEncoder().encode(text)];
  return [...unescape(encodeURIComponent(text))].map(ch => ch.charCodeAt(0));
}

function codewords(bytes, version) {
  const capacity = dataCapacity(version), bits = [];
  const push = (value, length) => { for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1); };
  push(0b0100, 4); push(bytes.length, version >= 10 ? 16 : 8);
  for (const b of bytes) push(b, 8);
  push(0, Math.min(4, capacity * 8 - bits.length));
  while (bits.length % 8) bits.push(0);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((n, bit) => (n << 1) | bit, 0));
  for (let pad = 0xEC; data.length < capacity; pad ^= 0xEC ^ 0x11) data.push(pad);

  // Reparte en bloques, calcula la corrección de cada uno y los entrelaza.
  const [ecLength, ...groups] = BLOCKS[version];
  const blocks = []; let offset = 0;
  for (const [count, size] of groups) for (let i = 0; i < count; i++) { const block = data.slice(offset, offset + size); offset += size; blocks.push({ block, ec: remainder(block, ecLength) }); }
  const out = [], longest = Math.max(...blocks.map(b => b.block.length));
  for (let i = 0; i < longest; i++) for (const b of blocks) if (i < b.block.length) out.push(b.block[i]);
  for (let i = 0; i < ecLength; i++) for (const b of blocks) out.push(b.ec[i]);
  return out;
}

function bch(value, generatorPoly, bits) {
  let rem = value;
  const top = 31 - Math.clz32(generatorPoly);
  rem <<= top;
  for (let i = bits - 1; i >= 0; i--) if ((rem >>> (i + top)) & 1) rem ^= generatorPoly << i;
  return rem;
}

const MASKS = [
  (x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, x => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => (x * y) % 2 + (x * y) % 3 === 0,
  (x, y) => ((x * y) % 2 + (x * y) % 3) % 2 === 0, (x, y) => ((x + y) % 2 + (x * y) % 3) % 2 === 0,
];

function penalty(m) {
  const n = m.length; let score = 0, dark = 0;
  const run = line => { // tiras de 5+ iguales y el patrón 1:1:3:1:1 con 4 claros a un lado
    let count = 1;
    for (let i = 1; i <= n; i++) { if (i < n && line[i] === line[i - 1]) count++; else { if (count >= 5) score += count - 2; count = 1; } }
    for (let i = 0; i + 10 < n + 0; i++) {
      const s = line.slice(i, i + 11).map(v => v ? 1 : 0).join('');
      if (s === '10111010000' || s === '00001011101') score += 40;
    }
  };
  for (let y = 0; y < n; y++) run(m[y]);
  for (let x = 0; x < n; x++) run(m.map(row => row[x]));
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (m[y][x]) dark++;
    if (x + 1 < n && y + 1 < n && m[y][x] === m[y][x + 1] && m[y][x] === m[y + 1][x] && m[y][x] === m[y + 1][x + 1]) score += 3;
  }
  return score + Math.floor(Math.abs(dark * 20 - n * n * 10) / (n * n)) * 10;
}

export function qrMatrix(text) {
  const bytes = utf8(String(text ?? ''));
  let version = 1;
  while (version <= 10 && bytes.length > dataCapacity(version) - (version >= 10 ? 3 : 2)) version++;
  if (version > 10) throw new Error('El texto es demasiado largo para el código QR.');
  const size = version * 4 + 17;
  const modules = Array.from({ length: size }, () => new Array(size).fill(false));
  const fixed = Array.from({ length: size }, () => new Array(size).fill(false));
  const set = (x, y, dark) => { if (x >= 0 && y >= 0 && x < size && y < size) { modules[y][x] = !!dark; fixed[y][x] = true; } };

  // Patrones de posición (con su borde claro), sincronía y alineación.
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
    const d = Math.max(Math.abs(dx), Math.abs(dy)); set(cx + dx, cy + dy, d !== 2 && d !== 4);
  }
  for (let i = 0; i < size; i++) { if (!fixed[6][i]) set(i, 6, i % 2 === 0); if (!fixed[i][6]) set(6, i, i % 2 === 0); }
  const centers = ALIGN[version];
  for (const cy of centers) for (const cx of centers) {
    if ((cx === 6 && cy === 6) || (cx === 6 && cy === size - 7) || (cx === size - 7 && cy === 6)) continue;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }
  // Reserva del formato (se escribe al final) y módulo oscuro fijo.
  const formatCells = bits => {
    for (let i = 0; i <= 5; i++) set(8, i, bits >>> i & 1);
    set(8, 7, bits >>> 6 & 1); set(8, 8, bits >>> 7 & 1); set(7, 8, bits >>> 8 & 1);
    for (let i = 9; i < 15; i++) set(14 - i, 8, bits >>> i & 1);
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bits >>> i & 1);
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, bits >>> i & 1);
    set(8, size - 8, true);
  };
  formatCells(0);
  if (version >= 7) {
    const bits = (version << 12) | bch(version, 0x1F25, 12);
    for (let i = 0; i < 18; i++) { const bit = bits >>> i & 1, a = size - 11 + i % 3, b = Math.floor(i / 3); set(a, b, bit); set(b, a, bit); }
  }

  // Datos en zigzag, de derecha a izquierda, en columnas de a dos.
  const words = codewords(bytes, version); let index = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let v = 0; v < size; v++) for (let j = 0; j < 2; j++) {
      const x = right - j, upward = ((right + 1) & 2) === 0, y = upward ? size - 1 - v : v;
      if (fixed[y][x]) continue;
      modules[y][x] = index < words.length * 8 ? (words[index >>> 3] >>> (7 - (index & 7)) & 1) === 1 : false;
      index++;
    }
  }

  // Prueba las 8 máscaras y se queda con la más fácil de leer.
  let best = null;
  for (let mask = 0; mask < 8; mask++) {
    const trial = modules.map((row, y) => row.map((dark, x) => fixed[y][x] ? dark : dark !== MASKS[mask](x, y)));
    const keep = modules.map(row => row.slice());
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) modules[y][x] = trial[y][x];
    const data = (0b00 << 3) | mask; // nivel M = 00
    formatCells(((data << 10) | bch(data, 0x537, 10)) ^ 0x5412);
    const result = modules.map(row => row.slice()), score = penalty(result);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) modules[y][x] = keep[y][x];
    if (!best || score < best.score) best = { score, result };
  }
  return best.result;
}

/** Trazo de los módulos oscuros y tamaño del lienzo (con margen claro de 4 módulos, como pide el estándar). */
export function qrPath(text, margin = 4) {
  const m = qrMatrix(text);
  let path = '';
  for (let y = 0; y < m.length; y++) {
    for (let x = 0; x < m.length; x++) {
      if (!m[y][x]) continue;
      let run = 1; while (x + run < m.length && m[y][x + run]) run++; // une los módulos seguidos de la fila
      path += `M${x + margin},${y + margin}h${run}v1h-${run}z`; x += run - 1;
    }
  }
  return { path, size: m.length + margin * 2 };
}

/** SVG del código listo para imprimir. */
export function qrSvg(text, { size = 240, dark = '#000000', light = '#FFFFFF', margin = 4 } = {}) {
  const { path, size: n } = qrPath(text, margin);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges"><rect width="${n}" height="${n}" fill="${light}"/><path d="${path}" fill="${dark}"/></svg>`;
}
