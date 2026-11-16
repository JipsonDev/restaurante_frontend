import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Clock3 } from 'lucide-react-native';
import { WText } from './WaiterUI';
import { roundTiming, serviceDuration, serviceRounds, serviceSummary, serviceTimeLabel } from '../utils/serviceTiming.mjs';

const metrics = { small: 11, body: 12, title: 15, lineHeight: 18, rowGap: 5, sectionGap: 12 };
const states = { PENDIENTE: 'Por preparar', PREPARANDO: 'En preparación', LISTO: 'Lista para entregar', ENTREGADO: 'Entregada' };

export function ServiceWait({ order, now, colors: c, compact = false, alerts }) {
  if (!order) return null;
  const summary = serviceSummary(order, now);
  const ids=new Set((order.originalOrders||[order]).map(account=>Number(account.id)));
  const late=(alerts?.items||[]).filter(item=>ids.has(Number(item.pedido_id)));
  if (!summary.pendingCount) return <WText style={{ color: c.muted, fontSize: metrics.small, lineHeight: metrics.lineHeight }}>Sin entregas pendientes</WText>;
  return <View style={{ gap: metrics.rowGap, minWidth: 0 }}>
    <View style={{ flexDirection: 'row', gap: metrics.rowGap, alignItems: 'flex-start' }}>
      <Clock3 size={13} color={c.muted} style={{ marginTop: 2 }} />
      <WText style={{ color: c.muted, fontSize: compact ? metrics.small : metrics.body, lineHeight: metrics.lineHeight, flexShrink: 1, fontVariant: ['tabular-nums'] }}>Espera · {serviceDuration(summary.waitMinutes)}</WText>
    </View>
    {late.length?<WText style={{color:c.warning,fontSize:metrics.small,lineHeight:metrics.lineHeight}}>{late.length} {late.length===1?'ronda con demora':'rondas con demora'}</WText>:null}
    {summary.readyCount ? <WText style={{ color: c.warning, fontSize: compact ? metrics.small : metrics.body, lineHeight: metrics.lineHeight, fontVariant: ['tabular-nums'] }}>Lista · {serviceDuration(summary.readyMinutes)}{compact ? '' : ` · ${summary.readyCount} ${summary.readyCount === 1 ? 'ronda' : 'rondas'}`}</WText> : null}
  </View>;
}

export default function OrderServiceTiming({ order, now, colors: c, alerts }) {
  const [showDelivered,setShowDelivered] = useState(false);
  const rounds = serviceRounds(order), summary = serviceSummary(order,now);
  const delivered = rounds.filter(round=>round.estado==='ENTREGADO');
  const visible = rounds.filter(round=>round.estado!=='ENTREGADO'||showDelivered);
  const due = new Set((alerts?.items||[]).map(item=>`${item.pedido_id}:${item.ronda_id}`));
  if (!rounds.length) return null;
  return <View style={{gap:14}}>
    <View style={{flexDirection:'row',gap:16,paddingBottom:14,borderBottomWidth:1,borderColor:c.line}}>
      {[[summary.waitMinutes,'Espera más antigua',c.ink],[summary.readyMinutes,`${summary.readyCount} ${summary.readyCount===1?'ronda lista':'rondas listas'}`,summary.readyCount?c.warning:c.muted]].map(([value,label,color],index)=><View key={index} style={{flex:1,gap:6}}><WText style={{color:c.muted,fontSize:11}}>{label}</WText><WText style={{color,fontSize:value===null?12:20,fontVariant:['tabular-nums']}}>{index===0&&!summary.pendingCount||index===1&&!summary.readyCount?'—':serviceDuration(value)}</WText></View>)}
    </View>
    {alerts?.limits.enabled?<WText style={{color:c.muted,fontSize:11}}>Avisar a los {alerts.limits.espera} min en cocina · {alerts.limits.lista} min lista</WText>:<WText style={{color:c.muted,fontSize:11}}>Alertas de demora desactivadas</WText>}
    <View>{visible.map(round=>{
      const timing=roundTiming(round,now), late=due.has(`${round.pedido_id}:${round.id}`);
      const ready=round.estado==='LISTO', done=round.estado==='ENTREGADO';
      const elapsed=ready?timing.readyMinutes:timing.waitMinutes;
      const limit=alerts?.limits[ready?'lista':'espera'];
      return <View key={`${round.pedido_id}-${round.id}`} style={{paddingVertical:13,borderBottomWidth:1,borderColor:c.line,gap:8}}>
        <View style={{flexDirection:'row',gap:10,alignItems:'flex-start'}}>
          <View style={{flex:1,gap:5,minWidth:0}}><WText style={{color:c.ink,fontSize:13}}>Ronda #{String(round.id).replace('legacy-','')}</WText><WText style={{color:c.muted,fontSize:11,lineHeight:17}}>Enviada {serviceTimeLabel(timing.sentAt,now)}</WText></View>
          <View style={{alignItems:'flex-end',gap:5,flexShrink:1}}><WText style={{color:late||ready?c.warning:c.muted,fontSize:12}}>{late?'Demora · ':''}{states[round.estado]||round.estado}</WText><WText style={{color:late?c.warning:c.ink,fontSize:15,fontVariant:['tabular-nums']}}>{done?serviceTimeLabel(timing.deliveredAt,now):serviceDuration(elapsed)}</WText></View>
        </View>
        {ready?<WText style={{color:c.muted,fontSize:11}}>Lista desde {serviceTimeLabel(timing.readyAt,now)}</WText>:null}
        {!done&&limit&&elapsed!==null&&alerts?.limits.enabled?<View accessible={false} style={{height:3,borderRadius:2,backgroundColor:c.line,overflow:'hidden'}}><View style={{width:`${Math.min(100,Math.max(0,elapsed/limit*100))}%`,height:3,backgroundColor:late?c.warning:c.faint}}/></View>:null}
        {done&&timing.readyMinutes!==null?<WText style={{color:c.muted,fontSize:11}}>De lista a entregada · {serviceDuration(timing.readyMinutes)}</WText>:null}
      </View>;
    })}</View>
    {delivered.length?<Pressable accessibilityRole="button" accessibilityState={{expanded:showDelivered}} onPress={()=>setShowDelivered(value=>!value)} style={{minHeight:44,justifyContent:'center'}}><WText style={{color:c.muted,fontSize:12}}>{showDelivered?'Ocultar':'Ver'} entregadas ({delivered.length})</WText></Pressable>:null}
  </View>;
}
