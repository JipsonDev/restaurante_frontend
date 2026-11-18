// Diseño de tickets térmicos (80 mm, 42 columnas) con estilo: título grande, negrita y centrado.
// Cada línea puede llevar una marca de estilo invisible (\u001f + letra). De ahí salen tres formatos:
//   · toPlain(): texto plano alineado (vista previa, impresoras sin ESC/POS, agentes antiguos)
//   · toHtml():  ventana de impresión del navegador
//   · parseTicket(): líneas con estilo para el agente ESC/POS (tamaño doble, negrita, centrado)
// Este archivo es idéntico en el frontend (src/utils/ticketLayout.mjs) y el backend (services/ticketLayout.js).
export const WIDTH = 42;
const MARK = '\u001f';
// T: título (doble ancho y alto, negrita, centrado) · H: doble alto en negrita · C: centrado · c: centrado en negrita · B: negrita
const STYLES = new Set(['T', 'H', 'C', 'c', 'B']);
const TITLE_MAX = Math.floor(WIDTH / 2);

const str = v => String(v ?? '').replace(/\s+/g, ' ').trim();
const mark = (style, text) => (style ? `${MARK}${style}${text}` : text);

// Corta por palabras; una palabra más larga que el ancho se parte.
export function wrap(text, width = WIDTH) {
  const words = str(text).split(' ').filter(Boolean);
  const out = []; let cur = '';
  for (let w of words) {
    while (w.length > width) { if (cur) { out.push(cur); cur = ''; } out.push(w.slice(0, width)); w = w.slice(width); }
    if (!cur) cur = w;
    else if (cur.length + 1 + w.length <= width) cur += ` ${w}`;
    else { out.push(cur); cur = w; }
  }
  if (cur) out.push(cur);
  return out.length ? out : [''];
}

const pad = (left, right, width = WIDTH) => `${left}${' '.repeat(Math.max(1, width - left.length - right.length))}${right}`;

export const t = {
  // Nombre o destino en grande; si no cabe en 21 columnas, va centrado en negrita.
  title: text => { const s = str(text).toUpperCase(); return s.length <= TITLE_MAX ? [mark('T', s)] : wrap(s).map(x => mark('c', x)); },
  center: text => (str(text) ? wrap(text).map(x => mark('C', x)) : []),
  centerBold: text => (str(text) ? wrap(text).map(x => mark('c', x)) : []),
  bold: (text, indent = 0) => (str(text) ? wrap(text, WIDTH - indent).map(x => mark('B', ' '.repeat(indent) + x)) : []),
  big: (text, indent = 0) => (str(text) ? wrap(text, WIDTH - indent).map((x, i) => mark('H', (i ? ' '.repeat(indent) : '') + x)) : []),
  text: (text, indent = 0) => (str(text) ? wrap(text, WIDTH - indent).map(x => ' '.repeat(indent) + x) : []),
  rule: (ch = '-') => [ch.repeat(WIDTH)],
  blank: () => [''],
  // Etiqueta a la izquierda y valor a la derecha; si no caben, la etiqueta se parte.
  row: (left, right, style = null) => {
    const r = str(right); const l = str(left);
    const room = Math.max(8, WIDTH - r.length - 1);
    const lines = wrap(l, room);
    return lines.map((x, i) => mark(style, i === lines.length - 1 ? pad(x, r) : x));
  },
  // Producto: «  2 Seco de pollo            $9.00»; el nombre largo continúa debajo, alineado.
  item: (qty, name, amount, extra = []) => {
    const q = String(qty).padStart(3);
    const a = str(amount);
    const nameW = WIDTH - 4 - (a ? a.length + 1 : 0);
    const lines = wrap(name, nameW);
    return [
      ...lines.map((x, i) => (i === 0 ? (a ? pad(`${q} ${x}`, a) : `${q} ${x}`) : `    ${x}`)),
      ...extra.flatMap(e => t.text(e, 6)),
    ];
  },
};

// Une partes (listas o líneas sueltas) ignorando null/false.
export function build(...parts) {
  return parts.flat(Infinity).filter(x => x !== null && x !== undefined && x !== false).join('\n');
}

export function parseTicket(markup) {
  return String(markup || '').split('\n').map(l => (l.startsWith(MARK) && STYLES.has(l[1]) ? { style: l[1], text: l.slice(2) } : { style: null, text: l }));
}

const centered = s => `${' '.repeat(Math.max(0, Math.floor((WIDTH - s.length) / 2)))}${s}`;
export function toPlain(markup) {
  return parseTicket(markup).map(({ style, text }) => (style === 'T' || style === 'C' || style === 'c' ? centered(text) : text)).join('\n');
}

const escapeHtml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const TICKET_CSS = '.tk{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;line-height:1.4;color:#111;white-space:pre;}'
  + '.tk div{min-height:1.4em}.tk .T{font-size:22px;line-height:1.25;font-weight:800;text-align:center;white-space:normal;margin:2px 0}'
  + '.tk .H{font-weight:800;transform:scaleY(1.45);transform-origin:left center;margin:4px 0}.tk .C{text-align:center;white-space:normal}.tk .c{text-align:center;font-weight:800;white-space:normal}.tk .B{font-weight:800}';
export function toHtml(markup) {
  return `<div class="tk">${parseTicket(markup).map(({ style, text }) => `<div${style ? ` class="${style}"` : ''}>${escapeHtml(text) || '&nbsp;'}</div>`).join('')}</div>`;
}

// ── Piezas comunes ───────────────────────────────────────────────────────
export const money = (value, symbol = '$') => `${symbol}${Number(value || 0).toFixed(2)}`;
const two = n => String(n).padStart(2, '0');
export function dateTime(value) {
  const d = new Date(value || Date.now());
  if (Number.isNaN(d.getTime())) return { fecha: '', hora: '' };
  return { fecha: `${two(d.getDate())}/${two(d.getMonth() + 1)}/${d.getFullYear()}`, hora: `${two(d.getHours())}:${two(d.getMinutes())}` };
}

// Encabezado del negocio: el nombre de cada restaurante (marca blanca), nunca uno fijo.
export function businessHeader(s = {}) {
  const name = str(s.nombre_restaurante) || 'Restaurante';
  const contact = [str(s.telefono) ? `Tel. ${str(s.telefono)}` : '', str(s.correo)].filter(Boolean).join(' · ');
  return [
    t.title(name),
    str(s.razon_social) && str(s.razon_social).toLowerCase() !== name.toLowerCase() ? t.center(s.razon_social) : null,
    str(s.ruc) ? t.center(`RUC ${str(s.ruc)}`) : null,
    t.center(s.direccion),
    t.center(contact),
  ];
}

export function docTitle(title, number) {
  return [t.rule('='), t.centerBold(title), number ? t.center(`No. ${number}`) : null, t.rule('=')];
}

export const modLabel = m => `${m.tipo === 'EXCLUSION' ? 'Sin ' : m.tipo === 'EXTRA' ? '+ ' : ''}${str(m.nombre)}${Number(m.precio_extra) ? ` (${money(m.precio_extra)})` : ''}`;
export const itemTotal = it => (Number(it.precio || 0) + (it.modificadores || []).reduce((s, m) => s + Number(m.precio_extra || 0), 0)) * Number(it.cantidad || 0);

// Detalle de productos con cabecera de columnas.
export function itemTable(items = [], symbol = '$', { notes = true } = {}) {
  return [
    t.row('CANT DESCRIPCIÓN', 'TOTAL', 'B'),
    t.rule('-'),
    ...items.map(it => t.item(it.cantidad, it.nombre, money(itemTotal(it), symbol), [
      ...(it.modificadores || []).map(modLabel),
      it.cortesia ? `Cortesía: ${str(it.cortesia.motivo) || 'de la casa'}` : null,
      notes && str(it.notas) ? `Nota: ${str(it.notas)}` : null,
    ].filter(Boolean))),
    t.rule('-'),
  ];
}

export function footer(s = {}, { fiscal = false } = {}) {
  return [t.rule('='), t.center(str(s.texto_ticket) || 'Gracias por su visita'), fiscal ? null : t.center('Documento sin valor tributario')];
}
