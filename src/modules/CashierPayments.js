import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import axios from 'axios';
import { BASE_URL } from '../context/AuthContext';
import { savedPaymentText } from '../utils/paymentReceipt.mjs';

const money = (n) => `$${Number(n || 0).toFixed(2)}`;
const blankFilters = { q:'', desde:'', hasta:'', metodo:'', estado:'', cajero_id:'' };
function Button({ p, label, onPress, disabled, selected }) {
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress}
    style={{paddingHorizontal:12,paddingVertical:10,borderWidth:1,borderColor:selected?p.primary:p.line,borderRadius:8,backgroundColor:selected?p.primarySoft:p.surface,opacity:disabled?0.4:1}}>
    <Text style={{color:selected?p.primaryText:p.text,fontSize:12,fontWeight:'600'}}>{label}</Text>
  </TouchableOpacity>;
}
function Field({ p, label, value, change, placeholder }) {
  return <View style={{flexGrow:1,minWidth:150,gap:6}}><Text style={{color:p.muted,fontSize:12}}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={change} placeholder={placeholder} placeholderTextColor={p.faint}
    style={{height:42,borderWidth:1,borderColor:p.line,borderRadius:8,paddingHorizontal:12,color:p.text,backgroundColor:p.surface}}/></View>;
}
export default function CashierPayments({ p, onReprint, onAuthorize, canAuthorize, busy, version }) {
  const { width } = useWindowDimensions();
  const [filters,setFilters] = useState(blankFilters), [applied,setApplied] = useState(blankFilters), [page,setPage] = useState(1);
  const [result,setResult] = useState({rows:[],total:0,pages:1,cajeros:[]}), [loading,setLoading] = useState(true), [error,setError] = useState('');
  const [detail,setDetail] = useState(null), [detailError,setDetailError] = useState(''), [detailLoading,setDetailLoading] = useState(false), [detailOpen,setDetailOpen] = useState(false);
  const requestRef=useRef(0),detailRef=useRef(0);
  const load=useCallback(async()=>{
    const seq=++requestRef.current;setLoading(true);setError('');
    try { const {data}=await axios.get(`${BASE_URL}/caja/pagos`,{params:{...applied,page}}); if(seq===requestRef.current)setResult(data); }
    catch(err){if(seq===requestRef.current)setError(err.response?.data?.message||'No se pudo cargar el historial.');}
    finally{if(seq===requestRef.current)setLoading(false);}
  },[applied,page,version]);
  useEffect(()=>{load();return()=>{requestRef.current++;};},[load]);
  useEffect(()=>()=>{detailRef.current++;},[]);
  const openDetail=async(id)=>{const seq=++detailRef.current;setDetail(null);setDetailError('');setDetailOpen(true);setDetailLoading(true);
    try{const {data}=await axios.get(`${BASE_URL}/caja/pagos/${id}`);if(seq===detailRef.current)setDetail(data);}
    catch(err){if(seq===detailRef.current)setDetailError(err.response?.data?.message||'No se pudo cargar el comprobante.');}
    finally{if(seq===detailRef.current)setDetailLoading(false);}};
  const field=(key,value)=>setFilters((old)=>({...old,[key]:value}));
  const options=(key,items)=><ScrollView horizontal style={{flexGrow:0}} showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:7}}>{items.map(([value,label])=><Button key={value} p={p} label={label} selected={filters[key]===value} onPress={()=>field(key,value)}/>)}</ScrollView>;
  const print=async(id)=>{await onReprint(id);load();};
  return <View style={{gap:16}}>
    <View style={{backgroundColor:p.surface,borderRadius:12,borderWidth:1,borderColor:p.line,padding:20,gap:14}}>
      <View style={{flexDirection:'row',flexWrap:'wrap',gap:12}}>
        <Field p={p} label="Cliente o comprobante" value={filters.q} change={(v)=>field('q',v)} placeholder="Nombre, documento o número"/>
        <Field p={p} label="Desde" value={filters.desde} change={(v)=>field('desde',v)} placeholder="AAAA-MM-DD"/>
        <Field p={p} label="Hasta" value={filters.hasta} change={(v)=>field('hasta',v)} placeholder="AAAA-MM-DD"/>
      </View>
      {options('metodo',[['','Todos los métodos'],...['Efectivo','Tarjeta','Transferencia','QR','Vales','Otro','Mixto'].map(v=>[v,v])])}
      {options('estado',[['','Todos los estados'],['ACTIVO','Cobrados'],['ANULADO','Anulados'],['DEVUELTO','Devueltos']])}
      {options('cajero_id',[['','Todos los cajeros'],...result.cajeros.map(c=>[String(c.id),c.nombre])])}
      <View style={{flexDirection:'row',gap:8,flexWrap:'wrap'}}><Button p={p} label="Buscar ventas" disabled={loading} onPress={()=>{setPage(1);setApplied({...filters});}}/><Button p={p} label="Limpiar filtros" disabled={loading} onPress={()=>{setFilters(blankFilters);setApplied(blankFilters);setPage(1);}}/><Button p={p} label="Actualizar historial" disabled={loading} onPress={load}/></View>
    </View>
    {error?<Text accessibilityRole="alert" style={{color:p.red}}>{error}</Text>:null}
    {loading?<ActivityIndicator color={p.primary}/>:null}
    {!error?<View style={{gap:12}}>
      <Text style={{color:p.muted,fontSize:13}}>{result.total} comprobantes · Cobros activos: {money(result.total_activo)}</Text>
      {result.rows.map(pay=><View key={pay.id} style={{padding:18,borderWidth:1,borderColor:p.line,borderRadius:10,backgroundColor:p.surface,gap:12}}>
        <View style={{flexDirection:'row',justifyContent:'space-between',gap:12}}><View style={{flex:1,gap:5}}><Text style={{color:p.text,fontWeight:'600'}}>{pay.comprobante_numero||`Pago #${pay.id}`}</Text><Text style={{color:p.muted,fontSize:12}}>{pay.factura_cliente||pay.cliente_nombre||'Consumidor Final'} · {pay.metodo}</Text><Text style={{color:p.faint,fontSize:11}}>{new Date(pay.created_at).toLocaleString('es-EC')} · {pay.cajero_nombre||'Cajero no registrado'} · Caja #{pay.caja_id}</Text></View><View style={{alignItems:'flex-end',gap:6}}><Text style={{color:p.text,fontSize:19,fontWeight:'600'}}>{money(pay.monto)}</Text><Text style={{color:pay.estado==='ACTIVO'?p.green:p.red,fontSize:11}}>{pay.estado}</Text></View></View>
        <Text style={{color:pay.impresion_estado==='ERROR'?p.red:p.muted,fontSize:11}}>{pay.impresion_estado==='ERROR'?'Error de impresión: puedes reintentar':pay.impresion_estado==='ENVIADO'?'Enviado a impresión (salida física sin confirmar)':'Impresión pendiente o sin registro'}</Text>
        <View style={{flexDirection:'row',gap:8,flexWrap:'wrap'}}><Button p={p} label={`Ver ${pay.comprobante_numero||pay.id}`} onPress={()=>openDetail(pay.id)}/><Button p={p} label={`Reimprimir ${pay.comprobante_numero||pay.id}`} disabled={busy} onPress={()=>print(pay.id)}/>{canAuthorize&&pay.estado==='ACTIVO'?<><Button p={p} label={`Anular ${pay.comprobante_numero||pay.id}`} disabled={busy} onPress={()=>onAuthorize(pay,'anular')}/><Button p={p} label={`Devolver ${pay.comprobante_numero||pay.id}`} disabled={busy} onPress={()=>onAuthorize(pay,'devolver')}/></>:null}</View>
      </View>)}
      {!loading&&!result.rows.length?<Text style={{color:p.muted,padding:20}}>No hay ventas con estos filtros.</Text>:null}
      <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8}}><Button p={p} label="Página anterior" disabled={loading||page<=1} onPress={()=>setPage(page-1)}/><Text style={{color:p.muted,fontSize:12}}>{page} / {result.pages}</Text><Button p={p} label="Página siguiente" disabled={loading||page>=result.pages} onPress={()=>setPage(page+1)}/></View>
    </View>:null}
    <Modal visible={detailOpen} transparent animationType="fade" onRequestClose={()=>{detailRef.current++;setDetailOpen(false);}}><View style={{flex:1,backgroundColor:'rgba(15,23,42,0.55)',padding:width<600?12:28,alignItems:'center',justifyContent:'center'}}><View style={{backgroundColor:p.surface,borderRadius:12,width:'100%',maxWidth:640,maxHeight:'94%',padding:20,gap:16}}>
      <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}><Text style={{color:p.text,fontWeight:'600',fontSize:18}}>Detalle del comprobante</Text><Button p={p} label="Cerrar detalle" onPress={()=>{detailRef.current++;setDetailOpen(false);}}/></View>
      {detailLoading?<ActivityIndicator color={p.primary}/>:null}{detailError?<Text style={{color:p.red}}>{detailError}</Text>:null}
      {detail?<><ScrollView><Text selectable style={{color:p.text,fontSize:13,lineHeight:22}}>{savedPaymentText(detail.snapshot,detail.pago)}</Text></ScrollView><Button p={p} label="Reimprimir comprobante" disabled={busy} onPress={()=>print(detail.pago.id)}/></>:null}
    </View></View></Modal>
  </View>;
}
