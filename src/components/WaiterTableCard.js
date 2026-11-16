import React, { memo } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import Svg, { G, Rect, Text as SvgText } from 'react-native-svg';
import { ArrowUpRight, Check, Users } from 'lucide-react-native';
import { tableLayout } from '../utils/tableLayout.mjs';
import { ServiceWait } from './ServiceTiming';
import { serviceSummaryLabel } from '../utils/serviceTiming.mjs';

const fontFamily = Platform.select({ web: 'Manrope, "Segoe UI", system-ui, sans-serif', ios: 'System', android: 'sans-serif' });
const Label = ({ style, ...props }) => <Text {...props} style={[{ fontFamily }, style]} />;

// A top-down seating plan, without WebGL contexts or perspective.
export function TableGraphic({ capacity, number, meta, height = 112 }) {
  const layout = tableLayout(capacity);
  return <Svg width="100%" height={height} viewBox={`0 0 ${layout.viewWidth} ${layout.viewHeight}`} {...(Platform.OS === 'web' ? { 'aria-hidden': true } : { accessible: false })}>
    {layout.seats.map((seat, index) => <G key={index} transform={`translate(${seat.x} ${seat.y}) rotate(${seat.rotation})`}>
      <Rect x={-10} y={-9} width={20} height={15} rx={4} fill={meta.bg} stroke={meta.dot} strokeOpacity={0.65} strokeWidth={1.5} />
      <Rect x={-8} y={-10} width={16} height={3} rx={1.5} fill={meta.dot} />
    </G>)}
    <Rect x={layout.x} y={layout.y} width={layout.width} height={layout.height} rx={layout.round ? 42 : 12} fill={meta.bg} stroke={meta.dot} strokeWidth={1.8} />
    <SvgText x={layout.x + layout.width / 2} y={layout.y + layout.height / 2 + 9} textAnchor="middle" fontSize={Math.max(27, layout.viewWidth * 0.17)} fontWeight="500" fill={meta.text}>{number}</SvgText>
  </Svg>;
}

export default memo(function WaiterTableCard({ mesa, meta, selected, onPress, cardWidth, colors: c, compact, order, now, alerts }) {
  const { capacity } = tableLayout(mesa.capacidad);
  const capacityLabel = capacity === null ? 'Capacidad sin definir' : `${capacity} ${capacity === 1 ? 'plaza' : 'plazas'}`;
  const balance = Number(order?.saldo_pendiente ?? Math.max(0, Number(order?.total || 0) - Number(order?.abonado || 0)));
  return <Pressable
    accessibilityRole="button" accessibilityLabel={`Mesa ${mesa.numero}, ${meta.label}, ${capacityLabel}${order ? `, saldo $${balance.toFixed(2)}, ${serviceSummaryLabel(order, now)}` : ''}`}
    accessibilityState={{ selected }} accessibilityHint="Abre la mesa para gestionar su pedido"
    onPress={() => onPress(mesa)}
    style={({ pressed, hovered }) => ({ width: cardWidth, padding: compact ? 10 : 12, borderRadius: 8, borderWidth: 1,
      backgroundColor: pressed || hovered ? c.elevated : c.surface, borderColor: selected ? c.brand : c.line })}>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
      <Label numberOfLines={1} style={{ color: c.ink, fontSize: 13, fontWeight: '500', flex: 1 }}>Mesa {mesa.numero}</Label>
      {selected ? <Check size={15} color={c.brand} /> : <ArrowUpRight size={14} color={c.muted} />}
    </View>
    {!compact ? <View pointerEvents="none" style={{ marginVertical: 3 }}><TableGraphic capacity={mesa.capacidad} number={mesa.numero} meta={meta} /></View> : null}
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: compact ? 14 : 0 }}>
      <View style={{ height: 6, width: 6, borderRadius: 3, backgroundColor: meta.dot }} />
      <Label numberOfLines={1} style={{ color: meta.text, fontSize: 12, flex: 1 }}>{meta.label}</Label>
    </View>
    {order ? <View style={{ marginTop: 9 }}><ServiceWait order={order} now={now} colors={c} compact alerts={alerts} /></View> : null}
    <View style={{ borderTopWidth: 1, borderTopColor: c.line, paddingTop: 9, marginTop: 10, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5 }}>
      <Users size={13} color={c.muted} /><Label style={{ color: c.muted, fontSize: 11 }}>{capacityLabel}</Label>
      {order ? <Label style={{ color: c.ink, fontSize: 12, marginLeft: 'auto', fontVariant: ['tabular-nums'] }}>${balance.toFixed(2)}</Label> : null}
    </View>
  </Pressable>;
});
