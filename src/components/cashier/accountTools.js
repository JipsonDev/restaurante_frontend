// Herramientas de cuenta en caja: descuento o cortesía (con autorización) y dividir la cuenta por platos.
import React, { useEffect, useMemo, useState } from 'react';
import { TextInput, View, useWindowDimensions } from 'react-native';
import { BadgePercent, Gift, Minus, Plus, ShieldCheck, Split, Trash2, X } from 'lucide-react-native';
import { Btn, Cell, Cells, Dialog, FONT, IconBtn, Lbl, Num, Press, Seg, T, TotalRow, WEB, money, r, toNum } from './kit';

const cents = (v) => Math.round(Number(v || 0) * 100);
const lineCents = (item) => (cents(item.precio) + (item.modificadores || []).reduce((s, m) => s + cents(m.precio_extra), 0)) * Number(item.cantidad || 0);
const inputStyle = (c, extra) => [{ height: 44, paddingHorizontal: 12, borderRadius: r.md, borderWidth: 1, borderColor: c.rule, backgroundColor: c.paper, fontFamily: FONT, fontSize: 15, color: c.text }, WEB ? { outlineStyle: 'none' } : null, extra];
const REASONS = {
  DESCUENTO: ['Cliente frecuente', 'Promoción', 'Error en el pedido', 'Demora en el servicio'],
  CORTESIA: ['Error de cocina', 'Demora en el servicio', 'Cortesía de la casa', 'Cumpleaños'],
};

function Authorization({ c, correo, pin, onCorreo, onPin }) {
  return <View style={{ gap: 10, padding: 12, borderRadius: r.md, backgroundColor: c.amberSoft }}>
    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}><ShieldCheck size={16} color={c.amber} /><T c={c} size={13} weight="700" color={c.amber}>Necesita la autorización de un administrador o supervisor.</T></View>
    <TextInput value={correo} onChangeText={onCorreo} autoCapitalize="none" keyboardType="email-address" placeholder="Correo de quien autoriza" placeholderTextColor={c.faint} accessibilityLabel="Correo de quien autoriza" style={inputStyle(c)} />
    <TextInput value={pin} onChangeText={(v) => onPin(v.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad" secureTextEntry maxLength={4} placeholder="PIN de 4 dígitos" placeholderTextColor={c.faint} accessibilityLabel="PIN de quien autoriza" style={inputStyle(c, { fontSize: 18, letterSpacing: 6 })} />
  </View>;
}

// ── Descuento o cortesía ────────────────────────────────────────────────────
export function AdjustDialog({ c, visible, onClose, order, canAuthorize, servicePercent = 0, onApply, onRemove, removing }) {
  const [tipo, setTipo] = useState('DESCUENTO');
  const [modo, setModo] = useState('porcentaje');
  const [valor, setValor] = useState('');
  const [detalle, setDetalle] = useState(null);
  const [motivo, setMotivo] = useState('');
  const [correo, setCorreo] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { if (visible) { setTipo('DESCUENTO'); setModo('porcentaje'); setValor(''); setDetalle(null); setMotivo(''); setCorreo(''); setPin(''); setError(''); } }, [visible, removing?.id]);

  const svc = Number(servicePercent || 0) / 100;
  const ajustes = order?.ajustes || [];
  const comped = new Set(ajustes.filter((a) => a.tipo === 'CORTESIA').map((a) => Number(a.detalle_pedido_id)));
  const items = (order?.items || []).filter((i) => Number(i.cantidad) > 0);
  const payable = items.filter((i) => !comped.has(Number(i.id))).reduce((s, i) => s + lineCents(i), 0) - ajustes.filter((a) => a.tipo === 'DESCUENTO').reduce((s, a) => s + cents(a.base), 0);
  // Vista previa (el servidor recalcula y valida con los mismos criterios).
  const preview = useMemo(() => {
    let base = 0;
    if (tipo === 'CORTESIA') { const it = items.find((i) => Number(i.id) === Number(detalle)); base = it ? lineCents(it) : 0; }
    else if (modo === 'porcentaje') base = Math.round(payable * (toNum(valor) || 0) / 100);
    else base = Math.round(cents(toNum(valor) || 0) / (1 + svc));
    return (base + Math.round(base * svc)) / 100;
  }, [tipo, modo, valor, detalle, payable, svc, items]);
  const balance = (cents(order?.saldo_pendiente ?? order?.total) ) / 100;
  const tooMuch = preview > balance + 0.004;
  const needAuth = !canAuthorize;
  const authOk = !needAuth || (correo.trim() && /^\d{4}$/.test(pin));
  const ready = removing ? authOk : preview > 0 && !tooMuch && motivo.trim() && authOk && (tipo !== 'CORTESIA' || detalle);

  const submit = async () => {
    setBusy(true); setError('');
    try {
      const authorization = needAuth ? { correo: correo.trim().toLowerCase(), pin } : undefined;
      if (removing) await onRemove(removing.id, authorization);
      else await onApply({ tipo, ...(tipo === 'CORTESIA' ? { detalle_pedido_id: detalle } : modo === 'porcentaje' ? { porcentaje: toNum(valor) } : { monto: toNum(valor).toFixed(2) }), motivo: motivo.trim(), ...(authorization ? { authorization } : {}) });
      onClose();
    } catch (e) { setError(e.response?.data?.message || e.message || 'No se pudo aplicar.'); }
    finally { setBusy(false); }
  };

  if (removing) return <Dialog c={c} visible={visible} onClose={onClose} busy={busy} icon={Trash2} tone="amber" width={460}
    title={`Quitar ${removing.tipo === 'CORTESIA' ? 'la cortesía' : 'el descuento'}`} subtitle={`La cuenta vuelve a subir ${money(removing.monto)}.`}
    footer={<View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}><Btn c={c} onPress={onClose} disabled={busy}>Cancelar</Btn><Btn c={c} variant="ink" onPress={submit} loading={busy} disabled={!ready}>Quitar</Btn></View>}>
    <T c={c} size={14} color={c.muted}>Motivo original: {removing.motivo}</T>
    {needAuth ? <Authorization c={c} correo={correo} pin={pin} onCorreo={setCorreo} onPin={setPin} /> : null}
    {error ? <T c={c} size={13} color={c.red} accessibilityRole="alert">{error}</T> : null}
  </Dialog>;

  return <Dialog c={c} visible={visible} onClose={onClose} busy={busy} icon={tipo === 'CORTESIA' ? Gift : BadgePercent} width={540}
    title="Descuento o cortesía" subtitle="Baja el total de la cuenta. Queda registrado con su motivo y quién lo autorizó."
    footer={<View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ flex: 1 }}>{preview > 0 ? <T c={c} size={14} color={tooMuch ? c.red : c.muted}>Cuenta <Num c={c} size={14} weight="700">{money(balance)}</Num> → <Num c={c} size={14} weight="800" color={tooMuch ? c.red : c.text}>{money(Math.max(0, balance - preview))}</Num></T> : null}</View>
      <Btn c={c} onPress={onClose} disabled={busy}>Cancelar</Btn>
      <Btn c={c} variant="ink" onPress={submit} loading={busy} disabled={!ready}>{tipo === 'CORTESIA' ? 'Aplicar cortesía' : `Descontar ${money(preview)}`}</Btn>
    </View>}>
    <Seg c={c} label="Tipo" value={tipo} onChange={(v) => { setTipo(v); setMotivo(''); }} options={[{ value: 'DESCUENTO', label: 'Descuento', icon: BadgePercent }, { value: 'CORTESIA', label: 'Cortesía de un plato', icon: Gift }]} />
    {tipo === 'DESCUENTO' ? <View style={{ gap: 10 }}>
      <Seg c={c} size="sm" label="Cómo descontar" value={modo} onChange={(v) => { setModo(v); setValor(''); }} options={[{ value: 'porcentaje', label: 'Porcentaje' }, { value: 'monto', label: 'Monto fijo' }]} />
      {modo === 'porcentaje' ? <View style={{ flexDirection: 'row', gap: 6 }}>{['5', '10', '15', '20'].map((p) => <Btn key={p} c={c} size="sm" style={{ flex: 1 }} variant={valor === p ? 'ink' : 'outline'} onPress={() => setValor(p)}>{`${p} %`}</Btn>)}</View> : null}
      <TextInput value={valor} onChangeText={(v) => setValor(v.replace(',', '.').replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" placeholder={modo === 'porcentaje' ? 'Otro porcentaje' : 'Monto a descontar ($)'} placeholderTextColor={c.faint}
        accessibilityLabel={modo === 'porcentaje' ? 'Porcentaje de descuento' : 'Monto a descontar'} style={inputStyle(c, { fontSize: 20, fontWeight: '700', height: 52 })} />
      <T c={c} size={13} color={c.faint}>{modo === 'porcentaje' ? `Sobre lo que falta cobrar en productos (${money(payable / 100)}), con su parte de servicio.` : 'Es lo que baja la cuenta, servicio incluido.'}</T>
    </View> : <View style={{ borderTopWidth: 1, borderColor: c.text }}>
      {items.map((it) => { const on = Number(detalle) === Number(it.id); const done = comped.has(Number(it.id));
        return <Press key={it.id} accessibilityRole="radio" accessibilityState={{ checked: on, disabled: done }} disabled={done} onPress={() => setDetalle(it.id)} scaleTo={0.99} hoverStyle={{ backgroundColor: c.hover }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 8, borderBottomWidth: 1, borderColor: c.line, backgroundColor: on ? c.paperAlt : 'transparent', opacity: done ? 0.5 : 1 }}>
          <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: on ? 6 : 2, borderColor: on ? c.text : c.rule }} />
          <Num c={c} size={14} weight="700" style={{ width: 28 }}>{it.cantidad}</Num>
          <T c={c} size={14} weight="600" style={{ flex: 1 }} numberOfLines={1}>{it.nombre}{done ? '  · ya es cortesía' : ''}</T>
          <Num c={c} size={14} weight="700">{money(lineCents(it) / 100)}</Num>
        </Press>; })}
    </View>}
    <View style={{ gap: 6 }}>
      <T c={c} size={13} weight="600" color={c.muted}>Motivo</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{REASONS[tipo].map((m) => <Btn key={m} c={c} size="sm" variant={motivo === m ? 'ink' : 'outline'} onPress={() => setMotivo(m)}>{m}</Btn>)}</View>
      <TextInput value={motivo} onChangeText={setMotivo} placeholder="O escribe el motivo" placeholderTextColor={c.faint} maxLength={160} accessibilityLabel="Motivo" style={inputStyle(c)} />
    </View>
    {needAuth ? <Authorization c={c} correo={correo} pin={pin} onCorreo={setCorreo} onPin={setPin} /> : <T c={c} size={13} color={c.green}>Tu usuario puede autorizarlo directamente.</T>}
    {tooMuch ? <T c={c} size={13} color={c.red}>Es más que el saldo de la cuenta ({money(balance)}).</T> : null}
    {error ? <T c={c} size={13} color={c.red} accessibilityRole="alert">{error}</T> : null}
  </Dialog>;
}

// ── Dividir por platos ──────────────────────────────────────────────────────
export function SplitDialog({ c, visible, onClose, order, onSplit }) {
  const { width } = useWindowDimensions();
  const wide = width >= 720;
  const [modo, setModo] = useState('items');
  const [people, setPeople] = useState(['', '']);
  const [assign, setAssign] = useState({});
  const [partes, setPartes] = useState(2);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const units = useMemo(() => (order?.items || []).filter((i) => Number(i.cantidad) > 0).flatMap((it) =>
    Array.from({ length: Number(it.cantidad) }, (_, u) => ({ key: `${it.id}:${u}`, id: Number(it.id), nombre: it.nombre, unit: lineCents({ ...it, cantidad: 1 }), cortesia: !!it.cortesia }))), [order?.id, order?.items]);
  useEffect(() => { if (visible) { setModo('items'); setPeople(['', '']); setAssign({}); setPartes(2); setError(''); } }, [visible, order?.id]);
  const nameOf = (i) => people[i]?.trim() || `Persona ${i + 1}`;
  const owner = (k) => assign[k] ?? 0;
  const total = Number(order?.saldo_pendiente ?? order?.total ?? 0);
  const weights = people.map((_, i) => units.filter((u) => owner(u.key) === i && !u.cortesia).reduce((s, u) => s + u.unit, 0));
  const sumW = weights.reduce((a, b) => a + b, 0) || 1;
  const shares = weights.map((w) => Math.round(total * 100 * w / sumW) / 100);
  const empty = people.map((_, i) => !units.some((u) => owner(u.key) === i));
  const paid = Number(order?.abonado || 0) > 0;
  const ready = !paid && (modo === 'equal' ? partes >= 2 : people.length >= 2 && !empty.some(Boolean) && weights.every((w) => w > 0));

  const submit = async () => {
    setBusy(true); setError('');
    try {
      if (modo === 'equal') await onSplit({ mode: 'equal', partes });
      else {
        const divisions = people.map((_, i) => {
          const counts = new Map();
          for (const u of units) if (owner(u.key) === i) counts.set(u.id, (counts.get(u.id) || 0) + 1);
          return { nombre: nameOf(i), items: [...counts].map(([detalle_pedido_id, cantidad]) => ({ detalle_pedido_id, cantidad })) };
        });
        await onSplit({ mode: 'items', divisions });
      }
      onClose();
    } catch (e) { setError(e.response?.data?.message || e.message || 'No se pudo dividir.'); }
    finally { setBusy(false); }
  };

  return <Dialog c={c} visible={visible} onClose={onClose} busy={busy} icon={Split} width={760}
    title="Dividir la cuenta" subtitle="Cada parte se cobra por separado con «Cobrar esta parte»."
    footer={<View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}><Btn c={c} onPress={onClose} disabled={busy}>Cancelar</Btn>
      <Btn c={c} variant="ink" icon={Split} onPress={submit} loading={busy} disabled={!ready}>{modo === 'equal' ? `Dividir en ${partes}` : `Dividir entre ${people.length}`}</Btn></View>}>
    {paid ? <T c={c} size={14} color={c.amber}>Esta cuenta ya tiene abonos: para seguir cobrándola por partes usa «Abono parcial».</T> : null}
    <Seg c={c} size="sm" label="Cómo dividir" value={modo} onChange={setModo} options={[{ value: 'items', label: 'Por platos' }, { value: 'equal', label: 'En partes iguales' }]} />
    {modo === 'equal' ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <T c={c} size={15} weight="600">Partes</T>
      <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: c.rule, borderRadius: r.md }}>
        <IconBtn c={c} icon={Minus} label="Una parte menos" onPress={() => setPartes((n) => Math.max(2, n - 1))} disabled={partes <= 2} />
        <Num c={c} size={18} weight="800" style={{ minWidth: 32, textAlign: 'center' }}>{partes}</Num>
        <IconBtn c={c} icon={Plus} label="Una parte más" onPress={() => setPartes((n) => Math.min(20, n + 1))} />
      </View>
      <T c={c} size={14} color={c.muted}>≈ {money(total / partes)} cada una</T>
    </View> : <>
      <Cells c={c}>
        {people.map((p, i) => <Cell key={i} c={c} label={`Persona ${i + 1}`} basis={wide ? `${Math.floor(100 / Math.min(people.length, 4))}%` : '50%'}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <TextInput value={p} onChangeText={(v) => setPeople((old) => old.map((x, j) => j === i ? v.slice(0, 40) : x))} placeholder={`Persona ${i + 1}`} placeholderTextColor={c.faint} accessibilityLabel={`Nombre de la persona ${i + 1}`}
              style={[{ flex: 1, minWidth: 0, fontFamily: FONT, fontSize: 15, fontWeight: '600', color: c.text, paddingVertical: 2 }, WEB ? { outlineStyle: 'none' } : null]} />
            {people.length > 2 ? <IconBtn c={c} icon={X} label={`Quitar a ${nameOf(i)}`} size={28} onPress={() => { setPeople((old) => old.filter((_, j) => j !== i)); setAssign((old) => Object.fromEntries(Object.entries(old).map(([k, v]) => [k, v === i ? 0 : v > i ? v - 1 : v]))); }} /> : null}
          </View>
          <Num c={c} size={16} weight="800" color={empty[i] ? c.faint : c.text}>{empty[i] ? 'Sin platos' : money(shares[i])}</Num>
        </Cell>)}
      </Cells>
      <Btn c={c} size="sm" variant="ghost" icon={Plus} onPress={() => setPeople((old) => old.length < 12 ? [...old, ''] : old)} style={{ alignSelf: 'flex-start' }}>Agregar persona</Btn>
      <View style={{ borderTopWidth: 1, borderColor: c.text }}>
        <Lbl c={c} style={{ paddingVertical: 6 }}>Toca a quién le toca cada plato</Lbl>
        {units.map((u) => <View key={u.key} style={{ flexDirection: wide ? 'row' : 'column', alignItems: wide ? 'center' : 'stretch', gap: 8, paddingVertical: 8, borderTopWidth: 1, borderColor: c.line }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, width: wide ? 260 : undefined }}>
            <T c={c} size={14} weight="600" style={{ flex: 1 }} numberOfLines={1}>{u.nombre}</T>
            <Num c={c} size={13} weight="600" color={c.muted}>{u.cortesia ? 'Cortesía' : money(u.unit / 100)}</Num>
          </View>
          <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {people.map((_, i) => { const on = owner(u.key) === i; return <Press key={i} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={`${u.nombre} para ${nameOf(i)}`}
              onPress={() => setAssign((old) => ({ ...old, [u.key]: i }))} scaleTo={0.97} hoverStyle={on ? null : { backgroundColor: c.hover }}
              style={{ minHeight: 36, paddingHorizontal: 10, borderRadius: r.md, justifyContent: 'center', borderWidth: 1, borderColor: on ? 'transparent' : c.rule, backgroundColor: on ? (c.isDark ? c.onInk : c.ink) : c.paper }}>
              <T c={c} size={13} weight={on ? '700' : '600'} color={on ? (c.isDark ? c.ink : c.onInk) : c.muted} numberOfLines={1}>{nameOf(i)}</T>
            </Press>; })}
          </View>
        </View>)}
      </View>
      <T c={c} size={13} color={c.faint}>Los importes son aproximados: el servicio se reparte en proporción y el servidor ajusta los centavos.</T>
    </>}
    {error ? <T c={c} size={13} color={c.red} accessibilityRole="alert">{error}</T> : null}
  </Dialog>;
}
