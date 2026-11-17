// Códigos QR del menú: uno por mesa, para imprimir y pegar en la mesa.
// El cliente lo escanea con la cámara y ve el menú con fotos, sin instalar nada.
import React, { useEffect, useMemo, useState } from 'react';
import { Platform, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { ExternalLink, Printer } from 'lucide-react-native';
import axios from 'axios';
import { BASE_URL } from '../../context/AuthContext';
import { useTheme } from '../../theme';
import { MenuButton, MenuField, MenuModal, MenuNotice } from '../MenuUI';
import { Button, Skeleton, radius, space, type } from './ui';
import { qrPath, qrSvg } from '../../utils/qr.mjs';

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
export const menuUrl = (origin, code) => `${String(origin || '').trim().replace(/\/+$/, '')}/?menu=${code}`;
const validOrigin = value => /^https?:\/\/[^\s/]+(\/[^\s?#]*)?$/i.test(String(value || '').trim());

function QrImage({ value, size }) {
  const { path, size: n } = useMemo(() => qrPath(value), [value]);
  return <Svg width={size} height={size} viewBox={`0 0 ${n} ${n}`} accessibilityLabel="Código QR">
    <Rect x="0" y="0" width={n} height={n} fill="#FFFFFF" />
    <Path d={path} fill="#000000" />
  </Svg>;
}

/** Hoja para imprimir: una tarjeta por mesa (6 por hoja A4), lista para recortar. */
export function qrSheetHtml({ tables, origin, business }) {
  const cards = tables.map(t => `<div class="card">
    <div class="brand">${escapeHtml(business)}</div>
    ${qrSvg(menuUrl(origin, t.codigo), { size: 220 })}
    <div class="table">Mesa ${escapeHtml(t.numero)}</div>
    <div class="hint">Escanea con la cámara para ver el menú</div>
  </div>`).join('');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Códigos QR del menú</title><style>
    @page { size: A4; margin: 10mm; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: system-ui, -apple-system, "Segoe UI", Arial, sans-serif; color: #111; }
    .sheet { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6mm; }
    .card { border: 1px dashed #999; border-radius: 4mm; padding: 6mm 4mm; text-align: center; break-inside: avoid; page-break-inside: avoid; height: 88mm; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2mm; }
    .card svg { width: 46mm; height: 46mm; }
    .brand { font-size: 13pt; font-weight: 700; letter-spacing: .02em; }
    .table { font-size: 22pt; font-weight: 800; }
    .hint { font-size: 10pt; color: #444; }
    .bar { padding: 12px; text-align: center; font-size: 14px; }
    .bar button { font: inherit; padding: 8px 18px; border-radius: 8px; border: 1px solid #111; background: #111; color: #fff; cursor: pointer; }
    @media print { .bar { display: none; } }
  </style></head><body>
    <div class="bar"><button onclick="window.print()">Imprimir</button></div>
    <div class="sheet">${cards}</div>
  </body></html>`;
}

export default function TableQrDialog({ visible, close, business = 'Menú' }) {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const [tables, setTables] = useState(null);
  const [error, setError] = useState('');
  const [origin, setOrigin] = useState(() => Platform.OS === 'web' && typeof window !== 'undefined' && /^https?:/.test(window.location.origin) ? window.location.origin : '');
  useEffect(() => {
    if (!visible) return undefined;
    let alive = true; setError('');
    axios.get(`${BASE_URL}/mesas/qr`, { timeout: 12000 })
      .then(({ data }) => { if (alive) setTables(Array.isArray(data) ? [...data].sort((a, b) => Number(a.numero) - Number(b.numero)) : []); })
      .catch(e => { if (alive) setError(e.response?.data?.message || e.message || 'No se pudieron cargar los códigos.'); });
    return () => { alive = false; };
  }, [visible]);
  const ok = validOrigin(origin);
  const print = () => {
    if (!ok || !tables?.length || Platform.OS !== 'web') return;
    const page = window.open('', '_blank');
    if (!page) { setError('El navegador bloqueó la ventana para imprimir. Permite las ventanas emergentes e intenta de nuevo.'); return; }
    page.document.write(qrSheetHtml({ tables, origin, business })); page.document.close();
  };
  const size = width < 680 ? 132 : 148;
  return <MenuModal visible={visible} title="Códigos QR del menú" subtitle="Imprímelos y pega uno en cada mesa. El cliente lo escanea y ve el menú con fotos." maxWidth={760} close={close}
    footer={<View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
      <View style={{ flex: 1 }} />
      <MenuButton onPress={close}>Cerrar</MenuButton>
      <Button variant="primary" icon={Printer} disabled={!ok || !tables?.length || Platform.OS !== 'web'} onPress={print}>Imprimir todos</Button>
    </View>}>
    {!!error && <MenuNotice danger>{error}</MenuNotice>}
    <MenuField label="Dirección de la app" value={origin} onChangeText={setOrigin} placeholder="https://tu-restaurante.vercel.app" autoCapitalize="none" autoCorrect={false}
      hint={ok ? 'Es la dirección donde abres este sistema. Si la cambias algún día, hay que volver a imprimir los códigos.' : 'Escribe la dirección completa, empezando por https://'} />
    {!tables ? <View style={{ flexDirection: 'row', gap: space.md }}>{[0, 1, 2].map(i => <Skeleton key={i} width={size} height={size + 40} radius={12} />)}</View>
      : !tables.length ? <Text style={[type.body, { color: c.muted }]}>Todavía no hay mesas activas. Crea las mesas y vuelve aquí.</Text>
      : !ok ? null
      : <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
        {tables.map(t => <View key={t.id} style={{ alignItems: 'center', gap: 6, padding: space.sm, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line, backgroundColor: '#FFFFFF' }}>
          <QrImage value={menuUrl(origin, t.codigo)} size={size} />
          <Text style={[type.body, { color: '#111111', fontWeight: '700' }]}>Mesa {t.numero}</Text>
          {Platform.OS === 'web' ? <Button size="sm" variant="tertiary" icon={ExternalLink} onPress={() => window.open(menuUrl(origin, t.codigo), '_blank', 'noopener')}>Probar</Button> : null}
        </View>)}
      </View>}
  </MenuModal>;
}
