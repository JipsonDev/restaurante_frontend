import React, { useCallback, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Grid2X2, MapPin, RefreshCw, Search, X } from 'lucide-react-native';
import WaiterTableCard from './WaiterTableCard';
import { tableStatusMeta } from '../theme';

const font = Platform.OS === 'web' ? { fontFamily: 'Manrope, "Segoe UI", system-ui, sans-serif' } : {};
const Label = ({ style, ...props }) => <Text {...props} style={[font, style]} />;
const filters = [['Todas', null], ['Disponibles', 'Libre'], ['Ocupadas', 'Ocupada'], ['Cuenta', 'Cuenta'], ['Reservadas', 'Reservada']];

export default function WaiterFloor({ colors: c, width, groups, counts, search, setSearch, filter, setFilter, compact, setCompact, selected, selectTable, stateFor, orderFor, zones, zone, setZone, refresh, refreshing, loadError, now, alerts }) {
  const [measuredWidth, setMeasuredWidth] = useState(null);
  const measure = useCallback(event => {
    const next = event.nativeEvent.layout.width;
    if (next > 0) setMeasuredWidth(previous => previous === next ? previous : next);
  }, []);
  // A scroll bar, embedded panel or browser zoom can make this narrower than the window.
  const layoutWidth = Math.min(width, measuredWidth ?? width);
  const padding = layoutWidth < 768 ? 16 : layoutWidth >= 1024 ? 32 : 24;
  const gap = layoutWidth < 768 ? 10 : 14;
  const available = Math.max(0, layoutWidth - padding * 2);
  const columns = Math.max(1, Math.min(8, Math.floor((available + gap) / ((layoutWidth < 600 ? 132 : compact ? 140 : 156) + gap))));
  // RN Web rounds layout measurements. Reserve one CSS pixel so fractional zoom
  // cannot make an apparently exact row overflow by a fraction of a pixel.
  const cardWidth = Math.max(0, Math.floor((available - gap * (columns - 1) - 1) / columns));
  const clear = () => { setSearch(''); setFilter('Todas'); setZone('Todas'); };
  const button = { minHeight: 44, minWidth: 44, borderRadius: 6, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.line, backgroundColor: c.surface };
  return <View onLayout={measure} style={{ minWidth: 0, padding, paddingTop: 20 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 }}>
      <View style={{ flex: 1 }}><Label style={{ fontSize: layoutWidth < 600 ? 23 : 27, color: c.ink, fontWeight: '500' }}>Salón y mesas</Label><Label style={{ color: c.muted, fontSize: 12, marginTop: 5 }}>{counts.Disponibles} disponibles · {counts.Todas} mesas en total</Label></View>
      <Pressable accessibilityRole="button" accessibilityLabel="Actualizar mesas" accessibilityState={{ busy: refreshing }} disabled={refreshing} onPress={refresh} style={button}><RefreshCw size={18} color={refreshing ? c.faint : c.muted} /></Pressable>
    </View>
    {loadError ? <View style={{ borderLeftWidth: 2, borderLeftColor: c.danger, padding: 12, backgroundColor: c.surface, marginBottom: 12 }}><Label style={{ color: c.danger, fontSize: 12 }}>No se pudieron actualizar los datos. Comprueba la conexión y pulsa actualizar.</Label></View> : null}
    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
      <View style={{ ...button, flex: 1, flexDirection: 'row', gap: 10, paddingHorizontal: 12 }}>
        <Search size={17} color={c.muted} /><TextInput value={search} onChangeText={setSearch} placeholder="Buscar mesa o ubicación" placeholderTextColor={c.muted} accessibilityLabel="Buscar mesa por número o ubicación" style={{ ...font, minWidth: 0, flex: 1, color: c.ink, fontSize: 13, paddingVertical: 10 }} />
        {search ? <Pressable accessibilityRole="button" accessibilityLabel="Limpiar búsqueda de mesas" onPress={() => setSearch('')} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', marginVertical: -1, marginRight: -12 }}><X size={16} color={c.muted} /></Pressable> : null}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={compact ? 'Usar plano de mesas' : 'Usar vista compacta de mesas'} accessibilityState={{ selected: compact }} onPress={() => setCompact(!compact)} style={{ ...button, borderColor: compact ? c.brand : c.line }}><Grid2X2 size={18} color={compact ? c.brand : c.muted} /></Pressable>
    </View>
    <ScrollView horizontal style={{ flexGrow: 0 }} showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 12 }}>
      {filters.map(([key, state]) => {
        const active = filter === key;
        const meta = state ? tableStatusMeta(state, c.isDark) : null;
        return <Pressable key={key} accessibilityRole="button" accessibilityLabel={`${key === 'Cuenta' ? 'Por cobrar' : key}: ${counts[key]}`} accessibilityState={{ selected: active }} onPress={() => setFilter(key)} style={{ ...button, flexDirection: 'row', gap: 7, paddingHorizontal: 12, borderColor: active ? c.brand : c.line, backgroundColor: active ? c.softOrange : c.surface }}>
          {meta ? <View style={{ height: 6, width: 6, borderRadius: 3, backgroundColor: meta.dot }} /> : null}
          <Label style={{ fontSize: 12, color: active ? (c.isDark ? c.brand : '#80530B') : c.muted }}>{key === 'Cuenta' ? 'Por cobrar' : key}</Label><Label style={{ fontSize: 11, color: c.muted }}>{counts[key]}</Label>
        </Pressable>;
      })}
    </ScrollView>
    {zones.length > 1 ? <ScrollView horizontal style={{ flexGrow: 0, borderBottomWidth: 1, borderBottomColor: c.line, marginBottom: 4 }} contentContainerStyle={{ gap: 16 }} showsHorizontalScrollIndicator={false}>
      {['Todas', ...zones].map(name => <Pressable key={name} accessibilityRole="button" accessibilityState={{ selected: zone === name }} onPress={() => setZone(name)} style={{ minHeight: 44, justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: zone === name ? c.brand : 'transparent' }}><Label style={{ color: zone === name ? c.ink : c.muted, fontSize: 12 }}>{name === 'Todas' ? 'Todas las zonas' : name}</Label></Pressable>)}
    </ScrollView> : null}
    {!groups.length ? <View style={{ paddingVertical: 38, gap: 12, alignItems: 'center' }}><Search size={24} color={c.muted} /><Label style={{ color: c.ink, textAlign: 'center', fontSize: 14 }}>{counts.Todas ? 'No hay mesas con estos filtros' : 'Todavía no hay mesas configuradas'}</Label>{counts.Todas ? <Pressable accessibilityRole="button" onPress={clear} style={{ ...button, paddingHorizontal: 18 }}><Label style={{ color: c.ink, fontSize: 12 }}>Limpiar filtros</Label></Pressable> : <Label style={{ color: c.muted, fontSize: 12 }}>Configura las mesas desde administración.</Label>}</View> : null}
    {groups.map(group => <View key={group.name} style={{ marginTop: 16, marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', gap: 7, alignItems: 'center', marginBottom: 12 }}><MapPin size={14} color={c.muted} /><Label style={{ color: c.ink, fontSize: 13 }}>{group.name}</Label><Label style={{ color: c.muted, fontSize: 11 }}>{group.mesas.length} mesas</Label></View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>{group.mesas.map(mesa => <WaiterTableCard key={mesa.id} mesa={mesa} order={orderFor(mesa.id)} meta={tableStatusMeta(stateFor(mesa), c.isDark)} colors={c} selected={Number(mesa.id) === Number(selected)} onPress={selectTable} cardWidth={cardWidth} compact={compact} now={now} alerts={alerts} />)}</View>
    </View>)}
  </View>;
}
