import CashierPayments from './CashierPayments';
import React, { useEffect, useRef, useState } from 'react';
import { Image, Modal, SafeAreaView, ScrollView, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { ArrowDownLeft, ArrowRight, ArrowUpRight, CheckCircle2, ChevronRight, Clock, FileText, LogOut, Minus, Moon, Plus, Printer, Receipt, Search, ShoppingBag, Sun, Table2, Trash2, User, WalletCards, Wifi, WifiOff, X } from 'lucide-react-native';
import Logo from '../components/Logo';
import { BOTTOM_INSET, TOP_INSET } from '../utils/safeArea';

const row = { flexDirection: 'row', alignItems: 'center' };
const moneyStyle = { fontVariant: ['tabular-nums'] };
function Action({ label, icon: Icon, onPress, p, primary = false, disabled = false, compact = false, style, accessibilityLabel }) {
  const color = primary ? p.onPrimary : p.text;
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={accessibilityLabel || label} disabled={disabled} onPress={onPress} activeOpacity={0.75}
    style={[row, { minHeight: compact ? 36 : 44, paddingHorizontal: compact ? 12 : 16, borderRadius: 9, gap: 8, justifyContent: 'center', borderWidth: 1, borderColor: primary ? p.accent : p.line, backgroundColor: primary ? p.accent : p.surface, opacity: disabled ? 0.4 : 1 }, style]}>
    {Icon ? <Icon size={compact ? 15 : 17} color={color} /> : null}<Text style={{ color, fontSize: 13, fontWeight: '600' }}>{label}</Text>
  </TouchableOpacity>;
}
function Input({ p, label, style, ...props }) {
  return <View style={[{ gap: 7, flex: 1, minWidth: 0 }, style]}>
    {label ? <Text style={{ color: p.muted, fontSize: 12, fontWeight: '600' }}>{label}</Text> : null}
    <TextInput accessibilityLabel={label || props.placeholder} placeholderTextColor={p.faint} {...props}
      style={{ height: 44, flexShrink: 0, paddingHorizontal: 12, borderWidth: 1, borderColor: p.line, borderRadius: 8, backgroundColor: p.surface, color: p.text, fontSize: 14 }} />
  </View>;
}
function Chip({ p, children, onPress, active = false }) {
  return <TouchableOpacity accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress}
    style={{ paddingHorizontal: 13, paddingVertical: 9, borderRadius: 8, backgroundColor: active ? p.primarySoft : p.surface, borderWidth: 1, borderColor: active ? p.primary : p.line }}>
    <Text style={{ color: active ? p.primaryText : p.muted, fontSize: 12, fontWeight: '600' }}>{children}</Text>
  </TouchableOpacity>;
}

export default function CashierWorkspace({ model: m, actions: a, helpers: h }) {
  const { width } = useWindowDimensions();
  const [section, setSection] = useState('venta');
  const scrollRef = useRef(null);
  useEffect(() => { scrollRef.current?.scrollTo({ y: 0, animated: false }); }, [section, m.selectedOrder?.id]);
  const [catalog, setCatalog] = useState(false);
  const desktop = width >= 1200, columns = width >= 860, phone = width < 600;
  const p = m.pos;
  const pad = phone ? 16 : 26;
  const card = { backgroundColor: p.surface, borderWidth: 1, borderColor: p.line, borderRadius: 12, overflow: 'hidden' };
  const selected = m.selectedOrder;
  const lines = selected?.items || m.cart;
  const total = selected ? m.chargeAmount : m.cartTotal;
  const title = section === 'venta' ? 'Facturación' : section === 'cuentas' ? 'Cuentas pendientes' : section === 'pagos' ? 'Comprobantes' : 'Mi caja';
  const nav = [['venta', 'Facturación', Receipt], ['cuentas', 'Cuentas pendientes', Table2], ['pagos', 'Comprobantes', FileText], ['turno', 'Mi caja', WalletCards]];
  const chooseOrder = (order) => { a.openOrder(order); setSection('venta'); };
  const newSale = () => { a.closeOrder(); setSection('venta'); };
  const money = (value) => Number.isFinite(Number(value)) ? h.money(value) : '—';
  const draftService = Math.max(0, m.cartTotal - m.cartSubtotal);
  const date = new Date().toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric' });

  const empty = (Icon, heading, detail, action) => <View style={{ alignItems: 'center', justifyContent: 'center', padding: phone ? 26 : 44, minHeight: 250, gap: 12 }}>
    <View style={{ width: 60, height: 60, borderRadius: 18, backgroundColor: p.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 3 }}><Icon size={27} color={p.primaryText} strokeWidth={1.5} /></View>
    <Text style={{ fontSize: 18, fontWeight: '600', color: p.text, textAlign: 'center' }}>{heading}</Text>
    <Text style={{ color: p.muted, fontSize: 13, lineHeight: 21, textAlign: 'center', maxWidth: 315 }}>{detail}</Text>
    {action}
  </View>;
  const summaryLine = (label, value) => <View style={[row, { justifyContent: 'space-between' }]} key={label}>
    <Text style={{ color: p.muted, fontSize: 13 }}>{label}</Text><Text style={[moneyStyle, { color: p.text, fontSize: 14, fontWeight: '500' }]}>{money(value)}</Text>
  </View>;

  const invoice = () => <View style={{ flexDirection: columns ? 'row' : 'column', alignItems: 'flex-start', gap: 20 }}>
    <View style={{ flex: columns ? 1 : undefined, width: columns ? undefined : '100%', minWidth: 0, gap: 16 }}>
      <View style={card}>
        <View style={[row, { padding: 20, justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: p.line, gap: 8 }]}>
          <View style={{ gap: 5, flex: 1 }}><Text style={{ color: p.faint, fontSize: 10, fontWeight: '700', letterSpacing: 1.6 }}>DOCUMENTO DE VENTA</Text>
            <Text style={{ color: p.text, fontSize: 20, fontWeight: '600' }}>{selected ? h.orderLabel(selected) : 'Nueva venta'}</Text></View>
          <View style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: selected ? p.amberSoft : p.soft }}><Text style={{ color: selected ? p.amber : p.muted, fontSize: 11, fontWeight: '600' }}>{selected ? (Number(selected.abonado)>0?'Abonado':'Por cobrar') : 'Borrador'}</Text></View>
        </View>
        <View style={{ padding: 20, gap: 17 }}>
          <View style={[row, { gap: 8 }]}><User size={16} color={p.muted} /><Text style={{ color: p.text, fontSize: 14, fontWeight: '600' }}>Cliente y comprobante</Text></View>
          {selected ? <>
            <View style={[row, { gap: 8, flexWrap: 'wrap' }]}>{[['FINAL','Consumidor final'],['ID','Con cédula / RUC']].map(([key,label]) => <Chip key={key} p={p} active={m.billingMode === key} onPress={() => a.setBillingMode(key)}>{label}</Chip>)}</View>
            <View style={{ flexDirection: phone ? 'column' : 'row', gap: 12 }}>
              <Input p={p} label="Nombre o razón social" value={m.billingMode === 'FINAL' ? 'Consumidor Final' : m.billingName} onChangeText={a.setBillingName} editable={m.billingMode === 'ID' && !m.busy} placeholder="Nombre del cliente" />
              {m.billingMode === 'ID' ? <Input p={p} label="Cédula / RUC" value={m.billingId} onChangeText={a.setBillingId} keyboardType="number-pad" maxLength={13} editable={!m.busy} placeholder="Número de documento" /> : null}
            </View>
            {m.billingMode === 'ID' ? <View style={{ flexDirection: phone ? 'column' : 'row', gap: 12 }}><Input p={p} label="Correo electrónico" value={m.billingEmail} onChangeText={a.setBillingEmail} keyboardType="email-address" editable={!m.busy} placeholder="Opcional" /><Input p={p} label="Teléfono" value={m.billingPhone} onChangeText={a.setBillingPhone} editable={!m.busy} keyboardType="phone-pad" placeholder="Opcional" /></View> : null}
            {m.matchingClients.map((client) => <TouchableOpacity accessibilityRole="button" key={client.id} onPress={() => a.selectBillingClient(client)} style={{ padding: 10, backgroundColor: p.surfaceAlt, borderRadius: 6 }}><Text style={{ color: p.primaryText, fontSize: 12 }}>{client.nombre} · {client.documento}</Text></TouchableOpacity>)}
          </> : <>
            <View style={[row, { gap: 8 }]}>{['Para llevar','Delivery'].map((kind) => <Chip p={p} key={kind} active={kind === m.saleType} onPress={() => !m.orderBusy && a.setSaleType(kind)}>{kind}</Chip>)}</View>
            <Input p={p} label="Nombre del cliente" value={m.customer.nombre} onChangeText={a.setCustomerName} placeholder="¿A nombre de quién es el pedido?" editable={!m.orderBusy} />
            {m.customerError ? <Text style={{ color: p.red, fontSize: 12 }}>{m.customerError}</Text> : null}
          </>}
        </View>
      </View>
      <View style={card}>
        <View style={[row, { padding: 20, justifyContent: 'space-between', gap: 8 }]}><View style={[row, { gap: 8 }]}><ShoppingBag size={17} color={p.muted} /><Text style={{ fontSize: 14, fontWeight: '600', color: p.text }}>Detalle de la venta</Text><Text style={{ color: p.faint, fontSize: 12 }}>({lines.length})</Text></View>
          {!selected ? <Action p={p} compact label="Agregar" icon={Plus} disabled={m.orderBusy || !m.canManageCash} onPress={() => setCatalog(true)} /> : null}
        </View>
        {lines.length ? <>
          <View style={[row, { paddingHorizontal: 20, paddingVertical: 12, backgroundColor: p.surfaceAlt, borderTopWidth: 1, borderBottomWidth: 1, borderColor: p.line }]}>
            <Text style={{ flex: 1, fontSize: 10, fontWeight: '700', letterSpacing: 0.8, color: p.faint }}>PRODUCTO</Text>
            {!phone ? <Text style={{ width: 72, fontSize: 10, color: p.faint, textAlign: 'right' }}>PRECIO</Text> : null}
            <Text style={{ width: selected ? 60 : 104, fontSize: 10, color: p.faint, textAlign: 'center' }}>CANT.</Text><Text style={{ width: 76, fontSize: 10, color: p.faint, textAlign: 'right' }}>IMPORTE</Text>
          </View>
          {lines.map((item, index) => <View key={item.id || item.producto_id || index} style={[row, { paddingHorizontal: 20, paddingVertical: 19, borderBottomWidth: 1, borderBottomColor: p.line }]}>
            <View style={{ flex: 1, minWidth: 0, gap: 5 }}><Text style={{ color: p.text, fontSize: 13, fontWeight: '600' }}>{item.nombre}</Text>
              <Text style={{ color: p.faint, fontSize: 11, lineHeight: 16 }}>{[item.notas, ...(item.modificadores || []).map((mod) => mod.nombre)].filter(Boolean).join(' · ') || (item.ronda_id ? `Ronda ${item.ronda_id}` : 'Producto del catálogo')}</Text></View>
            {!phone ? <Text style={[moneyStyle, { width: 72, textAlign: 'right', color: p.muted, fontSize: 12 }]}>{money(Number(item.precio) + h.itemExtras(item))}</Text> : null}
            <View style={[row, { width: selected ? 60 : 104, justifyContent: 'center', gap: 5 }]}>
              {!selected ? <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Quitar una unidad de ${item.nombre}`} disabled={m.orderBusy} onPress={() => a.changeCartQty(item.producto_id,-1)} style={{ padding: 7, backgroundColor: p.soft, borderRadius: 6 }}><Minus size={13} color={p.muted} /></TouchableOpacity> : null}
              <Text style={{ color: p.text, fontSize: 13, fontWeight: '600', minWidth: 18, textAlign: 'center' }}>{item.cantidad}</Text>
              {!selected ? <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Añadir una unidad de ${item.nombre}`} disabled={m.orderBusy} onPress={() => a.changeCartQty(item.producto_id,1)} style={{ padding: 7, backgroundColor: p.soft, borderRadius: 6 }}><Plus size={13} color={p.muted} /></TouchableOpacity> : null}
            </View><Text style={[moneyStyle, { width: 76, textAlign: 'right', color: p.text, fontSize: 13, fontWeight: '600' }]}>{money(h.itemLineTotal(item))}</Text>
          </View>)}
          <View style={[row, { padding: 15, gap: 7 }]}><CheckCircle2 size={13} color={p.faint} /><Text style={{ color: p.faint, fontSize: 11, flex: 1 }}>{selected ? 'Productos enviados a cocina. Cantidades confirmadas.' : 'Borrador · aún no se ha enviado a cocina.'}</Text></View>
        </> : empty(ShoppingBag, 'Todo listo para tu próxima venta', 'Busca un producto del catálogo y agrégalo al detalle para comenzar.', <Action p={p} label="Explorar catálogo" icon={Plus} primary onPress={() => setCatalog(true)} disabled={!m.canManageCash} />)}
        <View style={{ padding: 20, paddingTop: 6 }}>{selected ? (selected.notas ? <Text style={{ color: p.muted, fontSize: 12, lineHeight: 19 }}>Observaciones: {selected.notas}</Text> : null) : <Input p={p} label="Observaciones" value={m.saleNote} onChangeText={a.setSaleNote} editable={!m.orderBusy} placeholder="Indicaciones para cocina (opcional)" />}</View>
      </View>
      {m.selectedSplit && selected ? <View style={[card,{padding:20,gap:10}]}><Text style={{color:p.amber,fontSize:13,fontWeight:'600'}}>Reparto solicitado por el mesero</Text>{m.selectedSplit.divisions.map((part) => summaryLine(part.nombre,part.monto))}<Text style={{color:p.faint,fontSize:11}}>Selecciona «Por partes» para cobrar una persona y conservar el saldo pendiente.</Text></View> : null}
    </View>
    <View style={{ width: columns ? (desktop ? 330 : 290) : '100%', gap: 14 }}>
      <View style={card}>
        <View style={{ padding: 22, gap: 15 }}>
          <Text style={{ color: p.text, fontSize: 16, fontWeight: '600' }}>Resumen de venta</Text>
          <View style={{ gap: 12 }}>{summaryLine(selected ? 'Subtotal' : 'Productos',selected ? m.subtotal : m.cartSubtotal)}{selected ? summaryLine('IVA incluido',m.tax) : null}{summaryLine('Servicio',selected ? m.service : draftService)}</View>
          {selected && (Number(selected.abonado) > 0 || m.chargeMode === 'PARCIAL') ? <View style={{gap:10}}>{summaryLine('Total de cuenta',m.total)}{summaryLine('Abonos registrados',selected.abonado)}{summaryLine('Saldo pendiente',m.balanceDue)}</View> : null}
          {selected ? <View style={{gap:10}}>
            <View style={[row,{gap:7,flexWrap:'wrap'}]}><Chip p={p} active={m.chargeMode==='TOTAL'} onPress={()=>{if(!m.busy){a.setChargeMode('TOTAL');a.setDivisionId(null);}}}>Cobrar saldo</Chip><Chip p={p} active={m.chargeMode==='PARCIAL'} onPress={()=>{if(!m.busy){a.setChargeMode('PARCIAL');a.setDivisionId(null);}}}>Por partes</Chip></View>
            {m.chargeMode==='PARCIAL'?<Input p={p} label="Monto de este abono" value={m.partialAmount} onChangeText={(v)=>{a.setPartialAmount(v.replace(',','.'));a.setDivisionId(null);}} keyboardType="decimal-pad" editable={!m.busy} placeholder="0.00"/>:null}
            {m.chargeMode==='PARCIAL'&&m.selectedSplit?<View style={{gap:7}}>{m.selectedSplit.divisions.map(part=><Chip key={part.id} p={p} active={Number(m.divisionId)===Number(part.id)} onPress={()=>{if(!m.busy){a.setPartialAmount(Number(part.monto).toFixed(2));a.setDivisionId(part.id);}}}>{part.nombre}: {money(part.monto)}</Chip>)}</View>:null}
          </View>:null}
          <View style={{ borderTopWidth: 1, borderTopColor: p.line, paddingTop: 18, gap: 6 }}><Text style={{ color: p.muted, fontSize: 12 }}>Total a cobrar</Text><Text style={[moneyStyle,{color:p.text,fontSize:38,fontWeight:'600',letterSpacing:-1.5}]}>{money(total)}</Text></View>
          {selected ? <>
            <Text style={{ color: p.text, fontSize: 13, fontWeight: '600' }}>Método de pago</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{m.paymentMethods.map(({label,icon:Icon}) => <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Pagar con ${label}`} accessibilityState={{selected:m.paymentMethod === label}} key={label} disabled={m.busy} onPress={() => a.setPaymentMethod(label)} style={{ width:'48%',padding:10,gap:6,flexDirection:'row',alignItems:'center',borderRadius:8,borderWidth:1,borderColor:m.paymentMethod === label?p.primary:p.line,backgroundColor:m.paymentMethod===label?p.primarySoft:p.surface }}><Icon size={18} color={m.paymentMethod===label?p.primaryText:p.faint} /><Text style={{color:m.paymentMethod===label?p.primaryText:p.muted,fontSize:12,fontWeight:'600'}}>{label}</Text></TouchableOpacity>)}</View>
            {m.paymentMethod==='Mixto'?<View style={{gap:10}}>{m.paymentMethods.filter(method=>method.label!=='Mixto').map(method=><Input key={method.label} p={p} label={`Monto ${method.label}`} value={m.mixedAmounts[method.label]||''} keyboardType="decimal-pad" placeholder="0.00" editable={!m.busy} onChangeText={value=>a.setMixedAmounts(old=>({...old,[method.label]:value.replace(',','.')}))}/>)}<Text style={{color:Math.round(m.mixedTotal*100)===Math.round(total*100)?p.green:p.amber,fontSize:12}}>Desglose: {money(m.mixedTotal)} / {money(total)}</Text></View>:null}
            {m.cashPortion > 0 ? <>
              <Input p={p} label="Efectivo recibido" value={m.cashReceived} onChangeText={(value)=>a.setCashReceived(value.replace(',','.'))} keyboardType="decimal-pad" editable={!m.busy} placeholder="0.00" />
              <View style={[row,{gap:6,flexWrap:'wrap'}]}>{[...new Set([m.cashPortion,Math.ceil(m.cashPortion/10)*10,Math.ceil(m.cashPortion/20)*20])].map((amount)=><Chip key={amount} p={p} onPress={()=>!m.busy&&a.setCashReceived(amount.toFixed(2))}>{amount===m.cashPortion?'Exacto':money(amount)}</Chip>)}</View>
              <View style={[row,{justifyContent:'space-between',padding:12,backgroundColor:p.greenSoft,borderRadius:8}]}><Text style={{color:p.green,fontSize:12}}>Cambio a entregar</Text><Text style={[moneyStyle,{color:p.green,fontWeight:'700',fontSize:16}]}>{money(m.change)}</Text></View>
              {Number(m.cashReceived || 0)<m.cashPortion?<Text style={{color:p.amber,fontSize:12}}>Faltan {money(m.cashPortion-Number(m.cashReceived||0))} para completar el pago.</Text>:null}
            </> : <Input p={p} label="Referencia de pago" value={m.reference} onChangeText={a.setReference} placeholder="Voucher, transferencia o nota" editable={!m.busy} />}
            {m.paymentMethod==='Mixto'&&m.cashPortion>0?<Input p={p} label="Referencia de tarjeta o transferencia" value={m.reference} onChangeText={a.setReference} placeholder="Voucher o referencia" editable={!m.busy}/>:null}
            {m.chargeMode==='PARCIAL'&&total>0&&total<=m.balanceDue?<Text style={{color:p.muted,fontSize:12}}>Saldo después de este abono: {money(m.balanceDue-total)}</Text>:null}
            <Action p={p} primary label={m.busy?'Registrando…':`Cobrar ${money(total)}`} icon={CheckCircle2} disabled={!m.canCharge||m.busy||!!m.pendingPayment} onPress={a.handleCharge} style={{minHeight:50}} />
            <Action p={p} label="Imprimir precuenta" icon={Printer} disabled={m.busy} onPress={()=>a.printReceipt()} />
          </> : <>
            <View style={{padding:14,borderRadius:8,backgroundColor:p.surfaceAlt,gap:6}}><Text style={{color:p.text,fontSize:12,fontWeight:'600'}}>Primero confirma el pedido</Text><Text style={{color:p.muted,fontSize:12,lineHeight:19}}>Se enviará a cocina y podrás continuar con los datos de facturación y el pago.</Text></View>
            <Action p={p} primary label={m.orderBusy?'Enviando…':'Confirmar pedido'} icon={ArrowRight} disabled={!lines.length||m.orderBusy||!m.caja?.caja||!m.canManageCash} onPress={()=>{setCatalog(false);a.createPickupOrder();}} style={{minHeight:50}} />
            {lines.length?<Action p={p} label="Vaciar borrador" icon={Trash2} disabled={m.orderBusy} onPress={a.clearCart}/>:null}
          </>}
          {!m.caja?.caja?<Action p={p} label="Abrir caja para vender" icon={WalletCards} onPress={a.handleOpenCaja} disabled={!m.canManageCash}/>:null}
          <View style={[row,{gap:6,justifyContent:'center'}]}><Receipt size={12} color={p.faint}/><Text style={{color:p.faint,fontSize:11}}>El comprobante se genera al cobrar</Text></View>
        </View>
      </View>
      {selected?<Action p={p} label="Elegir otra cuenta" onPress={()=>setSection('cuentas')} icon={Table2}/>:<Action p={p} label={`${m.activeOrders.length} cuentas pendientes`} onPress={()=>setSection('cuentas')} icon={Table2}/>}
    </View>
  </View>;

  const accounts = () => <View style={card}>
    <View style={{padding:20,gap:15}}><View style={[row,{gap:10}]}><Search size={18} color={p.faint}/><Input p={p} value={m.orderSearch} onChangeText={a.setOrderSearch} placeholder="Buscar mesa, pedido o cliente"/></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8}}>{[['TODOS','Todas'],['MESAS','Mesas'],['EXPRESS','Para llevar'],['DELIVERY','Delivery'],['CUENTA','Cobro solicitado']].map(([key,label])=><Chip p={p} key={key} active={m.orderFilter===key} onPress={()=>a.setOrderFilter(key)}>{label}</Chip>)}</ScrollView>
    </View>
    <View style={[row,{paddingHorizontal:20,paddingVertical:13,backgroundColor:p.surfaceAlt}]}><Text style={{flex:1,color:p.faint,fontSize:11}}>CUENTA / CLIENTE</Text>{!phone?<Text style={{width:130,color:p.faint,fontSize:11}}>ESTADO DE COCINA</Text>:null}<Text style={{width:105,textAlign:'right',color:p.faint,fontSize:11}}>POR COBRAR</Text><View style={{width:35}}/></View>
    {m.filteredOrders.map((order)=><TouchableOpacity accessibilityRole="button" accessibilityLabel={`Facturar ${h.orderLabel(order)}`} key={order.id} onPress={()=>chooseOrder(order)} style={[row,{padding:20,borderTopWidth:1,borderTopColor:p.line,gap:12}]}>
      <View style={{width:38,height:38,borderRadius:10,backgroundColor:p.primarySoft,alignItems:'center',justifyContent:'center'}}>{order.mesa_id?<Table2 size={18} color={p.primaryText}/>:<ShoppingBag size={18} color={p.primaryText}/>}</View>
      <View style={{flex:1,minWidth:0,gap:5}}><Text style={{color:p.text,fontSize:14,fontWeight:'600'}}>{h.orderLabel(order)}</Text><Text style={{color:p.faint,fontSize:11}}>Pedido #{order.id} · {(order.items||[]).length} productos</Text></View>
      {!phone?<Text style={{width:130,color:p.muted,fontSize:11}}>{order.estado_cocina||order.estado}</Text>:null}<Text style={[moneyStyle,{width:93,textAlign:'right',color:p.text,fontSize:16,fontWeight:'600'}]}>{money(order.saldo_pendiente ?? order.total)}</Text><ChevronRight size={18} color={p.faint}/>
    </TouchableOpacity>)}
    {!m.filteredOrders.length?empty(Table2,'No hay cuentas en esta vista','Prueba otra búsqueda o cambia el filtro.'):null}
  </View>;

  const payments = () => <CashierPayments p={p} onReprint={a.reprintPayment} onAuthorize={a.openPaymentAuthorization}
    canAuthorize={m.canRequestPaymentActions} busy={m.adminBusy || m.printBusy} version={m.historyVersion}/>;

  const cash = () => <View style={{gap:18}}>
    <View style={[card,{padding:24,gap:20}]}><View style={[row,{justifyContent:'space-between',gap:12,flexWrap:'wrap'}]}><View style={{gap:7}}><Text style={{color:p.text,fontSize:20,fontWeight:'600'}}>Turno {m.caja?.caja?`#${m.caja.caja.id}`:'sin abrir'}</Text><Text style={{color:p.muted,fontSize:13}}>Control de efectivo y movimientos</Text></View><View style={[row,{gap:8}]}><Action p={p} label="Ver cierres" icon={Clock} onPress={a.showHistory}/><Action p={p} primary label={m.caja?.caja?'Cerrar turno':'Abrir caja'} icon={WalletCards} disabled={!m.canManageCash||m.cashBusy} onPress={m.caja?.caja?a.handleCloseCaja:a.handleOpenCaja}/></View></View>
      <View style={{flexDirection:phone?'column':'row',gap:12}}>{[['Cobrado en el turno',m.turnTotals.total],['Efectivo esperado',m.caja?.efectivo_esperado],['Fondo de apertura',m.caja?.caja?.monto_inicial]].map(([label,value])=><View key={label} style={{flex:1,padding:20,borderRadius:9,backgroundColor:p.surfaceAlt,gap:8}}><Text style={{color:p.muted,fontSize:12}}>{label}</Text><Text style={[moneyStyle,{color:p.text,fontSize:26,fontWeight:'600'}]}>{money(value)}</Text></View>)}</View>
      <View style={[row,{gap:10,flexWrap:'wrap'}]}>{[['INGRESO','Registrar ingreso',ArrowDownLeft],['RETIRO','Registrar retiro',ArrowUpRight],['GASTO','Registrar gasto',WalletCards]].map(([key,label,Icon])=><Action p={p} key={key} label={label} icon={Icon} disabled={!m.caja?.caja||!m.canManageCash} onPress={()=>a.openMovement(key)}/>)}</View>
    </View>
    <View style={{flexDirection:columns?'row':'column',gap:18}}><View style={[card,{padding:22,gap:17,flex:1}]}><Text style={{color:p.text,fontSize:15,fontWeight:'600'}}>Cobros por método</Text>{Object.entries(m.stats.byMethod).map(([label,value])=>summaryLine(label,value))}</View>
      <View style={[card,{padding:22,gap:17,flex:1}]}><Text style={{color:p.text,fontSize:15,fontWeight:'600'}}>Movimientos del turno</Text>{(m.caja?.movimientos||[]).map((move)=><View key={move.id} style={[row,{gap:10}]}><View style={{flex:1,gap:4}}><Text style={{color:p.text,fontSize:12,fontWeight:'600'}}>{move.tipo}</Text><Text style={{color:p.faint,fontSize:11}}>{move.motivo}</Text></View><Text style={{color:move.tipo==='INGRESO'?p.green:p.muted,fontWeight:'600'}}>{money(move.monto)}</Text></View>)}{!(m.caja?.movimientos||[]).length?<Text style={{color:p.faint,fontSize:13}}>No hay movimientos registrados.</Text>:null}</View></View>
  </View>;

  return <SafeAreaView style={{flex:1,backgroundColor:p.bg,paddingTop:TOP_INSET}}>
    <View style={{flex:1,flexDirection:'row'}}>
      {columns?<View style={{width:desktop?206:72,backgroundColor:p.sidebar,padding:desktop?18:12,gap:28}}>
        <View style={{height:60,justifyContent:'center',alignItems:desktop?'flex-start':'center'}}>{desktop?<Logo dark height={45}/>:<Receipt size={26} color="#93C5FD"/>}</View>
        <View style={{gap:7}}>{desktop?<Text style={{color:'#8494AE',fontSize:10,letterSpacing:1.8,fontWeight:'600',marginBottom:9,marginLeft:12}}>PUNTO DE VENTA</Text>:null}{nav.map(([key,label,Icon])=><TouchableOpacity accessibilityRole="button" accessibilityLabel={label} accessibilityState={{selected:section===key}} key={key} onPress={()=>setSection(key)} style={[row,{gap:11,paddingVertical:13,paddingHorizontal:desktop?12:0,justifyContent:desktop?'flex-start':'center',backgroundColor:section===key?'#223B63':'transparent',borderRadius:9}]}><Icon size={19} color={section===key?'#FFFFFF':'#94A3B8'}/>{desktop?<Text style={{color:section===key?'#FFFFFF':'#CBD5E1',fontSize:13,fontWeight:section===key?'600':'400'}}>{label}</Text>:null}</TouchableOpacity>)}</View>
        <View style={{flex:1}}/>{desktop?<View style={{padding:14,borderRadius:10,borderWidth:1,borderColor:'#2A3A54',gap:8}}><View style={[row,{gap:6}]}><View style={{width:6,height:6,borderRadius:3,backgroundColor:m.caja?.caja?'#8DCEAC':'#93C5FD'}}/><Text style={{color:'#E2E8F0',fontSize:12}}>Caja {m.caja?.caja?'abierta':'cerrada'}</Text></View><Text style={{color:'#94A3B8',fontSize:11}}>Tu operación, en un solo lugar.</Text></View>:null}
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Cerrar sesión" onPress={a.logout} style={[row,{gap:10,padding:12}]}><LogOut size={18} color="#94A3B8"/>{desktop?<Text style={{color:'#CBD5E1',fontSize:12}}>Cerrar sesión</Text>:null}</TouchableOpacity>
      </View>:null}
      <View style={{flex:1,minWidth:0}}>
        <View style={[row,{minHeight:70,paddingHorizontal:pad,gap:12,backgroundColor:p.surface,borderBottomWidth:1,borderBottomColor:p.line}]}>
          <Text style={{color:p.faint,fontSize:12}}>Punto de venta</Text><ChevronRight size={13} color={p.faint}/><Text style={{color:p.text,fontSize:12,fontWeight:'600',flex:1}}>{title}</Text>
          {!phone?<View style={[row,{gap:6}]}>{m.connected?<Wifi size={14} color={p.green}/>:<WifiOff size={14} color={p.amber}/>}<Text style={{color:p.muted,fontSize:11}}>{m.connected?'Conectado':'Reconectando'}</Text></View>:null}
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={m.isDark?'Usar tema claro':'Usar tema oscuro'} onPress={a.toggleTheme} style={{padding:9}}>{m.isDark?<Sun size={17} color={p.muted}/>:<Moon size={17} color={p.muted}/>}</TouchableOpacity>
          <View style={[row,{gap:9}]}><View style={{width:32,height:32,borderRadius:16,backgroundColor:p.primarySoft,alignItems:'center',justifyContent:'center'}}><Text style={{color:p.primaryText,fontWeight:'600',fontSize:12}}>{(m.user?.nombre||'C').slice(0,2).toUpperCase()}</Text></View>{desktop?<Text style={{fontSize:12,color:p.text}}>{m.user?.nombre||'Caja'}</Text>:null}</View>
        </View>
        {!columns?<ScrollView horizontal style={{flexGrow:0,backgroundColor:p.surface}} showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal:pad,paddingVertical:10,gap:8}}>{nav.map(([key,label,Icon])=><Action compact key={key} p={p} label={label} icon={Icon} onPress={()=>setSection(key)} style={section===key?{backgroundColor:p.primarySoft,borderColor:p.primary}:null}/>)}</ScrollView>:null}
        <ScrollView ref={scrollRef} style={{flex:1}} contentContainerStyle={{padding:pad,paddingBottom:BOTTOM_INSET+24,gap:22}}>
          <View style={[row,{justifyContent:'space-between',gap:14,flexWrap:'wrap'}]}><View style={{gap:7}}><Text style={{color:p.text,fontSize:phone?25:30,fontWeight:'600',letterSpacing:-0.8}}>{title}</Text><Text style={{color:p.muted,fontSize:12}}>{section==='venta'?'Gestiona tus ventas y comprobantes.':date}</Text></View><Action p={p} label="Nueva venta" icon={Plus} primary onPress={newSale} disabled={m.busy||m.orderBusy}/></View>
          <View style={{flexDirection:'row',gap:phone?8:14}}>{[['Ventas del turno',money(m.turnTotals.total),Receipt],['Por cobrar',money(m.activeOrders.reduce((sum,o)=>sum+Number(o.saldo_pendiente ?? o.total ?? 0),0)),WalletCards],['Cuentas abiertas',String(m.activeOrders.length).padStart(2,'0'),Table2]].map(([label,value,Icon])=><View key={label} style={[card,{flex:1,padding:phone?12:17,gap:10}]}><View style={[row,{justifyContent:'space-between'}]}><Text style={{fontSize:phone?10:11,color:p.muted}}>{label}</Text>{!phone?<Icon size={15} color={p.faint}/>:null}</View><Text style={[moneyStyle,{fontSize:phone?18:24,fontWeight:'600',color:p.text,letterSpacing:-0.5}]}>{value}</Text></View>)}</View>
          {m.pendingPayment?<View style={{padding:16,borderRadius:10,backgroundColor:p.amberSoft,gap:10}}><Text style={{color:p.text,fontSize:13}}>Hay un cobro por confirmar del pedido #{m.pendingPayment.pedido_id}. Reintenta para recuperar el resultado sin duplicarlo.</Text><Action p={p} label="Reintentar cobro pendiente" disabled={m.busy} onPress={a.handleCharge}/></View>:null}
          {m.cashNotice?<View style={[row,{padding:13,borderRadius:9,backgroundColor:m.cashNotice.type==='error'?p.redSoft:p.greenSoft,gap:10}]}><CheckCircle2 size={17} color={p.green}/><Text style={{flex:1,color:p.text,fontSize:12}}>{m.cashNotice.title} · {m.cashNotice.message}</Text><TouchableOpacity accessibilityRole="button" accessibilityLabel="Cerrar aviso" onPress={a.dismissNotice}><X size={16} color={p.muted}/></TouchableOpacity></View>:null}
          {section==='venta'?invoice():section==='cuentas'?accounts():section==='pagos'?payments():cash()}
          {!columns?<Action p={p} label="Cerrar sesión" icon={LogOut} onPress={a.logout}/>:null}
        </ScrollView>
      </View>
    </View>
    <Modal visible={catalog} transparent animationType="fade" onRequestClose={()=>setCatalog(false)}>
      <View style={{flex:1,backgroundColor:'rgba(15,23,42,0.55)',alignItems:'center',justifyContent:'center',padding:phone?10:28}}><View style={[card,{width:'100%',maxWidth:920,maxHeight:'92%'}]}>
        <View style={[row,{padding:20,borderBottomWidth:1,borderBottomColor:p.line,gap:12,flexShrink:0}]}><ShoppingBag size={21} color={p.primaryText}/><View style={{flex:1,gap:4}}><Text style={{color:p.text,fontSize:phone?17:20,fontWeight:'600'}}>Catálogo de productos</Text><Text style={{color:p.faint,fontSize:12}}>Selecciona los productos para esta venta.</Text></View><Action p={p} label="Cerrar" icon={X} compact onPress={()=>setCatalog(false)}/></View>
        <View style={{padding:20,gap:12,flexShrink:0}}><Input style={{flex:undefined}} p={p} value={m.menuSearch} onChangeText={a.setMenuSearch} placeholder="Buscar producto…"/><ScrollView horizontal style={{flexGrow:0}} showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:7}}>{m.menuCategories.map((category)=><Chip key={category} p={p} active={category===m.menuCategory} onPress={()=>a.setMenuCategory(category)}>{category==='TODAS'?'Todas las categorías':category}</Chip>)}</ScrollView></View>
        <ScrollView contentContainerStyle={{padding:20,paddingTop:0,flexDirection:'row',flexWrap:'wrap',gap:12}}>{m.filteredMenu.map((product)=>{const qty=m.cart.find((item)=>Number(item.producto_id)===Number(product.id))?.cantidad||0;return <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Agregar ${product.nombre}`} disabled={m.orderBusy||!m.canManageCash} key={product.id} onPress={()=>a.addToCart(product)} style={{width:phone?'47%':'31.5%',borderRadius:10,borderWidth:1,borderColor:qty?p.primary:p.line,overflow:'hidden',backgroundColor:p.surface}}>
          <View style={{height:phone?100:125,backgroundColor:p.surfaceAlt,alignItems:'center',justifyContent:'center'}}>{product.imagen_url?<Image source={{uri:h.assetUrl(product.imagen_url)}} style={{width:'100%',height:'100%'}} resizeMode="cover"/>:<ShoppingBag size={28} color={p.faint}/>}<View style={{position:'absolute',right:9,top:9,width:28,height:28,backgroundColor:qty?p.primary:p.surface,borderRadius:8,alignItems:'center',justifyContent:'center'}}>{qty?<Text style={{color:p.onPrimary,fontWeight:'600'}}>{qty}</Text>:<Plus size={16} color={p.text}/>}</View></View>
          <View style={{padding:13,gap:6}}><Text style={{color:p.text,fontSize:13,fontWeight:'600'}}>{product.nombre}</Text><Text style={{color:p.faint,fontSize:11}}>{product.categoria_nombre||product.categoria||'General'}</Text><Text style={[moneyStyle,{color:p.primaryText,fontSize:17,fontWeight:'600',marginTop:3}]}>{money(product.precio)}</Text></View>
        </TouchableOpacity>;})}{!m.filteredMenu.length?<View style={{width:'100%'}}>{empty(Search,'Sin resultados','Prueba con otro nombre o categoría.')}</View>:null}</ScrollView>
        <View style={[row,{padding:20,borderTopWidth:1,borderTopColor:p.line,justifyContent:'space-between',gap:12,flexShrink:0}]}><Text style={{color:p.muted,fontSize:13}}>{m.cart.reduce((sum,item)=>sum+Number(item.cantidad),0)} productos · {money(m.cartTotal)}</Text><Action p={p} primary label="Volver a la venta" icon={ArrowRight} onPress={()=>setCatalog(false)}/></View>
      </View></View>
    </Modal>
  </SafeAreaView>;
}
