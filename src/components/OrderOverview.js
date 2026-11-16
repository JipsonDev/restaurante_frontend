import React from 'react';
import { Platform, Text, View, useWindowDimensions } from 'react-native';
import { CheckCircle2, Clock3, FileText, ChefHat, CreditCard, PackageCheck } from 'lucide-react-native';

const labels = { PENDIENTE: 'Por preparar', PREPARANDO: 'En preparación', LISTO: 'Listo para entregar', ENTREGADO: 'Entregado', NUEVO: 'Borrador' };
const font = Platform.OS === 'web' ? { fontFamily: 'Manrope, "Segoe UI", system-ui, sans-serif' } : {};
const Label = ({ style, ...props }) => <Text {...props} style={[font, style]} />;

export default function OrderOverview({ order, title, subtitle, express, draft, draftCount, total, colors: c, deliveryState }) {
  const { width } = useWindowDimensions();
  const phone = width < 600;
  const paid = order?.estado_cobro === 'PAGADO';
  const kitchen = order?.estado_cocina || order?.estado || 'NUEVO';
  const balance = order ? Number(order.saldo_pendiente ?? (paid ? 0 : Math.max(0, Number(order.total) - Number(order.abonado || 0)))) : 0;
  const delivered = !!order && !order.pendiente_entrega && kitchen === 'ENTREGADO';
  const needsPayment = express && order && !paid;
  const steps = [
    [ChefHat, 'Cocina', labels[kitchen] || kitchen, kitchen === 'LISTO' ? c.success : c.brand],
    [CreditCard, 'Pago', !order ? 'Aún sin enviar' : paid ? 'Pagado completo' : Number(order.abonado) > 0 ? 'Abono · saldo pendiente' : 'Pendiente de cobro', paid ? c.success : c.warning],
    [PackageCheck, 'Entrega', delivered ? 'Entrega registrada' : needsPayment ? 'Primero cobrar en caja' : !order ? 'Pendiente' : 'Pendiente de entrega', delivered ? c.success : c.muted],
  ];
  return <View style={{ marginBottom: 20, borderRadius: 8, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, overflow: 'hidden' }}>
    <View style={{ padding: 16, flexDirection: 'row', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14 }}>
      <View style={{ flex: 1, minWidth: phone ? 120 : 220, gap: 6 }}>
        <Label style={{ color: c.muted, fontSize: 11 }}>{order ? `Cuenta #${order.id}` : 'Pedido sin enviar'}</Label>
        <Label style={{ color: c.ink, fontSize: 21, fontWeight: '500' }}>{title}</Label>
        <Label style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>{subtitle}</Label>
      </View>
      <View style={{ gap: 5, alignItems: 'flex-end' }}><Label style={{ color: c.muted, fontSize: 11 }}>{draft ? 'Total con esta ronda' : 'Total de la cuenta'}</Label><Label style={{ color: c.ink, fontSize: 25, fontWeight: '500', fontVariant: ['tabular-nums'] }}>${Number(total).toFixed(2)}</Label>{order ? <Label style={{ color: paid ? c.success : c.warning, fontSize: 11 }}>Saldo en caja: ${balance.toFixed(2)}</Label> : null}</View>
    </View>
    <View style={{ paddingHorizontal: 16, paddingVertical: phone ? 5 : 12, flexDirection: phone ? 'column' : 'row', gap: phone ? 0 : 16, backgroundColor: c.field, borderTopWidth: 1, borderColor: c.line }}>
      {steps.map(([Icon, label, value, color]) => <View key={label} style={{ flex: phone ? undefined : 1, minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 8 }}><Icon size={15} color={color} /><Label style={{ color: c.muted, fontSize: 11, width: phone ? 46 : undefined }}>{label}</Label><Label style={{ color, fontSize: 12, lineHeight: 18, flex: 1 }}>{value}</Label></View>)}
    </View>
    {deliveryState?.key!=='empty'&&deliveryState?<View style={{paddingHorizontal:16,paddingVertical:12,borderTopWidth:1,borderColor:c.line,flexDirection:'row',gap:9,alignItems:'flex-start'}}>
      {deliveryState.key==='sent'?<CheckCircle2 size={15} color={c.success}/>:['pending','sending'].includes(deliveryState.key)?<Clock3 size={15} color={c.warning}/>:<FileText size={15} color={c.muted}/>}
      <View style={{flex:1,gap:4}}><Label accessibilityLiveRegion="polite" style={{color:deliveryState.key==='sent'?c.success:['pending','unsaved'].includes(deliveryState.key)?c.warning:c.ink,fontSize:12}}>{deliveryState.label}{draft?` · ${draftCount} ${draftCount===1?'artículo':'artículos'}`:''}</Label>{deliveryState.key!=='sent'?<Label style={{color:c.muted,fontSize:11,lineHeight:17}}>{deliveryState.detail}</Label>:null}</View>
    </View>:null}
    {needsPayment && delivered ? <View style={{ padding: 14, borderTopWidth: 1, borderColor: c.line }}><Label style={{ color: c.warning, lineHeight: 20 }}>Entregado sin cobrar: registra el pago pendiente en caja.</Label></View> : null}
  </View>;
}
