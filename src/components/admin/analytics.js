// Piezas de analítica del panel (Resumen y Reportes), estilo admin de comercio:
// tarjeta de métricas en fila, barras y línea en azul con lectura al pasar el cursor,
// reparto apilado y ranking. Todo vive dentro de tarjetas del kit.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';
import { useTheme } from '../../theme';
import { AnimatedNumber, EASE_OUT, Press, Skeleton, money, reduceMotion, space, type } from './ui';

const WEB = Platform.OS === 'web';
// Paleta categórica validada (scripts/validate_palette.js, modo claro): azul, ámbar, verde, violeta, rojo.
export const SERIES = ['#2C6ECB', '#E8A400', '#29845A', '#8C5BD3', '#D94F3D'];
const tipBox = { position: 'absolute', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#303030', zIndex: 3, ...(WEB ? { boxShadow: '0 4px 12px rgba(0,0,0,0.2)' } : {}) };

// Tarjeta de métricas: celdas separadas por líneas; 4 en fila en escritorio, 2×2 en celular.
// items: { label, value, format?, note?, noteTone?, onPress?, loading? }
export function MetricsCard({ items, loading }) {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const cols = width < 700 ? 2 : items.length;
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', backgroundColor: c.surface, borderRadius: 12, overflow: 'hidden',
    ...(WEB ? { boxShadow: c.isDark ? `0 0 0 1px ${c.line}` : '0 1px 0 0 rgba(26,26,26,0.07), inset 0 1px 0 0 rgba(204,204,204,0.5), inset 0 -1px 0 0 rgba(0,0,0,0.17), inset -1px 0 0 0 rgba(0,0,0,0.13), inset 1px 0 0 0 rgba(0,0,0,0.13)' } : { borderWidth: 1, borderColor: c.line }) }}>
    {items.map((m, i) => {
      const noteColor = m.noteTone === 'green' ? c.green : m.noteTone === 'red' ? c.red : c.muted;
      const body = <>
        <Text numberOfLines={1} style={[type.body, { color: c.muted, fontWeight: '500' }]}>{m.label}</Text>
        {loading ? <Skeleton width={90} height={22} style={{ marginVertical: 3 }} />
          : typeof m.value === 'number' ? <AnimatedNumber value={m.value} format={m.format} numberOfLines={1} style={[type.figure, { fontSize: 20, lineHeight: 28, color: c.text }]} />
            : <Text numberOfLines={1} style={[type.figure, { fontSize: 20, lineHeight: 28, color: c.text }]}>{m.value}</Text>}
        {m.note ? <Text numberOfLines={1} style={[type.small, { color: noteColor }]}>{m.note}</Text> : <Text style={type.small}> </Text>}
      </>;
      const cell = { width: `${100 / cols}%`, paddingHorizontal: space.lg, paddingVertical: space.md, gap: 2,
        borderLeftWidth: i % cols ? 1 : 0, borderTopWidth: i >= cols ? 1 : 0, borderColor: c.line };
      return m.onPress
        ? <Press key={m.label} accessibilityRole="button" accessibilityLabel={`${m.label}, ver detalle`} onPress={m.onPress} scaleTo={1} style={cell} hoverStyle={{ backgroundColor: c.surfaceAlt }}>{body}</Press>
        : <View key={m.label} style={cell}>{body}</View>;
    })}
  </View>;
}

// Barras verticales de una serie. Crecen al cargar; al pasar el cursor (o tocar) se resalta una y muestra su valor.
export function BarChart({ data, valueOf, labelOf, height = 180, format = money, highlight }) {
  const { c } = useTheme();
  const [hover, setHover] = useState(null);
  const grow = useRef(new Animated.Value(0)).current;
  const max = Math.max(...data.map(valueOf), 1);
  useEffect(() => {
    grow.setValue(reduceMotion() ? 1 : 0);
    if (!reduceMotion()) Animated.timing(grow, { toValue: 1, duration: 420, easing: EASE_OUT, useNativeDriver: false }).start();
  }, [data.length, max]);
  const step = data.length > 31 ? Math.ceil(data.length / 8) : data.length > 14 ? 3 : 1;
  const gap = data.length > 40 ? 2 : data.length > 16 ? 3 : 6;
  const plot = height - 24;
  return <View>
    <View style={{ height, flexDirection: 'row', alignItems: 'flex-end', gap }}>
      {[0, 0.5, 1].map(l => <View key={l} pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: plot * l, height: 1, backgroundColor: c.line, opacity: l ? 0.6 : 1 }} />)}
      <Text pointerEvents="none" style={[type.small, type.num, { position: 'absolute', left: 0, top: 0, color: c.faint }]}>{format(max)}</Text>
      {data.map((d, i) => {
        const v = valueOf(d); const h = Math.max(v > 0 ? 3 : 0, (v / max) * plot);
        const active = hover === i; const mark = highlight?.(d);
        return <Pressable key={i} accessibilityLabel={`${labelOf(d, true)}: ${format(v)}`} onHoverIn={() => setHover(i)} onHoverOut={() => setHover(null)} onPressIn={() => setHover(i)} onPressOut={() => setHover(null)}
          style={{ flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center' }}>
          {active ? <View pointerEvents="none" style={[tipBox, { bottom: h + 8, minWidth: 84, alignItems: 'center' }]}>
            <Text style={[type.body, type.num, { color: '#FFFFFF', fontWeight: '600' }]}>{format(v)}</Text>
            <Text numberOfLines={1} style={[type.small, { color: '#CCCCCC' }]}>{labelOf(d, true)}</Text>
          </View> : null}
          <Animated.View style={{ width: '100%', maxWidth: 28, height: grow.interpolate({ inputRange: [0, 1], outputRange: [0, h] }), borderTopLeftRadius: 4, borderTopRightRadius: 4,
            backgroundColor: active ? c.interactive : mark === false ? (c.isDark ? '#4D4D4D' : '#CCCCCC') : c.skyBright,
            opacity: hover != null && !active ? 0.55 : 1, ...(WEB ? { transition: 'background-color 100ms, opacity 100ms' } : {}) }} />
        </Pressable>;
      })}
    </View>
    <View style={{ flexDirection: 'row', marginTop: space.sm, gap }}>
      {data.map((d, i) => <Text key={i} numberOfLines={1} style={[type.small, { flex: 1, textAlign: 'center', color: hover === i ? c.text : c.faint, fontSize: 11 }]}>{i % step === 0 || i === data.length - 1 ? labelOf(d) : ''}</Text>)}
    </View>
  </View>;
}

// Línea de una serie con área muy suave; cruz y lectura al pasar el cursor o el dedo.
export function LineChart({ data, valueOf, labelOf, height = 220, format = money }) {
  const { c } = useTheme();
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState(null);
  const max = Math.max(...data.map(valueOf), 1);
  const w = Math.max(width, 200);
  const top = 20, bottom = height - 6;
  const pts = data.map((d, i) => ({ x: data.length === 1 ? w / 2 : 2 + i * ((w - 4) / Math.max(data.length - 1, 1)), y: bottom - (valueOf(d) / max) * (bottom - top), d }));
  const line = pts.map((p, i) => `${i ? 'L' : 'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const area = pts.length ? `${line} L ${pts.at(-1).x.toFixed(1)} ${bottom} L ${pts[0].x.toFixed(1)} ${bottom} Z` : '';
  const pick = x => { if (!pts.length) return; let best = 0; pts.forEach((p, i) => { if (Math.abs(p.x - x) < Math.abs(pts[best].x - x)) best = i; }); setHover(best); };
  const hp = hover != null ? pts[hover] : null;
  const labels = [...new Set([0, Math.floor((data.length - 1) / 2), data.length - 1])];
  const handlers = WEB ? { onMouseMove: e => pick(e.nativeEvent.offsetX ?? e.nativeEvent.locationX), onMouseLeave: () => setHover(null) }
    : { onStartShouldSetResponder: () => true, onResponderGrant: e => pick(e.nativeEvent.locationX), onResponderMove: e => pick(e.nativeEvent.locationX), onResponderRelease: () => setHover(null) };
  return <View>
    <View onLayout={e => setWidth(e.nativeEvent.layout.width)} style={{ height }} {...handlers}>
      {!!width && <Svg width={width} height={height} viewBox={`0 0 ${w} ${height}`} style={{ pointerEvents: 'none' }}>
        {[0, 0.5, 1].map(v => <Line key={v} x1="0" x2={w} y1={top + v * (bottom - top)} y2={top + v * (bottom - top)} stroke={c.line} strokeWidth="1" strokeDasharray={v === 1 ? undefined : '2 4'} />)}
        {!!area && <Path d={area} fill={c.skyBright} fillOpacity={c.isDark ? 0.14 : 0.08} />}
        {!!line && <Path d={line} fill="none" stroke={c.skyBright} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
      </Svg>}
      <Text pointerEvents="none" style={[type.small, type.num, { position: 'absolute', left: 0, top: 0, color: c.faint }]}>{format(max)}</Text>
      {hp ? <>
        <View pointerEvents="none" style={{ position: 'absolute', left: hp.x, top: top - 4, bottom: height - bottom, width: 1, backgroundColor: c.lineStrong }} />
        <View pointerEvents="none" style={{ position: 'absolute', left: hp.x - 5, top: hp.y - 5, width: 10, height: 10, borderRadius: 5, backgroundColor: c.surface, borderWidth: 2, borderColor: c.interactive }} />
        <View pointerEvents="none" style={[tipBox, { top: 0, left: Math.min(Math.max(hp.x - 70, 0), Math.max(width - 140, 0)), width: 140 }]}>
          <Text style={[type.small, { color: '#CCCCCC' }]}>{labelOf(hp.d, true)}</Text>
          <Text style={[type.body, type.num, { color: '#FFFFFF', fontWeight: '600' }]}>{format(valueOf(hp.d))}</Text>
        </View>
      </> : null}
    </View>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: space.sm }}>
      {labels.map(i => <Text key={i} style={[type.small, { color: c.faint, fontSize: 11 }]}>{data[i] ? labelOf(data[i]) : ''}</Text>)}
    </View>
  </View>;
}

// Reparto: barra apilada con separación de 2 px + leyenda con porcentaje y monto (identidad nunca solo por color).
export function SplitBar({ items, total, empty }) {
  const { c } = useTheme();
  const [focus, setFocus] = useState(null);
  if (!items.length) return <Text style={[type.body, { color: c.muted, paddingVertical: space.md }]}>{empty}</Text>;
  const sum = total || items.reduce((s, it) => s + Number(it.total || 0), 0) || 1;
  return <View style={{ gap: space.md }}>
    <View style={{ flexDirection: 'row', height: 10, borderRadius: 4, overflow: 'hidden', gap: 2 }}>
      {items.map((it, i) => <View key={it.nombre} style={{ flex: Math.max(Number(it.total || 0), 0.0001), backgroundColor: SERIES[i % SERIES.length], opacity: focus == null || focus === i ? 1 : 0.3, ...(WEB ? { transition: 'opacity 100ms' } : {}) }} />)}
    </View>
    <View>
      {items.map((it, i) => <View key={it.nombre} onMouseEnter={() => setFocus(i)} onMouseLeave={() => setFocus(null)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 6, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
        <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: SERIES[i % SERIES.length] }} />
        <Text numberOfLines={1} style={[type.body, { flex: 1, color: c.text }]}>{it.nombre}</Text>
        <Text style={[type.body, type.num, { color: c.muted, width: 48, textAlign: 'right' }]}>{Math.round(Number(it.total || 0) / sum * 100)}%</Text>
        <Text style={[type.body, type.num, { color: c.text, width: 96, textAlign: 'right' }]}>{money(it.total)}</Text>
      </View>)}
    </View>
  </View>;
}

// Ranking con barra fina de magnitud bajo cada nombre.
export function RankList({ rows, labelOf, valueOf, metaOf, amountOf, empty }) {
  const { c } = useTheme();
  if (!rows.length) return <Text style={[type.body, { color: c.muted, paddingVertical: space.md }]}>{empty}</Text>;
  const max = Math.max(...rows.map(valueOf), 1);
  return <View>
    {rows.map((r, i) => <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
      <Text style={[type.body, type.num, { width: 16, color: c.faint }]}>{i + 1}</Text>
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <Text numberOfLines={1} style={[type.body, { color: c.text }]}>{labelOf(r)}</Text>
        <View style={{ height: 4, borderRadius: 2, backgroundColor: c.soft }}><View style={{ height: 4, borderRadius: 2, width: `${Math.max(2, valueOf(r) / max * 100)}%`, backgroundColor: c.skyBright }} /></View>
      </View>
      <Text style={[type.body, type.num, { color: c.muted, width: 64, textAlign: 'right' }]}>{metaOf(r)}</Text>
      <Text style={[type.body, type.num, { color: c.text, width: 88, textAlign: 'right', fontWeight: '500' }]}>{amountOf(r)}</Text>
    </View>)}
  </View>;
}
