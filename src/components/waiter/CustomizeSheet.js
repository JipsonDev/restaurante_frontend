// Personalizar al añadir: cantidad, extras, exclusiones, término y nota, filtrados por la categoría del producto.
// Una personalización distinta queda como línea aparte en la comanda.
import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { Check } from 'lucide-react-native';
import { useTheme } from '../../theme';
import { menuStock } from '../../utils/waiterCatalog.mjs';
import { extrasForProduct, toModifier, unitPrice } from '../../utils/waiterFavorites.mjs';
import { T, Num, Label, Press, Button, Tally, Field, BottomSheet, Perforation, money, TOUCH, radius, space } from './comanda';

const GROUPS = [
  ['EXTRA', 'Extras'], ['EXCLUSION', 'Sin'], ['TERMINO', 'Término'], ['NOTA', 'Indicaciones'],
];
const groupOf = extra => {
  const t = String(extra.tipo || 'EXTRA').toUpperCase();
  if (/^t[eé]rmino\b/i.test(String(extra.nombre || ''))) return 'TERMINO';
  if (/EXCLU|SIN/.test(t)) return 'EXCLUSION';
  if (/TERM|COCC/.test(t)) return 'TERMINO';
  if (/NOTA|INDIC/.test(t)) return 'NOTA';
  return 'EXTRA';
};

function Option({ extra, selected, onPress, radio }) {
  const { c } = useTheme();
  const cost = Number(extra.precio_extra ?? extra.precio ?? 0);
  return <Press accessibilityRole={radio ? 'radio' : 'checkbox'} accessibilityState={{ checked: selected }} accessibilityLabel={`${extra.nombre}${cost ? `, más ${money(cost)}` : ''}`}
    onPress={onPress} hapticKind="select" scaleTo={0.99} sink={0} hoverStyle={{ backgroundColor: c.soft }}
    style={{ minHeight: TOUCH + 4, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.sm, borderBottomWidth: 1, borderBottomColor: c.line }}>
    <View style={{ width: 24, height: 24, borderRadius: radio ? 12 : radius.sm, borderWidth: 2, borderColor: selected ? c.ink : c.lineStrong, backgroundColor: selected ? c.ink : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
      {selected ? radio ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.onInk }} /> : <Check size={16} color={c.onInk} strokeWidth={3} /> : null}
    </View>
    <T size={16} weight={selected ? '700' : '500'} style={{ flex: 1 }}>{extra.nombre}</T>
    {cost ? <Num size={15} color={c.muted}>+{money(cost)}</Num> : null}
  </Press>;
}

export default function CustomizeSheet({ visible, product, extras = [], inCart = 0, onClose, onConfirm, busy }) {
  const { c } = useTheme();
  const [qty, setQty] = useState(1);
  const [picked, setPicked] = useState([]);
  const [note, setNote] = useState('');
  useEffect(() => { if (visible) { setQty(1); setPicked([]); setNote(''); } }, [visible, product?.id]);
  const options = useMemo(() => product ? extrasForProduct(extras, product) : [], [extras, product]);
  const groups = useMemo(() => GROUPS.map(([key, title]) => [key, title, options.filter(o => groupOf(o) === key)]).filter(g => g[2].length), [options]);
  if (!product) return null;
  const stock = menuStock(product);
  const max = Math.max(1, Math.min(99, stock - inCart));
  const mods = options.filter(o => picked.includes(o.nombre)).map(toModifier);
  const unit = unitPrice(product, mods);
  const toggle = (extra, radio) => setPicked(list => {
    if (list.includes(extra.nombre)) return list.filter(n => n !== extra.nombre);
    if (radio) { const same = options.filter(o => groupOf(o) === 'TERMINO').map(o => o.nombre); return [...list.filter(n => !same.includes(n)), extra.nombre]; }
    return [...list, extra.nombre];
  });
  const confirm = () => onConfirm({ cantidad: qty, modificadores: mods, notas: note.trim() });
  return <BottomSheet visible={visible} onClose={onClose} busy={busy} title={product.nombre} subtitle={`${money(product.precio)} c/u${stock < 9999 ? ` · quedan ${Math.max(0, stock - inCart)}` : ''}`}
    footer={<Button variant="primary" size="lg" full onPress={confirm} loading={busy} disabled={stock - inCart < 1} hapticKind="medium">
      {`Añadir ${qty} · ${money(unit * qty)}`}
    </Button>}>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md }}>
      <Label color={c.text}>Cantidad</Label>
      <Tally value={qty} onChange={setQty} min={1} max={max} />
    </View>
    {groups.map(([key, title, list]) => <View key={key} style={{ gap: 2 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Label>{title}</Label>{key === 'TERMINO' ? <T size={13} color={c.faint}>elige uno</T> : null}
      </View>
      <Perforation style={{ marginTop: 4 }} />
      {list.map(o => <Option key={`${o.id ?? o.nombre}`} extra={o} radio={key === 'TERMINO'} selected={picked.includes(o.nombre)} onPress={() => toggle(o, key === 'TERMINO')} />)}
    </View>)}
    <Field label="Nota para cocina" placeholder="Ej.: sin hielo, bien caliente, alérgico a…" value={note} onChangeText={setNote} maxLength={140} multiline />
  </BottomSheet>;
}
