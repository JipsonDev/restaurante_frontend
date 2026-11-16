import React, { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { ArrowUpRight, Bell, CheckCheck, Clock3, RefreshCw, X } from 'lucide-react-native';
import { WButton, WText } from './WaiterUI';
import WaiterTabs from './WaiterTabs';
import { serviceDuration } from '../utils/serviceTiming.mjs';
import { BOTTOM_INSET } from '../utils/safeArea';

export default function WaiterNotifications({colors:c,alerts,activity,close,openOrder,clearActivity}) {
  const {width}=useWindowDimensions();
  const [tab,setTab]=useState('demoras');
  const isPhone=width<600;
  return <Modal visible transparent animationType="none" onRequestClose={close}>
    <View style={{flex:1,backgroundColor:c.isDark?'#050B17BB':'#13233866',alignItems:'flex-end',justifyContent:isPhone?'flex-end':'center',padding:isPhone?8:20}}>
      <Pressable accessible={false} focusable={false} tabIndex={-1} onPress={close} style={{position:'absolute',inset:0}}/>
      <View accessibilityViewIsModal accessibilityLabel="Centro de alertas" style={{backgroundColor:c.surface,width:'100%',maxWidth:480,maxHeight:'90%',borderWidth:1,borderColor:c.line,borderRadius:8,overflow:'hidden'}}>
        <View style={{padding:18,paddingBottom:10,flexDirection:'row',alignItems:'center',gap:12}}><Bell size={21} color={c.brand}/><View style={{flex:1,gap:4}}><WText accessibilityRole="header" style={{color:c.ink,fontSize:21}}>Centro de alertas</WText><WText style={{color:c.muted,fontSize:12}}>Prioridades de tu servicio</WText></View><WButton colors={c} label="Cerrar alertas" Icon={X} onPress={close} style={{borderWidth:0}}/></View>
        <WaiterTabs colors={c} label="Tipos de alertas" value={tab} onChange={setTab} padding={18} tabs={[{key:'demoras',label:`Demoras · ${alerts.items.length}`},{key:'actividad',label:`Actividad · ${activity.filter(item=>!item.read).length}`}]}>
        <ScrollView style={{flexShrink:1}} contentContainerStyle={{paddingHorizontal:18,paddingBottom:18+BOTTOM_INSET}}>
          {tab==='demoras'?<>
            <View style={{paddingVertical:12,flexDirection:'row',alignItems:'center',gap:8}}><View style={{flex:1,gap:4}}><WText style={{color:c.muted,fontSize:11}}>{alerts.limits.enabled?`Cocina ${alerts.limits.espera} min · lista ${alerts.limits.lista} min`:'Alertas desactivadas en Ajustes'}</WText><WText style={{color:c.muted,fontSize:10}}>{alerts.updatedAt?`Revisado ${new Date(alerts.updatedAt).toLocaleTimeString('es-EC',{hour:'2-digit',minute:'2-digit',hourCycle:'h23'})}`:'Consultando límites del restaurante'}</WText></View><WButton colors={c} label="Actualizar demoras" Icon={RefreshCw} onPress={alerts.refresh} style={{borderWidth:0}}/></View>
            {!!alerts.error&&<View style={{paddingBottom:12,gap:6}}><WText accessibilityRole="alert" style={{color:c.warning,fontSize:12,lineHeight:18}}>{alerts.error}{alerts.items.length?' Mostrando la última consulta.':''}</WText><WButton colors={c} onPress={alerts.refresh}>Reintentar demoras</WButton></View>}
            {alerts.loading?<ActivityIndicator color={c.brand} style={{padding:24}}/>:!alerts.items.length?<View style={{paddingVertical:32,gap:10,alignItems:'center'}}><CheckCheck size={28} strokeWidth={1.3} color={c.muted}/><WText style={{color:c.ink,fontSize:15}}>{alerts.limits.enabled?'Sin demoras pendientes':'Avisos en pausa'}</WText><WText style={{color:c.muted,fontSize:12,lineHeight:19,textAlign:'center'}}>{alerts.limits.enabled?'Las rondas que superen los límites aparecerán aquí.':'El administrador puede activarlos en Ajustes → Atención.'}</WText></View>:null}
            {alerts.items.map(item=><Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Abrir ${item.mesa_id?`mesa ${item.mesa_numero||item.mesa_id}`:`pedido ${item.pedido_id}`}, ronda ${item.ronda_id}, ${item.tipo==='lista'?'lista':'esperando'} ${item.minutos} minutos`} onPress={()=>openOrder(item)} style={({hovered,pressed})=>({paddingVertical:16,paddingHorizontal:4,borderTopWidth:1,borderColor:c.line,gap:10,backgroundColor:hovered||pressed?c.field:'transparent'})}>
              <View style={{flexDirection:'row',alignItems:'center',gap:8}}><View style={{width:4,height:22,borderRadius:2,backgroundColor:c.brand}}/><WText style={{flex:1,color:c.ink,fontSize:15}}>{item.mesa_id?`Mesa ${item.mesa_numero||item.mesa_id}`:`${item.origen==='Delivery'?'Delivery':'Express'} #${item.pedido_id}`}</WText><ArrowUpRight size={17} color={c.muted}/></View>
              <View style={{flexDirection:'row',alignItems:'center',gap:10,paddingLeft:12}}><Clock3 size={15} color={c.warning}/><WText style={{flex:1,color:c.warning,fontSize:13}}>{item.tipo==='lista'?'Lista para entregar':'Esperando en cocina'}</WText><WText style={{color:c.ink,fontSize:18,fontVariant:['tabular-nums']}}>{serviceDuration(item.minutos)}</WText></View>
              <WText style={{color:c.muted,fontSize:11,lineHeight:17,paddingLeft:12}}>Ronda #{item.ronda_id} · límite {item.limite} min · {item.minutos-item.limite} min de exceso{!item.mesa_id&&item.tipo==='lista'&&item.estado_cobro!=='PAGADO'?'\nCobrar en caja antes de entregar.':''}</WText>
            </Pressable>)}
          </>:<>
            <View style={{alignItems:'flex-end',paddingVertical:8}}><WButton colors={c} disabled={!activity.length} onPress={clearActivity} style={{borderWidth:0}}>Limpiar actividad</WButton></View>
            {!activity.length?<WText style={{color:c.muted,fontSize:13,paddingVertical:28,textAlign:'center'}}>No hay actividad reciente.</WText>:null}
            {activity.map(item=><Pressable key={item.id} accessibilityRole="button" onPress={()=>openOrder(item)} style={{paddingVertical:16,borderTopWidth:1,borderColor:c.line,gap:6}}><View style={{flexDirection:'row',alignItems:'center',gap:8}}><View style={{width:6,height:6,borderRadius:3,backgroundColor:item.read?c.line:c.success}}/><WText style={{color:c.ink,fontSize:14,flex:1}}>{item.title}</WText><ArrowUpRight size={15} color={c.muted}/></View><WText style={{color:c.muted,fontSize:12,lineHeight:18,paddingLeft:14}}>{item.body}</WText></Pressable>)}
          </>}
        </ScrollView>
        </WaiterTabs>
        <View style={{borderTopWidth:1,borderColor:c.line,padding:14}}><WText style={{color:c.muted,fontSize:11,lineHeight:17}}>Avisos agrupados, sin sonido. Cada fase se notifica una sola vez.</WText></View>
      </View>
    </View>
  </Modal>;
}
