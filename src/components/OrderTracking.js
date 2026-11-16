import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, View } from 'react-native';
import { ChevronDown, ChevronUp, History, RefreshCw } from 'lucide-react-native';
import axios from 'axios';
import { BASE_URL } from '../context/AuthContext';
import { WText, WButton } from './WaiterUI';
import { serviceTimeLabel } from '../utils/serviceTiming.mjs';
import { trackingEvents } from '../utils/waiterSync.mjs';

const title=event=>({pedido_tomado:'Pedido tomado',ronda_enviada:`Ronda #${event.ronda_id} enviada`,ronda_entregada:`Ronda #${event.ronda_id} entregada`,ronda_agregada_legacy:'Ronda añadida · número no registrado',cobro:'Cobro registrado',cobro_anulado:'Cobro anulado',cobro_devuelto:'Cobro devuelto'}[event.tipo]);

export default function OrderTracking({order,colors:c,embedded=false}){
  const [open,setOpen]=useState(embedded),[attempt,setAttempt]=useState(0);
  const [data,setData]=useState([]),[error,setError]=useState(''),[loading,setLoading]=useState(false);
  const accounts=order?.originalOrders || (order?[order]:[]);
  const ids=[...new Set(accounts.map(account=>Number(account.id)).filter(id=>Number.isSafeInteger(id)&&id>0))].sort((a,b)=>a-b);
  const key=ids.join(',');
  const revision=JSON.stringify(accounts.map(account=>[account.id,account.estado,account.abonado,account.total,(account.rondas||[]).map(round=>[round.id,round.estado,round.entregado_at])]));
  useEffect(()=>{setOpen(embedded);setData([]);},[key,embedded]);
  useEffect(()=>{
    if(!open||!key)return undefined;
    let active=true;const controller=new AbortController();
    setLoading(true);setError('');setData([]);
    Promise.all(key.split(',').map(id=>axios.get(`${BASE_URL}/pedidos/${id}/seguimiento`,{signal:controller.signal,timeout:12000}).then(({data:next})=>{if(Number(next.pedido_id)!==Number(id))throw new Error('La respuesta corresponde a otra cuenta.');return next;})))
      .then(responses=>{const events=trackingEvents(responses);if(active)setData(events);})
      .catch(e=>{if(active&&!axios.isCancel(e))setError(e.response?.data?.message||e.message||'No se pudo consultar el seguimiento.');})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;controller.abort();};
  },[open,key,revision,attempt]);
  if(!key)return null;
  return <View style={{marginBottom:embedded?0:20,borderTopWidth:embedded?0:1,borderColor:c.line,paddingTop:4,gap:10}}>
    {!embedded?<Pressable accessibilityRole="button" accessibilityLabel={open?'Ocultar seguimiento del pedido':'Ver seguimiento del pedido'} accessibilityState={{expanded:open}} {...(Platform.OS==='web'?{'aria-expanded':open,'aria-controls':`tracking-panel-${key.replaceAll(',','-')}`}:{})} onPress={()=>setOpen(value=>!value)} style={{minHeight:44,flexDirection:'row',alignItems:'center',gap:8}}><History size={17} color={c.muted}/><WText style={{flex:1,color:c.ink,fontSize:14}}>Seguimiento del pedido</WText>{open?<ChevronUp size={16} color={c.muted}/>:<ChevronDown size={16} color={c.muted}/>}</Pressable>:null}
    {open?<View nativeID={`tracking-panel-${key.replaceAll(',','-')}`} style={{gap:10}}>
      <WText style={{color:c.muted,fontSize:12,lineHeight:18}}>Responsable: {accounts.map(account=>account.mesero_nombre||'Sin nombre registrado').filter((value,index,array)=>array.indexOf(value)===index).join(' · ')}</WText>
      {loading?<View style={{paddingVertical:14,flexDirection:'row',gap:8}}><ActivityIndicator color={c.brand}/><WText style={{color:c.muted,fontSize:12}}>Consultando responsables…</WText></View>:error?<View style={{gap:8}}><WText accessibilityRole="alert" style={{color:c.danger,fontSize:12}}>{error}</WText><WButton colors={c} onPress={()=>setAttempt(value=>value+1)}>Reintentar seguimiento</WButton></View>:<>
        {!data.length?<WText style={{color:c.muted,fontSize:12}}>No hay acciones registradas para esta cuenta.</WText>:null}
        {data.map(event=><View key={event.key} style={{paddingVertical:10,paddingLeft:17,borderLeftWidth:1,borderColor:c.line,gap:5,marginLeft:4}}>
          <View style={{position:'absolute',left:-4,top:14,width:7,height:7,borderRadius:4,backgroundColor:event.tipo==='cobro'?c.success:c.brand}}/><View style={{flexDirection:'row',flexWrap:'wrap',gap:6,justifyContent:'space-between'}}><WText style={{color:c.ink,fontSize:12}}>{title(event)}</WText><WText style={{color:c.muted,fontSize:11}}>{serviceTimeLabel(event.at)}</WText></View>
          <WText style={{color:c.ink,fontSize:12}}>{event.actor.nombre}{event.actor.rol?` · ${event.actor.rol}`:''}</WText>
          {ids.length>1||event.pedido_origen_id&&Number(event.pedido_origen_id)!==Number(event.pedido_id)?<WText style={{color:c.muted,fontSize:11}}>Cuenta #{event.pedido_origen_id||event.pedido_id}</WText>:null}
          {event.items?.length?<WText style={{color:c.muted,fontSize:12,lineHeight:18}}>{event.items.map(item=>`${item.cantidad} × ${item.nombre}`).join(', ')}</WText>:null}
          {event.monto!==undefined?<WText style={{color:c.muted,fontSize:12}}>${Number(event.monto).toFixed(2)}{event.metodo?` · ${event.metodo}`:''}{event.estado?` · ${event.estado}`:''}</WText>:null}
        </View>)}
        <WButton colors={c} label="Actualizar seguimiento del pedido" Icon={RefreshCw} onPress={()=>setAttempt(value=>value+1)} style={{alignSelf:'flex-start'}}>Actualizar seguimiento</WButton>
      </>}
    </View>:null}
  </View>;
}
