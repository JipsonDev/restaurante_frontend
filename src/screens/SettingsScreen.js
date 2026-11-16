import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import { AlertTriangle, Building2, Calculator, Check, CheckCircle2, ChefHat, CircleDollarSign, Database, FileText, ImageIcon, Printer, ReceiptText, RefreshCw, RotateCcw, Save, Search, Server, Settings2, ShieldCheck, Upload, Wifi } from 'lucide-react-native';
import { assetUrl, BASE_URL } from '../context/AuthContext';
import { useAdmin } from '../context/AdminContext';
import { useTheme } from '../theme';
import { MenuButton, MenuField, MenuNotice } from '../components/MenuUI';
import { settingsPayload, ticketPreview } from '../utils/settingsLogic.mjs';

const row = { flexDirection: 'row', alignItems: 'center' };
const DEFAULTS = {
  nombre_restaurante: '', razon_social: '', ruc: '', direccion: '', telefono: '', correo: '', logo_url: '',
  iva_porcentaje: '0', servicio_porcentaje: '0', moneda: 'USD', simbolo_moneda: '$', texto_ticket: '',
  impresora_caja: '', impresora_cocina: '',
  alertas_demora_activas: '1', alerta_espera_minutos: '20', alerta_lista_minutos: '5',
};
const SECTIONS = [
  { key: 'negocio', label: 'Negocio', hint: 'Identidad y contacto', icon: Building2 },
  { key: 'facturacion', label: 'Facturación', hint: 'Impuestos y moneda', icon: Calculator },
  { key: 'ticket', label: 'Comprobante', hint: 'Logo y contenido', icon: ReceiptText },
  { key: 'impresoras', label: 'Impresoras', hint: 'Caja y cocina', icon: Printer },
  { key: 'sistema', label: 'Sistema', hint: 'Conexión y estado', icon: Server },
  { key: 'atencion', label: 'Atención', hint: 'Demoras y avisos', icon: ChefHat },
];
const normalizedConfig = config => Object.fromEntries(Object.entries({ ...DEFAULTS, ...(config || {}) }).map(([key, value]) => [key, value == null ? '' : String(value)]));
const errorText = error => error.response?.data?.message || error.response?.data?.error || error.message || 'No se pudo completar la operación.';

function SectionTitle({ icon: Icon, title, subtitle, action, compact = false }) {
  const { c } = useTheme();
  return <View style={[compact ? { gap: 12 } : row, { paddingBottom: 16, borderBottomWidth: 1, borderColor: c.line }]}><View style={[row, { flex: 1, minWidth: 0, gap: 11 }]}><View style={{ width: 38, height: 38, borderRadius: 9, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' }}><Icon size={19} color={c.primaryText} /></View><View style={{ flex: 1, minWidth: 0 }}><Text style={{ color: c.text, fontSize: 17, fontWeight: '700' }}>{title}</Text><Text style={{ color: c.muted, fontSize: 11, lineHeight: 17, marginTop: 3 }}>{subtitle}</Text></View></View>{action && <View style={{ alignSelf: compact ? 'stretch' : 'center' }}>{action}</View>}</View>;
}

function StatusRow({ icon: Icon, title, detail, ok, warning }) {
  const { c } = useTheme();
  const color = warning ? c.amber : ok ? c.green : c.muted;
  const soft = warning ? c.amberSoft : ok ? c.greenSoft : c.soft;
  return <View style={[row, { minHeight: 62, gap: 11, paddingVertical: 11, borderBottomWidth: 1, borderColor: c.line }]}><View style={{ width: 34, height: 34, borderRadius: 8, backgroundColor: soft, alignItems: 'center', justifyContent: 'center' }}><Icon size={17} color={color} /></View><View style={{ flex: 1, minWidth: 0 }}><Text style={{ color: c.text, fontSize: 12, fontWeight: '700' }}>{title}</Text><Text numberOfLines={2} style={{ color: c.muted, fontSize: 10, lineHeight: 15, marginTop: 3 }}>{detail}</Text></View><View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color }} /></View>;
}

function Ticket({ form }) {
  const preview = ticketPreview(form, 10);
  const symbol = form.simbolo_moneda || '$';
  const format = value => `${symbol}${Number(value).toFixed(2)}`;
  return <View style={{ backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CBD5E1', padding: 18, width: '100%', maxWidth: 330, alignSelf: 'center' }}>
    <Text style={{ color: '#0F172A', textAlign: 'center', fontSize: 16, fontWeight: '800' }}>{form.nombre_restaurante || 'Nombre del restaurante'}</Text><Text style={{ color: '#475569', textAlign: 'center', fontSize: 9, marginTop: 4 }}>{form.razon_social || 'Razón social'}</Text><Text style={{ color: '#475569', textAlign: 'center', fontSize: 9, marginTop: 2 }}>{form.ruc ? `RUC: ${form.ruc}` : 'RUC pendiente'}</Text><Text style={{ color: '#475569', textAlign: 'center', fontSize: 9, marginTop: 2 }}>{form.direccion || 'Dirección pendiente'}</Text>
    <View style={{ height: 1, backgroundColor: '#CBD5E1', marginVertical: 13 }} /><Text style={{ color: '#0F172A', fontSize: 10, fontWeight: '800' }}>FACTURA FAC-000000123</Text><Text style={{ color: '#475569', fontSize: 9, marginTop: 5 }}>Consumidor final · Efectivo</Text><View style={{ height: 1, backgroundColor: '#E2E8F0', marginVertical: 11 }} />
    {[['Subtotal', preview.subtotal], [`IVA ${Number(form.iva_porcentaje || 0)}%`, preview.tax], [`Servicio ${Number(form.servicio_porcentaje || 0)}%`, preview.service]].map(([label, value]) => <View key={label} style={[row, { justifyContent: 'space-between', marginBottom: 6 }]}><Text style={{ color: '#475569', fontSize: 9 }}>{label}</Text><Text style={{ color: '#334155', fontSize: 9 }}>{format(value)}</Text></View>)}<View style={{ height: 1, backgroundColor: '#CBD5E1', marginVertical: 7 }} /><View style={[row, { justifyContent: 'space-between' }]}><Text style={{ color: '#0F172A', fontSize: 11, fontWeight: '800' }}>TOTAL</Text><Text style={{ color: '#0F172A', fontSize: 11, fontWeight: '800' }}>{format(preview.total)}</Text></View><Text style={{ color: '#475569', textAlign: 'center', fontSize: 9, fontWeight: '700', marginTop: 15 }}>{form.texto_ticket || 'Gracias por su compra'}</Text>
  </View>;
}

export default function SettingsScreen() {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const compact = width < 780;
  const phone = width < 480;
  const { configuracion, updateConfiguracion, uploadLogoConfiguracion } = useAdmin();
  const [section, setSection] = useState('negocio');
  const [form, setForm] = useState(DEFAULTS);
  const [busy, setBusy] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const [printerBusy, setPrinterBusy] = useState(false);
  const [printers, setPrinters] = useState([]);
  const [printersLoaded, setPrintersLoaded] = useState(false);
  const [systemStatus, setSystemStatus] = useState(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const baseline = useRef('');
  const dirtyRef = useRef(false);
  const signature = JSON.stringify(form);
  const dirty = !!baseline.current && signature !== baseline.current;
  dirtyRef.current = dirty;
  const validationIssue = useMemo(() => {
    try { settingsPayload(form); return ''; }
    catch (validationError) { return validationError.message; }
  }, [signature]);

  useEffect(() => {
    if (!configuracion || (dirtyRef.current && baseline.current)) return;
    const next = normalizedConfig(configuracion);
    setForm(next); baseline.current = JSON.stringify(next);
  }, [configuracion]);

  const loadSystemStatus = async () => {
    try { const { data } = await axios.get(`${BASE_URL}/impresiones/estado`, { timeout: 10000 }); setSystemStatus({ ok: true, ...data }); }
    catch (error) { setSystemStatus({ ok: false, error: errorText(error) }); }
  };
  useEffect(() => { loadSystemStatus(); }, []);

  const change = (key, value) => { setNotice(''); setError(''); setForm(previous => ({ ...previous, [key]: value })); };
  const reset = () => { const next = normalizedConfig(configuracion); setForm(next); baseline.current = JSON.stringify(next); setError(''); setNotice('Cambios descartados.'); };
  const save = async () => {
    if (busy) return;
    try {
      setBusy(true); setError(''); setNotice('');
      const payload = settingsPayload(form);
      const saved = normalizedConfig(await updateConfiguracion(payload));
      setForm(saved); baseline.current = JSON.stringify(saved); setNotice('Configuración guardada. Los meseros recibirán los nuevos límites en la próxima actualización.');
    } catch (error) { setError(errorText(error)); }
    finally { setBusy(false); }
  };
  const pickLogo = async () => {
    if (logoBusy) return;
    try {
      setLogoBusy(true); setError('');
      if (Platform.OS !== 'web') { const permission = await ImagePicker.requestMediaLibraryPermissionsAsync(); if (!permission.granted) throw new Error('Se necesita acceso a la galería para seleccionar el logo.'); }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 0.9 });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      if (asset.fileSize > 4 * 1024 * 1024) throw new Error('El logo debe pesar como máximo 4 MB.');
      const data = new FormData();
      if (Platform.OS === 'web') { const response = await fetch(asset.uri); data.append('logo', await response.blob(), asset.fileName || 'logo.png'); }
      else data.append('logo', { uri: asset.uri, name: asset.fileName || 'logo.png', type: asset.mimeType || 'image/png' });
      const uploaded = await uploadLogoConfiguracion(data);
      const logoUrl = uploaded.logo_url;
      setForm(previous => ({ ...previous, logo_url: logoUrl }));
      const base = baseline.current ? JSON.parse(baseline.current) : normalizedConfig(configuracion);
      baseline.current = JSON.stringify({ ...base, logo_url: logoUrl });
      setNotice('Logo cargado correctamente.');
    } catch (error) { setError(errorText(error)); }
    finally { setLogoBusy(false); }
  };
  const loadPrinters = async () => {
    try { setPrinterBusy(true); setError(''); const { data } = await axios.get(`${BASE_URL}/configuracion/impresoras`, { timeout: 15000 }); setPrinters(Array.isArray(data) ? data : []); setPrintersLoaded(true); }
    catch (error) { setError(errorText(error)); }
    finally { setPrinterBusy(false); }
  };

  const panel = { flex: 1, minWidth: 0, padding: phone ? 12 : compact ? 14 : 20, gap: phone ? 15 : 18 };
  const nav = compact ? <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0, height: 58, maxHeight: 58, borderBottomWidth: 1, borderColor: c.line }} contentContainerStyle={{ height: 58, paddingHorizontal: 9, gap: 6, alignItems: 'center' }}>{SECTIONS.map(item => { const Icon = item.icon; return <Pressable key={item.key} accessibilityRole="button" accessibilityState={{ selected: section === item.key }} onPress={() => setSection(item.key)} style={[row, { minHeight: 38, paddingHorizontal: 11, gap: 6, borderRadius: 7, borderWidth: 1, borderColor: section === item.key ? c.primary : c.line, backgroundColor: section === item.key ? c.primarySoft : c.surface }]}><Icon size={14} color={section === item.key ? c.primaryText : c.muted} /><Text style={{ color: section === item.key ? c.primaryText : c.muted, fontSize: 10, fontWeight: section === item.key ? '700' : '500' }}>{item.label}</Text></Pressable>; })}</ScrollView> : <View style={{ width: 222, padding: 12, backgroundColor: c.surfaceAlt, borderRightWidth: 1, borderColor: c.line }}><Text style={{ color: c.faint, fontSize: 9, fontWeight: '700', letterSpacing: 1.2, marginHorizontal: 9, marginVertical: 10 }}>CONFIGURACIÓN</Text>{SECTIONS.map(item => { const Icon = item.icon; const selected = section === item.key; return <Pressable key={item.key} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => setSection(item.key)} style={({ hovered }) => [row, { minHeight: 54, padding: 9, gap: 10, borderRadius: 8, backgroundColor: selected ? c.surface : hovered ? c.soft : 'transparent', borderWidth: selected ? 1 : 0, borderColor: c.line }]}><View style={{ width: 31, height: 31, borderRadius: 7, backgroundColor: selected ? c.primarySoft : c.soft, alignItems: 'center', justifyContent: 'center' }}><Icon size={16} color={selected ? c.primaryText : c.muted} /></View><View style={{ flex: 1 }}><Text style={{ color: selected ? c.text : c.muted, fontSize: 11, fontWeight: selected ? '700' : '600' }}>{item.label}</Text><Text style={{ color: c.faint, fontSize: 9, marginTop: 3 }}>{item.hint}</Text></View></Pressable>; })}<View style={{ marginTop: 'auto', padding: 10, borderTopWidth: 1, borderColor: c.line }}><View style={[row, { gap: 7 }]}><ShieldCheck size={14} color={c.green} /><Text style={{ color: c.muted, fontSize: 9 }}>Cambios auditados</Text></View></View></View>;

  return <View style={{ flex: 1 }}><ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingBottom: 28 }}>
    <View style={{ flexDirection: compact ? 'column' : 'row', alignItems: compact ? 'stretch' : 'center', justifyContent: 'space-between', gap: 13 }}><View style={{ flex: 1, minWidth: 0 }}><Text style={{ color: c.primaryText, fontSize: 10, fontWeight: '700', letterSpacing: 1.5 }}>ADMINISTRACIÓN DEL SISTEMA</Text><Text accessibilityRole="header" style={{ color: c.text, fontSize: compact ? 25 : 30, fontWeight: '700', letterSpacing: -0.7, marginTop: 6 }}>Ajustes</Text><Text style={{ color: c.muted, fontSize: 12, lineHeight: 18, marginTop: 5 }}>Negocio, facturación, atención e impresión desde un solo lugar.</Text></View><View style={[row, { gap: 7, alignSelf: compact ? 'flex-start' : 'center' }]}>{dirty && <MenuButton icon={RotateCcw} disabled={busy} onPress={reset}>Deshacer</MenuButton>}<MenuButton primary={dirty && !validationIssue} icon={dirty ? Save : CheckCircle2} busy={busy} disabled={!dirty || !!validationIssue} onPress={save}>{dirty ? 'Guardar cambios' : 'Todo guardado'}</MenuButton></View></View>
    {!!notice && <View style={[row, { padding: 11, gap: 8, borderRadius: 8, backgroundColor: c.greenSoft }]}><Check size={16} color={c.green} /><Text accessibilityLiveRegion="polite" style={{ flex: 1, color: c.green, fontSize: 11 }}>{notice}</Text></View>}
    {!!error && <MenuNotice danger>{error}</MenuNotice>}
    {dirty && !!validationIssue && <MenuNotice danger>{validationIssue}</MenuNotice>}
    <View style={{ flexDirection: compact ? 'column' : 'row', minHeight: compact ? 0 : 580, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: 10, overflow: 'hidden' }}>{nav}
      {section === 'negocio' && <View style={panel}><SectionTitle icon={Building2} title="Identidad del negocio" subtitle="Información que aparecerá en facturas, tickets y documentos." />
        <View style={{ flexDirection: compact ? 'column' : 'row', gap: 13 }}><MenuField containerStyle={{ flex: 1 }} label="Nombre comercial" value={form.nombre_restaurante} onChangeText={value => change('nombre_restaurante', value)} placeholder="Morena Mia" maxLength={120} /><MenuField containerStyle={{ flex: 1 }} label="Razón social" value={form.razon_social} onChangeText={value => change('razon_social', value)} placeholder="Razón social registrada" maxLength={180} /></View>
        <View style={{ flexDirection: compact ? 'column' : 'row', gap: 13 }}><MenuField containerStyle={{ flex: 1 }} label="RUC / identificación fiscal" value={form.ruc} onChangeText={value => change('ruc', value.replace(/\D/g, '').slice(0, 13))} placeholder="13 dígitos" keyboardType="number-pad" maxLength={13} /><MenuField containerStyle={{ flex: 1 }} label="Teléfono" value={form.telefono} onChangeText={value => change('telefono', value)} placeholder="+593 99 000 0000" keyboardType="phone-pad" maxLength={40} /></View>
        <MenuField label="Dirección fiscal" value={form.direccion} onChangeText={value => change('direccion', value)} placeholder="Calle, número, ciudad" maxLength={240} /><MenuField label="Correo de facturación" value={form.correo} onChangeText={value => change('correo', value)} placeholder="facturacion@restaurante.com" autoCapitalize="none" keyboardType="email-address" maxLength={160} />
      </View>}
      {section === 'facturacion' && <View style={panel}><SectionTitle icon={Calculator} title="Facturación y cargos" subtitle="Define cómo calcula el sistema los próximos cobros." />
        <MenuNotice>Los cambios se aplican a pedidos y cobros futuros. Los comprobantes ya emitidos conservan sus valores originales.</MenuNotice>
        <View style={{ flexDirection: compact ? 'column' : 'row', gap: 13 }}><MenuField containerStyle={{ flex: 1 }} label="IVA (%)" value={form.iva_porcentaje} onChangeText={value => change('iva_porcentaje', value)} placeholder="15" keyboardType="decimal-pad" maxLength={7} /><MenuField containerStyle={{ flex: 1 }} label="Servicio (%)" value={form.servicio_porcentaje} onChangeText={value => change('servicio_porcentaje', value)} placeholder="10" keyboardType="decimal-pad" maxLength={7} /></View>
        <View style={{ flexDirection: compact ? 'column' : 'row', gap: 13 }}><MenuField containerStyle={{ flex: 1 }} label="Código de moneda" value={form.moneda} onChangeText={value => change('moneda', value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3))} placeholder="USD" autoCapitalize="characters" maxLength={3} /><MenuField containerStyle={{ flex: 1 }} label="Símbolo" value={form.simbolo_moneda} onChangeText={value => change('simbolo_moneda', value.slice(0, 5))} placeholder="$" maxLength={5} /></View>
        <View style={{ padding: 15, borderRadius: 8, backgroundColor: c.surfaceAlt, gap: 10 }}><Text style={{ color: c.text, fontSize: 12, fontWeight: '700' }}>Vista rápida sobre $10,00</Text>{Object.entries(ticketPreview(form, 10)).map(([key, value]) => <View key={key} style={[row, { justifyContent: 'space-between' }]}><Text style={{ color: key === 'total' ? c.text : c.muted, fontSize: 11, fontWeight: key === 'total' ? '700' : '500' }}>{({ subtotal: 'Subtotal', tax: 'IVA', service: 'Servicio', total: 'Total a cobrar' })[key]}</Text><Text style={{ color: key === 'total' ? c.primaryText : c.text, fontSize: 11, fontWeight: '700' }}>{form.simbolo_moneda || '$'}{Number(value).toFixed(2)}</Text></View>)}</View>
      </View>}
      {section === 'ticket' && <View style={panel}><SectionTitle compact={phone} icon={ReceiptText} title="Comprobante y marca" subtitle="Personaliza el logo y el mensaje del ticket." action={<MenuButton icon={Upload} busy={logoBusy} onPress={pickLogo}>Cambiar logo</MenuButton>} />
        <View style={{ flexDirection: compact ? 'column' : 'row', gap: 18, alignItems: 'flex-start' }}><View style={{ flex: 1, minWidth: 0, width: '100%', gap: 16 }}><View style={{ minHeight: 132, borderRadius: 9, borderWidth: 1, borderColor: c.line, backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center', padding: 14 }}>{form.logo_url ? <Image source={{ uri: assetUrl(form.logo_url) }} resizeMode="contain" style={{ width: '100%', maxWidth: 240, height: 94 }} /> : <><ImageIcon size={31} color={c.faint} /><Text style={{ color: c.muted, fontSize: 10, marginTop: 8 }}>Aún no hay un logo cargado</Text></>}</View><MenuField label="URL del logo" value={form.logo_url} onChangeText={value => change('logo_url', value)} placeholder="/uploads/configuracion/logo.png" autoCapitalize="none" maxLength={500} /><MenuField label="Mensaje al pie" value={form.texto_ticket} onChangeText={value => change('texto_ticket', value)} placeholder="Gracias por su compra" multiline maxLength={400} style={{ minHeight: 90 }} hint={`${form.texto_ticket.length}/400 caracteres`} /></View><View style={{ width: compact ? '100%' : 350 }}><Ticket form={form} /></View></View>
      </View>}
      {section === 'impresoras' && <View style={panel}><SectionTitle compact={phone} icon={Printer} title="Impresoras de tickets" subtitle="Asigna una impresora instalada para caja y otra para cocina." action={<MenuButton icon={Search} busy={printerBusy} onPress={loadPrinters}>Buscar</MenuButton>} />
        <MenuNotice>Las impresoras USB, Bluetooth o de red deben estar instaladas en el equipo que ejecuta el backend o el agente de impresión.</MenuNotice>
        <View style={{ flexDirection: compact ? 'column' : 'row', gap: 13 }}><MenuField containerStyle={{ flex: 1 }} label="Impresora de caja" value={form.impresora_caja} onChangeText={value => change('impresora_caja', value)} placeholder="Ej. EPSON TM-T20 Caja" maxLength={180} /><MenuField containerStyle={{ flex: 1 }} label="Impresora de cocina" value={form.impresora_cocina} onChangeText={value => change('impresora_cocina', value)} placeholder="Ej. EPSON Cocina" maxLength={180} /></View>
        {printersLoaded && !printers.length && <View style={{ alignItems: 'center', padding: 28, borderWidth: 1, borderColor: c.line, borderRadius: 8, backgroundColor: c.surfaceAlt }}><Printer size={28} color={c.faint} /><Text style={{ color: c.text, fontSize: 12, fontWeight: '700', marginTop: 10 }}>No se detectaron impresoras</Text><Text style={{ color: c.muted, fontSize: 10, textAlign: 'center', lineHeight: 16, marginTop: 5 }}>Instala la impresora de tickets en Windows y vuelve a buscar.</Text></View>}
        {printers.map(printer => <View key={printer.name} style={[row, { gap: 11, padding: 12, borderWidth: 1, borderColor: c.line, borderRadius: 8, flexWrap: 'wrap' }]}><View style={{ width: 34, height: 34, borderRadius: 8, backgroundColor: c.skySoft, alignItems: 'center', justifyContent: 'center' }}><Printer size={17} color={c.sky} /></View><View style={{ flex: 1, minWidth: 160 }}><Text style={{ color: c.text, fontSize: 11, fontWeight: '700' }}>{printer.name}</Text><Text style={{ color: c.muted, fontSize: 9, marginTop: 3 }}>{[printer.connection, printer.port, printer.driver].filter(Boolean).join(' · ') || 'Impresora del sistema'}</Text></View><View style={[row, { gap: 6 }]}><MenuButton disabled={form.impresora_caja === printer.name} onPress={() => change('impresora_caja', printer.name)}>Usar en caja</MenuButton><MenuButton disabled={form.impresora_cocina === printer.name} onPress={() => change('impresora_cocina', printer.name)}>Usar en cocina</MenuButton></View></View>)}
      </View>}
      {section === 'atencion' && <View style={panel}>
        <SectionTitle icon={ChefHat} title="Tiempos de atención" subtitle="Límites compartidos por todos los meseros. Se aplican también a las rondas activas." />
        <View style={[row,{gap:16,paddingVertical:8}]}>
          <View style={{flex:1,gap:5}}><Text style={{color:c.text,fontSize:14}}>Alertas por demora</Text><Text style={{color:c.muted,fontSize:12,lineHeight:18}}>Avisar al mesero responsable mientras tiene abierta la aplicación.</Text></View>
          <Pressable accessibilityRole="switch" accessibilityLabel="Alertas por demora" accessibilityState={{checked:form.alertas_demora_activas==='1'}} {...(Platform.OS==='web'?{'aria-checked':form.alertas_demora_activas==='1'}:{})} onPress={()=>change('alertas_demora_activas',form.alertas_demora_activas==='1'?'0':'1')} style={{minWidth:64,minHeight:44,alignItems:'center',justifyContent:'center'}}>
            <View style={{width:44,height:24,borderRadius:12,padding:3,backgroundColor:form.alertas_demora_activas==='1'?c.primary:c.line,alignItems:form.alertas_demora_activas==='1'?'flex-end':'flex-start'}}><View style={{width:18,height:18,borderRadius:9,backgroundColor:c.surface}}/></View>
          </Pressable>
        </View>
        <View style={{flexDirection:compact?'column':'row',gap:18}}>
          <MenuField containerStyle={{flex:1}} label="Espera en cocina (minutos)" hint="Desde que se envía una ronda hasta que está lista." value={form.alerta_espera_minutos} onChangeText={value=>change('alerta_espera_minutos',value)} keyboardType="number-pad" maxLength={3}/>
          <MenuField containerStyle={{flex:1}} label="Lista para entregar (minutos)" hint="Desde que cocina marca la ronda como lista." value={form.alerta_lista_minutos} onChangeText={value=>change('alerta_lista_minutos',value)} keyboardType="number-pad" maxLength={3}/>
        </View>
        <View style={{borderTopWidth:1,borderColor:c.line,paddingTop:18,gap:10}}>
          <Text style={{color:c.text,fontSize:13}}>Un aviso útil, sin insistencia</Text>
          <Text style={{color:c.muted,fontSize:12,lineHeight:20}}>Cada fase de una ronda se avisa una sola vez por mesero, incluso si usa varios equipos. Las nuevas demoras se agrupan con al menos 2 minutos entre avisos, sin sonido.</Text>
          <Text style={{color:c.muted,fontSize:12,lineHeight:20}}>La lista de alertas permanece disponible hasta entregar o cancelar la ronda, o hasta que deje de superar el límite. Desactivar las alertas no reinicia los avisos ya registrados.</Text>
        </View>
      </View>}
      {section === 'sistema' && <View style={panel}><SectionTitle compact={phone} icon={Server} title="Estado del sistema" subtitle="Comprueba la conexión y la cola automática de comandas." action={<MenuButton icon={RefreshCw} onPress={loadSystemStatus}>Actualizar</MenuButton>} />
        <View><StatusRow icon={Database} title="Base de datos y API" detail={BASE_URL} ok /><StatusRow icon={Wifi} title="Conexión del panel" detail="La aplicación está comunicándose con el backend del restaurante." ok /><StatusRow icon={Printer} title="Cola de comandas" detail={systemStatus?.ok ? `${Number(systemStatus.counts?.PENDIENTE || 0)} pendientes · ${Number(systemStatus.counts?.ERROR || 0)} con error · ${Number(systemStatus.counts?.REVISAR || 0)} por revisar` : systemStatus?.error || 'Consultando estado…'} ok={systemStatus?.ok && !Number(systemStatus.counts?.ERROR || 0) && !Number(systemStatus.counts?.REVISAR || 0)} warning={systemStatus?.ok && (!!Number(systemStatus.counts?.ERROR || 0) || !!Number(systemStatus.counts?.REVISAR || 0))} /><StatusRow icon={FileText} title="Configuración persistente" detail="Los valores se guardan en MySQL y se comparten con caja, cocina y meseros." ok /></View>
        <View style={{ padding: 14, borderRadius: 8, backgroundColor: c.surfaceAlt }}><View style={[row, { gap: 8 }]}><CheckCircle2 size={16} color={c.green} /><Text style={{ color: c.text, fontSize: 11, fontWeight: '700' }}>Protecciones activas</Text></View><Text style={{ color: c.muted, fontSize: 10, lineHeight: 17, marginTop: 8 }}>El servidor valida porcentajes, moneda, correo, identificación fiscal, tamaños de texto y URLs antes de guardar. Cada cambio queda registrado en Auditoría.</Text></View>
      </View>}
    </View>
  </ScrollView></View>;
}
