// Salón del mesero (dirección «Comanda»): cuadrícula densa, estado por forma, «Atender ahora» primero.
import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { BellRing, Grid2X2, Grid3X3, RefreshCw, Search } from 'lucide-react-native';
import { useTheme } from '../theme';
import { serviceRounds } from '../utils/serviceTiming.mjs';
import { Appear, Button, Chip, EmptyState, IconButton, Label, Num, T, space } from './waiter/comanda';
import { AttentionStrip, SearchToggle, TableTile, ZoneTabs, minutesSince } from './waiter/salon';

const FILTERS = [['Todas', 'Todas'], ['Disponibles', 'Libres'], ['Ocupadas', 'Ocupadas'], ['Cuenta', 'Por cobrar'], ['Reservadas', 'Reservadas']];

export default function WaiterFloor({ width, groups, counts, search, setSearch, filter, setFilter, compact, setCompact, selected, selectTable, stateFor, orderFor, zones, zone, setZone, refresh, refreshing, loadError, now, alerts, reservations = {}, onLongPressTable, openTray, readyCount = 0 }) {
  const { c } = useTheme();
  const [measuredWidth, setMeasuredWidth] = useState(null);
  const measure = useCallback(event => {
    const next = event.nativeEvent.layout.width;
    if (next > 0) setMeasuredWidth(previous => previous === next ? previous : next);
  }, []);
  const layoutWidth = Math.min(width, measuredWidth ?? width);
  const padding = layoutWidth < 600 ? 12 : layoutWidth >= 1024 ? 28 : 20;
  const gap = layoutWidth < 600 ? 8 : 10;
  const available = Math.max(0, layoutWidth - padding * 2);
  // Celular: 3 columnas (2 si la pantalla es muy estrecha). Tableta y escritorio: tantas como quepan.
  const minTile = layoutWidth < 600 ? (compact ? 84 : 100) : compact ? 108 : 128;
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
      if (ready) {
        const oldest = serviceRounds(order).filter(r => r.estado === 'LISTO').map(r => minutesSince(r.listo_at || r.created_at, now)).filter(m => m != null).sort((a, b) => b - a)[0];
        items.push({ key: `r${mesa.id}`, mesa, tone: 'ready', rank: 0, title: `Mesa ${mesa.numero}`, detail: `${ready > 1 ? `${ready} rondas listas` : 'Ronda lista'}${oldest ? ` · ${oldest}'` : ''}`, order: oldest ?? 0 });
      } else if (lateByTable[mesa.id]) {
        items.push({ key: `d${mesa.id}`, mesa, tone: 'late', rank: 1, title: `Mesa ${mesa.numero}`, detail: `Cocina · ${lateByTable[mesa.id].minutos}' esperando`, order: lateByTable[mesa.id].minutos });
      } else if (state === 'Cuenta') {
        items.push({ key: `c${mesa.id}`, mesa, tone: 'bill', rank: 2, title: `Mesa ${mesa.numero}`, detail: 'Pidió la cuenta', order: minutesSince(order?.cuenta_solicitada_at, now) ?? 0 });
      }
    }
    return items.sort((a, b) => a.rank - b.rank || b.order - a.order);
  }, [allMesas, orderFor, stateFor, lateByTable, now, readyFor]);

  const summary = `${counts.Disponibles} ${counts.Disponibles === 1 ? 'libre' : 'libres'} de ${counts.Todas} mesas`;
  return <View onLayout={measure} style={{ minWidth: 0, paddingHorizontal: padding, paddingTop: space.md, paddingBottom: space.x3 }}>
    {/* Cabecera compacta: resumen + bandeja + búsqueda + densidad + actualizar */}
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 48, marginBottom: space.sm }}>
      {!search ? <View style={{ flex: 1, minWidth: 0 }}>
        <Label color={c.muted}>Salón</Label>
        <T size={15} weight="600" numberOfLines={1}>{summary}</T>
      </View> : null}
      <SearchToggle value={search} onChange={setSearch} />
      <IconButton icon={compact ? Grid2X2 : Grid3X3} label={compact ? 'Casillas normales' : 'Casillas compactas'} onPress={() => setCompact(!compact)} />
      <IconButton icon={RefreshCw} label="Actualizar mesas" disabled={refreshing} color={refreshing ? c.faint : c.text} onPress={refresh} />
    </View>

    {loadError ? <Appear><View style={{ borderWidth: 1.5, borderColor: c.red, borderRadius: 4, padding: space.md, marginBottom: space.md, flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
      <T size={14} weight="600" color={c.red} style={{ flex: 1 }}>No se pudieron actualizar las mesas. Lo que ves puede estar desactualizado.</T>
      <Button size="sm" variant="danger" onPress={refresh}>Reintentar</Button>
    </View></Appear> : null}

    <AttentionStrip items={attention} onOpen={it => selectTable(it.mesa)} />

    <ScrollView horizontal style={{ flexGrow: 0 }} showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingBottom: space.sm }}>
      {FILTERS.map(([key, label]) => <Chip key={key} selected={filter === key} onPress={() => setFilter(key)} count={counts[key]} accessibilityLabel={`${label}: ${counts[key]}`}>{label}</Chip>)}
    </ScrollView>

    {zones.length > 1 ? <View style={{ marginBottom: space.xs }}><ZoneTabs zones={['Todas', ...zones]} value={zone} onChange={setZone} /></View> : null}

    {!groups.length ? <EmptyState icon={Search} title={counts.Todas ? 'Ninguna mesa con estos filtros' : 'Todavía no hay mesas'}
      description={counts.Todas ? undefined : 'Configura las mesas desde administración.'}
      action={counts.Todas ? <Button onPress={clear}>Limpiar filtros</Button> : null} /> : null}

    {groups.map(group => <View key={group.name} style={{ marginTop: space.md }}>
      {groups.length > 1 || zone === 'Todas' ? <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.sm, marginBottom: space.sm }}>
        <Label color={c.text}>{group.name}</Label><Num size={13} color={c.muted}>{group.mesas.length}</Num>
      </View> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>
        {group.mesas.map(mesa => {
          const order = orderFor(mesa.id);
          return <TableTile key={mesa.id} mesa={mesa} state={stateFor(mesa)} order={order} width={tileWidth} now={now}
            selected={Number(mesa.id) === Number(selected)} ready={readyFor(order)} alert={lateByTable[mesa.id]} reservation={reservations[mesa.id]}
            onPress={selectTable} onLongPress={onLongPressTable} />;
        })}
      </View>
    </View>)}
    {groups.length ? <T size={13} color={c.faint} style={{ textAlign: 'center', marginTop: space.xl }}>Mantén presionada una mesa para acciones rápidas</T> : null}
  </View>;
}
