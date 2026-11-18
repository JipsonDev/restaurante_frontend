import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import { Palette, AlertTriangle, Building2, Calculator, Check, CheckCircle2, ChefHat, CircleDollarSign, Database, FileText, ImageIcon, Printer, ReceiptText, Save, Search, Server, Settings2, ShieldCheck, Upload, Wifi } from 'lucide-react-native';
import { assetUrl, BASE_URL } from '../context/AuthContext';
import { useAdmin } from '../context/AdminContext';
import { useTheme } from '../theme';
import { MenuButton, MenuField, MenuNotice } from '../components/MenuUI';
import { Button, Card, PageHeader, Status, Switch as Toggle, Tabs, space, type, useToast } from '../components/admin/ui';
import { Animated } from 'react-native';
import { settingsPayload, ticketPreview } from '../utils/settingsLogic.mjs';
import Maintenance from '../components/admin/Maintenance';
import { BrandSettings } from '../components/admin/BrandSettings';

const row = { flexDirection: 'row', alignItems: 'center' };
const DEFAULTS = {
  nombre_restaurante: '', razon_social: '', ruc: '', direccion: '', telefono: '', correo: '', logo_url: '', color_marca: '',
  iva_porcentaje: '0', servicio_porcentaje: '0', moneda: 'USD', simbolo_moneda: '$', texto_ticket: '',
  impresora_caja: '', impresora_cocina: '',
  alertas_demora_activas: '1', alerta_espera_minutos: '20', alerta_lista_minutos: '5',
};
const SECTIONS = [
  { key: 'negocio', label: 'Negocio', hint: 'Identidad y contacto', icon: Building2 },
  { key: 'marca', label: 'Marca', hint: 'Logo y color de la app', icon: Palette },
  { key: 'facturacion', label: 'Facturación', hint: 'Impuestos y moneda', icon: Calculator },
  { key: 'ticket', label: 'Comprobante', hint: 'Logo y contenido', icon: ReceiptText },
  { key: 'impresoras', label: 'Impresoras', hint: 'Caja y cocina', icon: Printer },
  { key: 'sistema', label: 'Sistema', hint: 'Conexión y estado', icon: Server },
  { key: 'atencion', label: 'Atención', hint: 'Demoras y avisos', icon: ChefHat },
  { key: 'mantenimiento', label: 'Mantenimiento', hint: 'Base y limpieza', icon: Database },
];
const normalizedConfig = config => Object.fromEntries(Object.entries({ ...DEFAULTS, ...(config || {}) }).map(([key, value]) => [key, value == null ? '' : String(value)]));
const errorText = error => error.response?.data?.message || error.response?.data?.error || error.message || 'No se pudo completar la operación.';

function SectionTitle({ title, subtitle, action, compact = false }) {
  const { c } = useTheme();
  return <View style={{ flexDirection: compact ? 'column' : 'row', alignItems: compact ? 'stretch' : 'center', gap: space.md, paddingBottom: space.lg, borderBottomWidth: 1, borderColor: c.line }}>
    <View style={{ flex: 1, minWidth: 0 }}><Text accessibilityRole="header" style={[type.h2, { color: c.text }]}>{title}</Text>{subtitle ? <Text style={[type.small, { color: c.muted, marginTop: 4 }]}>{subtitle}</Text> : null}</View>
    {action ? <View style={{ alignSelf: compact ? 'flex-start' : 'center' }}>{action}</View> : null}
  </View>;
}

function StatusRow({ title, detail, ok, warning }) {
  const { c } = useTheme();
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, borderBottomWidth: 1, borderColor: c.line }}>
    <View style={{ flex: 1, minWidth: 0 }}><Text style={[type.body, { color: c.text, fontWeight: '600' }]}>{title}</Text><Text numberOfLines={2} style={[type.small, { color: c.muted, marginTop: 2 }]}>{detail}</Text></View>
    <Status tone={warning ? 'amber' : ok ? 'green' : 'neutral'}>{warning ? 'Revisar' : ok ? 'Correcto' : 'Sin datos'}</Status>
  </View>;
}

function Ticket({ form }) {
  const preview = ticketPreview(form, 10);
  const symbol = form.simbolo_moneda || '$';
  const format = value => `${symbol}${Number(value).toFixed(2)}`;
  return <View style={{ backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CBD5E1', padding: 18, width: '100%', maxWidth: 330, alignSelf: 'center' }}>
    <Text style={{ color: '#0F172A', textAlign: 'center', fontSize: 16, fontWeight: '800' }}>{form.nombre_restaurante || 'Nombre del restaurante'}</Text><Text style={{ color: '#475569', textAlign: 'center', fontSize: 12, marginTop: 4 }}>{form.razon_social || 'Razón social'}</Text><Text style={{ color: '#475569', textAlign: 'center', fontSize: 12, marginTop: 2 }}>{form.ruc ? `RUC: ${form.ruc}` : 'RUC pendiente'}</Text><Text style={{ color: '#475569', textAlign: 'center', fontSize: 12, marginTop: 2 }}>{form.direccion || 'Dirección pendiente'}</Text>
    <View style={{ height: 1, backgroundColor: '#CBD5E1', marginVertical: 13 }} /><Text style={{ color: '#0F172A', fontSize: 12, fontWeight: '800' }}>FACTURA FAC-000000123</Text><Text style={{ color: '#475569', fontSize: 12, marginTop: 5 }}>Consumidor final · Efectivo</Text><View style={{ height: 1, backgroundColor: '#E2E8F0', marginVertical: 11 }} />
    {[['Subtotal', preview.subtotal], [`IVA ${Number(form.iva_porcentaje || 0)}%`, preview.tax], [`Servicio ${Number(form.servicio_porcentaje || 0)}%`, preview.service]].map(([label, value]) => <View key={label} style={[row, { justifyContent: 'space-between', marginBottom: 6 }]}><Text style={{ color: '#475569', fontSize: 12 }}>{label}</Text><Text style={{ color: '#334155', fontSize: 12 }}>{format(value)}</Text></View>)}<View style={{ height: 1, backgroundColor: '#CBD5E1', marginVertical: 7 }} /><View style={[row, { justifyContent: 'space-between' }]}><Text style={{ color: '#0F172A', fontSize: 12, fontWeight: '800' }}>TOTAL</Text><Text style={{ color: '#0F172A', fontSize: 12, fontWeight: '800' }}>{format(preview.total)}</Text></View><Text style={{ color: '#475569', textAlign: 'center', fontSize: 12, fontWeight: '700', marginTop: 15 }}>{form.texto_ticket || 'Gracias por su compra'}</Text>
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
  const toast = useToast();
  useEffect(() => { if (notice) { toast.show(notice); setNotice(''); } }, [notice]);
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
  useEffect(() => {
    loadSystemStatus();
    const tick = setInterval(() => { if (typeof document === 'undefined' || document.visibilityState !== 'hidden') loadSystemStatus(); }, 30000);
    return () => clearInterval(tick);
  }, []);

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
  const nav = null;

  return <View style={{ flex: 1 }}><ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: space.lg, paddingBottom: space.x3, paddingTop: dirty && !compact ? 56 : 0 }}>
    <PageHeader title="Ajustes" />
    <Tabs value={section} onChange={setSection} options={SECTIONS.map(item => ({ value: item.key, label: item.label }))} />
    {!!notice && <View style={[row, { padding: 11, gap: 8, borderRadius: 8, backgroundColor: c.greenSoft }]}><Check size={16} color={c.green} /><Text accessibilityLiveRegion="polite" style={{ flex: 1, color: c.green, fontSize: 12 }}>{notice}</Text></View>}
    {!!error && <MenuNotice danger>{error}</MenuNotice>}
    <View style={{ gap: space.xl }}>
      {section === 'negocio' && <SettingsSection compact={compact} title="Identidad del negocio" description="Información que aparecerá en facturas, tickets y documentos.">
        <View style={{ flexDirection: compact ? 'column' : 'row', gap: 13 }}><MenuField containerStyle={{ flex: 1 }} label="Nombre comercial" value={form.nombre_restaurante} onChangeText={value => change('nombre_restaurante', value)} placeholder="Morena Mia" maxLength={120} /><MenuField containerStyle={{ flex: 1 }} label="Razón social" value={form.razon_social} onChangeText={value => change('razon_social', value)} placeholder="Razón social registrada" maxLength={180} /></View>
        <View style={{ flexDirection: compact ? 'column' : 'row', gap: 13 }}><MenuField containerStyle={{ flex: 1 }} label="RUC / identificación fiscal" value={form.ruc} onChangeText={value => change('ruc', value.replace(/\D/g, '').slice(0, 13))} placeholder="13 dígitos" keyboardType="number-pad" maxLength={13} /><MenuField containerStyle={{ flex: 1 }} label="Teléfono" value={form.telefono} onChangeText={value => change('telefono', value)} placeholder="+593 99 000 0000" keyboardType="phone-pad" maxLength={40} /></View>
        <MenuField label="Dirección fiscal" value={form.direccion} onChangeText={value => change('direccion', value)} placeholder="Calle, número, ciudad" maxLength={240} /><MenuField label="Correo de facturación" value={form.correo} onChangeText={value => change('correo', value)} placeholder="facturacion@restaurante.com" autoCapitalize="none" keyboardType="email-address" maxLength={160} />
      </SettingsSection>}
      {section === 'marca' && <SettingsSection compact={compact} title="Marca del restaurante" description="El logo y el color que verán los meseros en su app y los clientes en el menú QR.">
        <BrandSettings name={form.nombre_restaurante} logo={form.logo_url ? assetUrl(form.logo_url) : null} color={form.color_marca} onColor={value => change('color_marca', value)} onPickLogo={pickLogo} logoBusy={logoBusy} />
      </SettingsSection>}
      {section === 'facturacion' && <SettingsSection compact={compact} title="Facturación y cargos" description="Define cómo calcula el sistema los próximos cobros.">
        <MenuNotice>Los cambios se aplican a pedidos y cobros futuros. Los comprobantes ya emitidos conservan sus valores originales.</MenuNotice>
        <View style={{ flexDirection: compact ? 'column' : 'row', gap: 13 }}><MenuField containerStyle={{ flex: 1 }} label="IVA (%)" value={form.iva_porcentaje} onChangeText={value => change('iva_porcentaje', value)} placeholder="15" keyboardType="decimal-pad" maxLength={7} /><MenuField containerStyle={{ flex: 1 }} label="Servicio (%)" value={form.servicio_porcentaje} onChangeText={value => change('servicio_porcentaje', value)} placeholder="10" keyboardType="decimal-pad" maxLength={7} /></View>
        <View style={{ flexDirection: compact ? 'column' : 'row', gap: 13 }}><MenuField containerStyle={{ flex: 1 }} label="Código de moneda" value={form.moneda} onChangeText={value => change('moneda', value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3))} placeholder="USD" autoCapitalize="characters" maxLength={3} /><MenuField containerStyle={{ flex: 1 }} label="Símbolo" value={form.simbolo_moneda} onChangeText={value => change('simbolo_moneda', value.slice(0, 5))} placeholder="$" maxLength={5} /></View>
        <View style={{ padding: 15, borderRadius: 8, backgroundColor: c.surfaceAlt, gap: 10 }}><Text style={{ color: c.text, fontSize: 12, fontWeight: '700' }}>Vista rápida sobre $10,00</Text>{Object.entries(ticketPreview(form, 10)).map(([key, value]) => <View key={key} style={[row, { justifyContent: 'space-between' }]}><Text style={{ color: key === 'total' ? c.text : c.muted, fontSize: 12, fontWeight: key === 'total' ? '700' : '500' }}>{({ subtotal: 'Subtotal', tax: 'IVA', service: 'Servicio', total: 'Total a cobrar' })[key]}</Text><Text style={{ color: key === 'total' ? c.primaryText : c.text, fontSize: 12, fontWeight: '700' }}>{form.simbolo_moneda || '$'}{Number(value).toFixed(2)}</Text></View>)}</View>
      </SettingsSection>}
      {section === 'ticket' && <SettingsSection compact={compact} title="Comprobante y marca" description="Personaliza el logo y el mensaje del ticket." action={<MenuButton icon={Upload} busy={logoBusy} onPress={pickLogo}>Cambiar logo</MenuButton>}>
        <View style={{ flexDirection: compact ? 'column' : 'row', gap: 18, alignItems: 'flex-start' }}><View style={{ flex: 1, minWidth: 0, width: '100%', gap: 16 }}><View style={{ minHeight: 132, borderRadius: 9, borderWidth: 1, borderColor: c.line, backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center', padding: 14 }}>{form.logo_url ? <Image source={{ uri: assetUrl(form.logo_url) }} resizeMode="contain" style={{ width: '100%', maxWidth: 240, height: 94 }} /> : <><ImageIcon size={31} color={c.faint} /><Text style={{ color: c.muted, fontSize: 12, marginTop: 8 }}>Aún no hay un logo cargado</Text></>}</View><MenuField label="URL del logo" value={form.logo_url} onChangeText={value => change('logo_url', value)} placeholder="/uploads/configuracion/logo.png" autoCapitalize="none" maxLength={500} /><MenuField label="Mensaje al pie" value={form.texto_ticket} onChangeText={value => change('texto_ticket', value)} placeholder="Gracias por su compra" multiline maxLength={400} style={{ minHeight: 90 }} hint={`${form.texto_ticket.length}/400 caracteres`} /></View><View style={{ width: compact ? '100%' : 350 }}><Ticket form={form} /></View></View>
      </SettingsSection>}
      {section === 'impresoras' && <SettingsSection compact={compact} title="Impresoras de tickets" description="Asigna una impresora instalada para caja y otra para cocina." action={<MenuButton icon={Search} busy={printerBusy} onPress={loadPrinters}>Buscar</MenuButton>}>
        <MenuNotice>Las impresoras USB, Bluetooth o de red deben estar instaladas en el equipo que ejecuta el backend o el agente de impresión.</MenuNotice>
        <View style={{ flexDirection: compact ? 'column' : 'row', gap: 13 }}><MenuField containerStyle={{ flex: 1 }} label="Impresora de caja" value={form.impresora_caja} onChangeText={value => change('impresora_caja', value)} placeholder="Ej. EPSON TM-T20 Caja" maxLength={180} /><MenuField containerStyle={{ flex: 1 }} label="Impresora de cocina" value={form.impresora_cocina} onChangeText={value => change('impresora_cocina', value)} placeholder="Ej. EPSON Cocina" maxLength={180} /></View>
        {printersLoaded && !printers.length && <View style={{ alignItems: 'center', padding: 28, borderWidth: 1, borderColor: c.line, borderRadius: 8, backgroundColor: c.surfaceAlt }}><Printer size={28} color={c.faint} /><Text style={{ color: c.text, fontSize: 12, fontWeight: '700', marginTop: 10 }}>No se detectaron impresoras</Text><Text style={{ color: c.muted, fontSize: 12, textAlign: 'center', lineHeight: 16, marginTop: 5 }}>Instala la impresora de tickets en Windows y vuelve a buscar.</Text></View>}
        {printers.map(printer => <View key={printer.name} style={[row, { gap: 11, padding: 12, borderWidth: 1, borderColor: c.line, borderRadius: 8, flexWrap: 'wrap' }]}><View style={{ width: 34, height: 34, borderRadius: 8, backgroundColor: c.skySoft, alignItems: 'center', justifyContent: 'center' }}><Printer size={17} color={c.sky} /></View><View style={{ flex: 1, minWidth: 160 }}><Text style={{ color: c.text, fontSize: 12, fontWeight: '700' }}>{printer.name}</Text><Text style={{ color: c.muted, fontSize: 12, marginTop: 3 }}>{[printer.connection, printer.port, printer.driver].filter(Boolean).join(' · ') || 'Impresora del sistema'}</Text></View><View style={[row, { gap: 6 }]}><MenuButton disabled={form.impresora_caja === printer.name} onPress={() => change('impresora_caja', printer.name)}>Usar en caja</MenuButton><MenuButton disabled={form.impresora_cocina === printer.name} onPress={() => change('impresora_cocina', printer.name)}>Usar en cocina</MenuButton></View></View>)}
      </SettingsSection>}
      {section === 'atencion' && <SettingsSection compact={compact} title="Tiempos de atención" description="Límites compartidos por todos los meseros. Se aplican también a las rondas activas.">
        <View style={[row,{gap:16,paddingVertical:8}]}>
          <View style={{flex:1,gap:5}}><Text style={{color:c.text,fontSize:14}}>Alertas por demora</Text><Text style={{color:c.muted,fontSize:13,lineHeight:20}}>Avisar al mesero responsable mientras tiene abierta la aplicación.</Text></View>
          <Toggle label="Alertas por demora" showLabel={false} value={form.alertas_demora_activas==='1'} onValueChange={v=>change('alertas_demora_activas',v?'1':'0')} />
        </View>
        <View style={{flexDirection:compact?'column':'row',gap:18}}>
          <MenuField containerStyle={{flex:1}} label="Espera en cocina (minutos)" hint="Desde que se envía una ronda hasta que está lista." value={form.alerta_espera_minutos} onChangeText={value=>change('alerta_espera_minutos',value)} keyboardType="number-pad" maxLength={3}/>
          <MenuField containerStyle={{flex:1}} label="Lista para entregar (minutos)" hint="Desde que cocina marca la ronda como lista." value={form.alerta_lista_minutos} onChangeText={value=>change('alerta_lista_minutos',value)} keyboardType="number-pad" maxLength={3}/>
        </View>
        <View style={{borderTopWidth:1,borderColor:c.line,paddingTop:18,gap:10}}>
          <Text style={{color:c.text,fontSize:13}}>Un aviso útil, sin insistencia</Text>
          <Text style={{color:c.muted,fontSize:13,lineHeight:20}}>Cada fase de una ronda se avisa una sola vez por mesero, incluso si usa varios equipos. Las nuevas demoras se agrupan con al menos 2 minutos entre avisos, sin sonido.</Text>
          <Text style={{color:c.muted,fontSize:13,lineHeight:20}}>La lista de alertas permanece disponible hasta entregar o cancelar la ronda, o hasta que deje de superar el límite. Desactivar las alertas no reinicia los avisos ya registrados.</Text>
        </View>
      </SettingsSection>}
      {section === 'mantenimiento' && <Maintenance />}
      {section === 'sistema' && <SettingsSection compact={compact} title="Estado del sistema" description="Se comprueba solo cada 30 segundos: conexión y cola automática de comandas.">
        <View><StatusRow icon={Database} title="Base de datos y API" detail={BASE_URL} ok /><StatusRow icon={Wifi} title="Conexión del panel" detail="La aplicación está comunicándose con el backend del restaurante." ok /><StatusRow icon={Printer} title="Cola de comandas" detail={systemStatus?.ok ? `${Number(systemStatus.counts?.PENDIENTE || 0)} pendientes · ${Number(systemStatus.counts?.ERROR || 0)} con error · ${Number(systemStatus.counts?.REVISAR || 0)} por revisar` : systemStatus?.error || 'Consultando estado…'} ok={systemStatus?.ok && !Number(systemStatus.counts?.ERROR || 0) && !Number(systemStatus.counts?.REVISAR || 0)} warning={systemStatus?.ok && (!!Number(systemStatus.counts?.ERROR || 0) || !!Number(systemStatus.counts?.REVISAR || 0))} /><StatusRow icon={FileText} title="Configuración persistente" detail="Los valores se guardan en MySQL y se comparten con caja, cocina y meseros." ok /></View>
        <View style={{ padding: 14, borderRadius: 8, backgroundColor: c.surfaceAlt }}><View style={[row, { gap: 8 }]}><CheckCircle2 size={16} color={c.green} /><Text style={{ color: c.text, fontSize: 12, fontWeight: '700' }}>Protecciones activas</Text></View><Text style={{ color: c.muted, fontSize: 12, lineHeight: 17, marginTop: 8 }}>El servidor valida porcentajes, moneda, correo, identificación fiscal, tamaños de texto y URLs antes de guardar. Cada cambio queda registrado en Auditoría.</Text></View>
      </SettingsSection>}
    </View>
  </ScrollView>
    <SaveBar visible={dirty} busy={busy} issue={validationIssue} onSave={save} onReset={reset} compact={compact} />
  </View>;
}

// Patrón de configuración: descripción a la izquierda, formulario en tarjeta a la derecha (en celular se apilan).
function SettingsSection({ title, description, action, children, compact }) {
  const { c } = useTheme();
  return <View style={{ flexDirection: compact ? 'column' : 'row', gap: compact ? space.md : space.xl, alignItems: 'flex-start' }}>
    <View style={{ width: compact ? '100%' : 260, gap: 4, paddingTop: compact ? 0 : space.sm, paddingHorizontal: compact ? space.xs : 0 }}>
      <Text accessibilityRole="header" style={[type.h2, { color: c.text }]}>{title}</Text>
      <Text style={[type.body, { color: c.muted }]}>{description}</Text>
      {action ? <View style={{ marginTop: space.sm }}>{action}</View> : null}
    </View>
    <Card style={{ flex: compact ? undefined : 1, width: compact ? '100%' : undefined, minWidth: 0 }}>
      <View style={{ gap: space.lg }}>{children}</View>
    </Card>
  </View>;
}

// Barra contextual de cambios sin guardar (como en un admin de comercio): baja desde arriba en escritorio
// y sube desde abajo en celular; Descartar y Guardar siempre a mano.
function SaveBar({ visible, busy, issue, onSave, onReset, compact }) {
  const v = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const [mounted, setMounted] = useState(visible);
  useEffect(() => {
    if (visible) setMounted(true);
    Animated.timing(v, { toValue: visible ? 1 : 0, duration: 180, useNativeDriver: Platform.OS !== 'web' }).start(({ finished }) => { if (finished && !visible) setMounted(false); });
  }, [visible]);
  if (!mounted) return null;
  return <Animated.View accessibilityLiveRegion="polite" style={{ position: 'absolute', left: 0, right: 0, [compact ? 'bottom' : 'top']: 0, zIndex: 10, opacity: v,
    transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [compact ? 16 : -16, 0] }) }] }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingLeft: space.lg, paddingRight: space.sm, height: 48, borderRadius: 12, backgroundColor: '#1A1A1A', ...(Platform.OS === 'web' ? { boxShadow: '0 4px 16px rgba(0,0,0,0.2)' } : {}) }}>
      {issue ? <AlertTriangle size={16} color="#FFB800" /> : null}
      <Text numberOfLines={2} style={[type.body, { color: '#E3E3E3', fontWeight: '600', flex: 1 }]}>{issue || 'Cambios sin guardar'}</Text>
      <Button size="sm" variant="secondary" disabled={busy} onPress={onReset}>Descartar</Button>
      <Pressable accessibilityRole="button" disabled={busy || !!issue} onPress={onSave}
        style={({ hovered }) => ({ height: 28, paddingHorizontal: 12, borderRadius: 8, justifyContent: 'center', backgroundColor: hovered ? '#F1F1F1' : '#FFFFFF', opacity: issue ? 0.5 : 1, ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}) })}>
        <Text style={[type.body, { color: '#1A1A1A', fontWeight: '600' }]}>{busy ? 'Guardando…' : 'Guardar'}</Text>
      </Pressable>
    </View>
  </Animated.View>;
}
