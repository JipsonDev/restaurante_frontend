// Salón del mesero (dirección «Suave»): «Atender ahora» primero, una sola fila de filtros de estado
// (las zonas son títulos de sección, no pestañas) y tarjetas de mesa.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { Search } from 'lucide-react-native';
import { useTheme } from '../theme';
import { serviceRounds } from '../utils/serviceTiming.mjs';
import { Appear, Button, Chip, EmptyState, Num, T, haptic, radius, space, useComandaToast } from './waiter/comanda';
import { minutesUntil, timeOf } from '../utils/reservationLogic.mjs';
import { CalendarClock } from 'lucide-react-native';
import { AlertsBanner, AttentionStrip, SearchToggle, TableTile, minutesSince } from './waiter/salon';
import { InstallBanner } from './waiter/install';

const FILTERS = [['Todas', 'Todas'], ['Disponibles', 'Libres'], ['Ocupadas', 'Ocupadas'], ['Cuenta', 'Por cobrar'], ['Reservadas', 'Reservadas']];

export default function WaiterFloor({ width, groups, counts, search, setSearch, filter, setFilter, compact, setCompact, selected, selectTable, stateFor, orderFor, zones, zone, setZone, refresh, refreshing, loadError, offline, now, alerts, reservations = {}, queued = {}, alertsPrompt, onLongPressTable, openTray, readyCount = 0 }) {
  const { c } = useTheme();
  const [measuredWidth, setMeasuredWidth] = useState(null);
  const measure = useCallback(event => {
    const next = event.nativeEvent.layout.width;
    if (next > 0) setMeasuredWidth(previous => previous === next ? previous : next);
  }, []);
  const layoutWidth = Math.min(width, measuredWidth ?? width);
  const phone = layoutWidth < 600;
  const padding = phone ? 12 : layoutWidth >= 1024 ? 28 : 20;
  const gap = layoutWidth < 600 ? 10 : 12;
  const available = Math.max(0, layoutWidth - padding * 2);
  // Celular: 3 columnas (2 si la pantalla es muy estrecha). Tableta y escritorio: tantas como quepan.
  const minTile = layoutWidth < 600 ? 100 : 140;
  const columns = Math.max(2, Math.min(10, Math.floor((available + gap) / (minTile + gap))));
  const tileWidth = Math.max(0, Math.floor((available - gap * (columns - 1) - 1) / columns));
  const clear = () => { setSearch(''); setFilter('Todas'); setZone('Todas'); };

  const allMesas = useMemo(() => groups.flatMap(g => g.mesas), [groups]);
  const lateByTable = useMemo(() => {
    const out = {};
    for (const a of alerts?.items || []) if (a.mesa_id != null && a.tipo !== 'lista') out[a.mesa_id] = a;
    return out;
  }, [alerts?.items]);
  const readyFor = useCallback(order => order ? serviceRounds(order).filter(r => r.estado === 'LISTO').length : 0, []);

  // Lo urgente primero: rondas listas, demoras de cocina y cuentas pedidas.
  const attention = useMemo(() => {
    const items = [];
    for (const mesa of allMesas) {
      const order = orderFor(mesa.id);
      const ready = readyFor(order);
      const state = stateFor(mesa);
      const res = reservations[mesa.id];
      const resIn = res ? minutesUntil(res) : null;
      // Reserva en menos de 15 min y la mesa sigue ocupada: hay que liberarla o reubicar.
      if (res && resIn != null && resIn <= 15 && resIn >= -15 && (state === 'Ocupada' || state === 'Cuenta')) {
        items.push({ key: `v${mesa.id}`, mesa, tone: 'reserve', clash: true, rank: -1, title: `Mesa ${mesa.numero}`, detail: `Reserva ${timeOf(res.fecha_hora)}${res.cliente_nombre ? ` · ${res.cliente_nombre}` : ''} · ocupada`, order: -resIn });
      } else if (res && resIn != null && resIn <= 15 && resIn >= -15) {
        // Mesa libre con la reserva por llegar: que el mesero la tenga lista.
        items.push({ key: `s${mesa.id}`, mesa, tone: 'reserve', rank: 3, title: `Mesa ${mesa.numero}`, detail: `${res.cliente_nombre || 'Reserva'} · ${resIn > 0 ? `llega en ${resIn} min` : resIn === 0 ? 'llega ahora' : `${-resIn} min tarde`}`, order: -resIn });
      }
      if (ready) {
        const oldest = serviceRounds(order).filter(r => r.estado === 'LISTO').map(r => minutesSince(r.listo_at || r.created_at, now)).filter(m => m != null).sort((a, b) => b - a)[0];
        items.push({ key: `r${mesa.id}`, mesa, tone: 'ready', rank: 0, title: `Mesa ${mesa.numero}`, detail: `${ready > 1 ? `${ready} rondas listas` : 'Ronda lista'}${oldest ? ` · ${oldest} min` : ''}`, order: oldest ?? 0 });
      } else if (lateByTable[mesa.id]) {
        items.push({ key: `d${mesa.id}`, mesa, tone: 'late', rank: 1, title: `Mesa ${mesa.numero}`, detail: `Cocina · ${lateByTable[mesa.id].minutos} min esperando`, order: lateByTable[mesa.id].minutos });
      } else if (state === 'Cuenta') {
        items.push({ key: `c${mesa.id}`, mesa, tone: 'bill', rank: 2, title: `Mesa ${mesa.numero}`, detail: 'Pidió la cuenta', order: minutesSince(order?.cuenta_solicitada_at, now) ?? 0 });
      }
    }
    return items.sort((a, b) => a.rank - b.rank || b.order - a.order);
  }, [allMesas, orderFor, stateFor, lateByTable, now, readyFor, reservations]);

  // Aviso único (con vibración) cuando aparece un choque de reserva nuevo.
  const toast = useComandaToast();
  const warned = useRef(new Set());
  useEffect(() => {
    for (const it of attention) {
      if (!it.clash || warned.current.has(it.key)) continue;
      warned.current.add(it.key);
      haptic('warning');
      toast.show(`${it.title}: reserva pronto y sigue ocupada`, { tone: 'warning', icon: CalendarClock, detail: it.detail.replace(/ · ocupada$/, ''), action: { label: 'Ver', onPress: () => selectTable(it.mesa) } });
    }
  }, [attention]);

  const summary = `${counts.Disponibles} ${counts.Disponibles === 1 ? 'libre' : 'libres'} de ${counts.Todas} mesas`;
  return <View onLayout={measure} style={{ minWidth: 0, paddingHorizontal: padding, paddingTop: space.md, paddingBottom: space.x3 }}>
    {/* Cabecera compacta: resumen + bandeja + búsqueda + densidad + actualizar */}
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 48, marginBottom: phone ? space.sm : space.lg }}>
      {!search ? <View style={{ flex: 1, minWidth: 0 }}>
        <T size={phone ? 22 : 28} weight="800" accessibilityRole="header">Mesas</T>
        <T size={13} weight="600" color={c.muted} numberOfLines={1}>{summary}</T>
      </View> : null}
      <SearchToggle value={search} onChange={setSearch} />
    </View>

    {loadError && !offline ? <Appear><View style={{ borderRadius: radius.lg, backgroundColor: c.redSoft, padding: space.md, paddingLeft: space.lg, marginBottom: space.md, flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
      <T size={14} weight="600" color={c.red} style={{ flex: 1 }}>No se pudieron actualizar las mesas. Lo que ves puede estar desactualizado.</T>
      <Button size="sm" variant="primary" onPress={refresh}>Reintentar</Button>
    </View></Appear> : null}

    <InstallBanner />
    <AlertsBanner visible={!!alertsPrompt?.visible} onEnable={alertsPrompt?.enable} onDismiss={alertsPrompt?.dismiss} />

    <AttentionStrip items={attention} onOpen={it => selectTable(it.mesa)} />

    {/* Filtros de estado: todos a la vista. Si no caben en una línea bajan a la siguiente (nada queda escondido).
        Los filtros sin mesas se ocultan (salvo el activo). */}
    <View accessibilityRole="tablist" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.md }}>
      {FILTERS.filter(([key]) => key === 'Todas' || key === filter || counts[key] > 0).map(([key, label]) =>
        <Chip key={key} selected={filter === key} onPress={() => setFilter(key)} count={counts[key]} accessibilityLabel={`${label}: ${counts[key]}`}>{label}</Chip>)}
    </View>

    {!groups.length ? <EmptyState icon={Search} title={counts.Todas ? 'Ninguna mesa con estos filtros' : 'Todavía no hay mesas'}
      description={counts.Todas ? undefined : 'Configura las mesas desde administración.'}
      action={counts.Todas ? <Button onPress={clear}>Limpiar filtros</Button> : null} /> : null}

    {groups.map(group => <View key={group.name} style={{ marginTop: phone ? space.md : space.lg }}>
      {groups.length ? <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.sm, marginBottom: space.sm }}>
        <T size={17} weight="800">{group.name}</T><Num size={14} weight="600" color={c.faint}>{group.mesas.length}</Num>
      </View> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>
        {group.mesas.map(mesa => {
          const order = orderFor(mesa.id);
          return <TableTile key={mesa.id} mesa={mesa} state={stateFor(mesa)} order={order} width={tileWidth} now={now}
            selected={Number(mesa.id) === Number(selected)} ready={readyFor(order)} alert={lateByTable[mesa.id]} reservation={reservations[mesa.id]}
            held={!order && reservations.held ? reservations.held(mesa.id) : null} queued={queued[mesa.id]}
            onPress={selectTable} onLongPress={onLongPressTable} />;
        })}
      </View>
    </View>)}

  </View>;
}
