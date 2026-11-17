import React, { useState } from 'react';
import { View } from 'react-native';
import { Clock3, History } from 'lucide-react-native';
import WaiterTabs from './WaiterTabs';
import OrderServiceTiming from './ServiceTiming';
import OrderTracking from './OrderTracking';

export default function OrderServicePanel({order,now,colors:c,alerts}) {
  const [tab,setTab]=useState('tiempos');
  if(!order?.id)return null;
  return <View style={{marginBottom:22,borderRadius:24,backgroundColor:c.surfaceAlt||c.elevated,overflow:'hidden',paddingTop:6}}>
    <WaiterTabs colors={c} label="Información del servicio" value={tab} onChange={setTab} tabs={[{key:'tiempos',label:'Tiempos',Icon:Clock3},{key:'seguimiento',label:'Seguimiento',Icon:History}]}>
      <View style={{padding:14}}>{tab==='tiempos'?<OrderServiceTiming order={order} now={now} colors={c} alerts={alerts}/>:<OrderTracking order={order} colors={c} embedded/>}</View>
    </WaiterTabs>
  </View>;
}
