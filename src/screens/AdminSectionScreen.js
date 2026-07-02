import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, Alert, Modal, Platform, TextInput, Switch, useWindowDimensions } from 'react-native';
import {
  AlertTriangle, CheckCircle2, Clock, DollarSign, LayoutGrid, MapPin,
  Package, RefreshCw, Settings, ShoppingBag, TrendingUp, Users,
  Plus, Edit3, Trash2, X, Search, Upload, Printer, Receipt, ShieldCheck,
} from 'lucide-react-native';
import axios from 'axios';
import { assetUrl, BASE_URL } from '../context/AuthContext';
import { useAdmin } from '../context/AdminContext';
import { useTheme, softShadow } from '../theme';
import { BOTTOM_INSET } from '../utils/safeArea';

const money = (value) => `$${Number(value || 0).toFixed(2)}`;
const ORDER_ACTIONS = {
  PENDIENTE: ['PREPARANDO', 'CANCELADO'],
  PREPARANDO: ['LISTO', 'CANCELADO'],
  LISTO: ['ENTREGADO', 'CANCELADO'],
  ENTREGADO: ['PAGADO', 'CANCELADO'],
};

const statusTint = (estado, c) => {
  const state = String(estado || '').toUpperCase();
  if (state === 'PAGADO') return c.green;
  if (state === 'LISTO') return c.sky;
  if (state === 'CANCELADO') return c.red;
  if (state === 'PREPARANDO') return c.amber;
  if (state === 'ENTREGADO') return c.accent;
  return c.muted;
};

function SectionHeader({ icon: Icon, title, subtitle, action }) {
  const { width } = useWindowDimensions();
  const { c } = useTheme();
  const compact = width < 680;
  return (
    <View
      className={`rounded-lg p-4 mb-4 ${compact ? 'items-start' : 'flex-row items-center justify-between'}`}
      style={{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, ...softShadow(c) }}
    >
      <View className="flex-row items-center">
        <View className="w-11 h-11 rounded-lg items-center justify-center mr-3" style={{ backgroundColor: c.primarySoft }}>
          <Icon size={21} color={c.primaryText} />
        </View>
        <View>
          <Text className="text-lg font-extrabold" style={{ color: c.text }}>{title}</Text>
          <Text className="text-sm" style={{ color: c.faint }}>{subtitle}</Text>
        </View>
      </View>
      {action ? <View className={compact ? 'mt-4 w-full' : ''}>{action}</View> : null}
    </View>
  );
}

function EmptyState({ text }) {
  const { c } = useTheme();
  return (
    <View className="rounded-lg p-10 items-center" style={{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.line }}>
      <Text className="font-semibold" style={{ color: c.faint }}>{text}</Text>
    </View>
  );
}

function SearchBox({ value, onChangeText, placeholder }) {
  const { c } = useTheme();
  return (
    <View
      className="mb-4 flex-row items-center rounded-lg px-4"
      style={{ height: 46, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, ...softShadow(c) }}
    >
      <Search size={18} color={c.faint} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.faint}
        style={{ flex: 1, marginLeft: 10, color: c.text, fontWeight: '800', paddingVertical: 0 }}
      />
    </View>
  );
}

const normalizeText = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const AUDIT_FILTERS = [
  { key: 'TODOS', label: 'Todos' },
  { key: 'CAJA', label: 'Caja' },
  { key: 'PRODUCTOS', label: 'Productos/precios' },
  { key: 'ANULACIONES', label: 'Anulaciones' },
  { key: 'CONFIG', label: 'Configuracion' },
];

const AUDIT_ACTION_LABELS = {
  'caja.abierta': 'Caja abierta',
  'caja.cerrada': 'Caja cerrada',
  'caja.cobro_registrado': 'Cobro registrado',
  'caja.movimiento_registrado': 'Movimiento de caja',
  'caja.pago_anulado': 'Pago anulado',
  'caja.pago_devuelto': 'Pago devuelto',
  'caja.cierre_editado': 'Cierre editado',
  'caja.cierre_reabierto': 'Caja reabierta',
  'producto.creado': 'Producto creado',
  'producto.actualizado': 'Producto actualizado',
  'producto.precio_cambiado': 'Precio cambiado',
  'producto.eliminado': 'Producto eliminado',
  'configuracion.actualizada': 'Configuracion actualizada',
  'configuracion.logo_actualizado': 'Logo actualizado',
};

function auditActionLabel(action) {
  return AUDIT_ACTION_LABELS[action] || String(action || 'Accion');
}

function auditFilterKey(row) {
  const action = String(row?.accion || '');
  const entity = String(row?.entidad || '');
  if (action.includes('pago_anulado') || action.includes('pago_devuelto') || action.includes('ANULACION')) return 'ANULACIONES';
  if (action.startsWith('caja.') || entity.startsWith('caja') || entity === 'pago') return 'CAJA';
  if (action.startsWith('producto.') || entity === 'producto') return 'PRODUCTOS';
  if (action.startsWith('configuracion.') || entity === 'configuracion') return 'CONFIG';
  return 'OTROS';
}

function auditTint(row, c) {
  const action = String(row?.accion || '');
  if (action.includes('anulado') || action.includes('devuelto') || action.includes('eliminado')) return c.red;
  if (action.includes('cerrada') || action.includes('precio_cambiado') || action.includes('movimiento')) return c.amber;
  if (action.includes('abierta') || action.includes('creado')) return c.green;
  if (action.includes('configuracion')) return c.sky;
  return c.primaryText;
}

function formatAuditDate(value) {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('es-EC', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function auditReason(row) {
  const meta = row?.metadata || {};
  return meta.motivo || meta.observacion || row?.descripcion || 'Sin motivo registrado';
}

function auditMetadataSummary(row) {
  const meta = row?.metadata || {};
  const parts = [];
  if (meta.monto !== undefined) parts.push(`Monto ${money(meta.monto)}`);
  if (meta.monto_inicial !== undefined) parts.push(`Inicial ${money(meta.monto_inicial)}`);
  if (meta.monto_final !== undefined) parts.push(`Contado ${money(meta.monto_final)}`);
  if (meta.efectivo_esperado !== undefined) parts.push(`Esperado ${money(meta.efectivo_esperado)}`);
  if (meta.diferencia !== undefined) parts.push(`Diferencia ${money(meta.diferencia)}`);
  if (meta.metodo) parts.push(`Metodo ${meta.metodo}`);
  if (meta.pedido_id) parts.push(`Pedido #${meta.pedido_id}`);
  if (meta.factura_documento) parts.push(`Doc. ${meta.factura_documento}`);
  if (meta.antes?.precio !== undefined && meta.despues?.precio !== undefined && Number(meta.antes.precio) !== Number(meta.despues.precio)) {
    parts.push(`Precio ${money(meta.antes.precio)} -> ${money(meta.despues.precio)}`);
  }
  if (meta.despues?.nombre || meta.antes?.nombre || meta.nombre) {
    parts.push(meta.despues?.nombre || meta.antes?.nombre || meta.nombre);
  }
  return parts.join(' | ');
}

export default function AdminSectionScreen({ tab, setActiveTab }) {
  const { width } = useWindowDimensions();
  const { c } = useTheme();
  const compact = width < 760;
  // Minimo 2 columnas en movil para las grillas de tarjetas.
  const gridCardWidth = compact ? '48%' : 256;
  const {
    pedidos, productos, mesas, ubicaciones, trabajadores, inventario, extras,
    fetchPedidos, refreshAll, updateMesaEstado,
    createMesa, updateMesa, deleteMesa,
    caja, abrirCaja, cobrarPedido, cerrarCaja,
    configuracion, updateConfiguracion, uploadLogoConfiguracion,
    auditoria, fetchAuditoria,
    createTrabajador, updateTrabajador, deleteTrabajador,
    createInventarioItem, updateInventarioItem, movimientoInventario, deleteInventarioItem,
    createUbicacion, updateUbicacion, deleteUbicacion,
    createExtra, updateExtra, deleteExtra,
  } = useAdmin();

  const [tableModal, setTableModal] = useState(false);
  const [tableForm, setTableForm] = useState({
    id: null, numero: '', ubicacion_id: null, capacidad: '4', estado: 'Libre', activo: true,
  });
  const [locationModal, setLocationModal] = useState(false);
  const [locationForm, setLocationForm] = useState({ id: null, nombre: '', descripcion: '', activo: true });
  const [workerModal, setWorkerModal] = useState(false);
  const [workerForm, setWorkerForm] = useState({ id: null, nombre: '', correo: '', password: '', pin: '', pin_configurado: false, rol: 'mesero', activo: true });
  const [inventoryModal, setInventoryModal] = useState(false);
  const [inventoryForm, setInventoryForm] = useState({
    id: null, nombre: '', categoria: 'Bebidas', proveedor: '', unidad: 'unidad',
    stock: '0', stock_minimo: '0', costo_unitario: '0',
  });
  const [movementModal, setMovementModal] = useState(false);
  const [movementItem, setMovementItem] = useState(null);
  const [movementForm, setMovementForm] = useState({ tipo: 'Entrada', cantidad: '', motivo: '' });
  const [extraModal, setExtraModal] = useState(false);
  const [extraForm, setExtraForm] = useState({
    id: null, nombre: '', precio: '0', tipo: 'EXTRA', categoria: '', activo: true,
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [cashActionBusy, setCashActionBusy] = useState(false);
  const [configBusy, setConfigBusy] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const [printerBusy, setPrinterBusy] = useState(false);
  const [availablePrinters, setAvailablePrinters] = useState([]);
  const [auditFilter, setAuditFilter] = useState('TODOS');
  const [configForm, setConfigForm] = useState({
    nombre_restaurante: '',
    razon_social: '',
    ruc: '',
    direccion: '',
    telefono: '',
    correo: '',
    logo_url: '',
    iva_porcentaje: '16',
    servicio_porcentaje: '0',
    moneda: 'USD',
    simbolo_moneda: '$',
    texto_ticket: '',
    impresora_caja: '',
    impresora_cocina: '',
  });

  useEffect(() => {
    setSearchTerm('');
    if (tab === 'auditoria') fetchAuditoria();
  }, [fetchAuditoria, tab]);

  useEffect(() => {
    if (!configuracion) return;
    setConfigForm((current) => ({
      ...current,
      ...Object.fromEntries(Object.entries(configuracion).map(([key, value]) => [key, value == null ? '' : String(value)])),
    }));
  }, [configuracion]);

  const salesTotal = pedidos.reduce((sum, p) => sum + Number(p.total || 0), 0);
  const activeOrders = pedidos.filter((p) => !['PAGADO', 'CANCELADO'].includes(String(p.estado || '').toUpperCase()));
  const lowStock = inventario.filter((p) => Number(p.stock || 0) <= Number(p.stock_minimo || 0));
  const q = normalizeText(searchTerm);
  const filteredMesas = mesas.filter((m) => !q || normalizeText([
    `mesa ${m.numero}`,
    m.estado,
    m.ubicacion_nombre,
    m.ubicacion,
  ].join(' ')).includes(q));
  const filteredTrabajadores = trabajadores.filter((w) => !q || normalizeText([
    w.nombre,
    w.correo,
    w.rol,
    Number(w.activo) === 1 ? 'activo' : 'inactivo',
  ].join(' ')).includes(q));
  const filteredInventario = inventario.filter((item) => !q || normalizeText([
    item.nombre,
    item.categoria,
    item.proveedor,
    item.unidad,
  ].join(' ')).includes(q));
  const filteredExtras = extras.filter((extra) => !q || normalizeText([
    extra.nombre,
    extra.tipo,
    extra.categoria,
  ].join(' ')).includes(q));
  const filteredUbicaciones = ubicaciones.filter((location) => !q || normalizeText([
    location.nombre,
    location.descripcion,
  ].join(' ')).includes(q));
  const filteredAuditoria = auditoria.filter((row) => {
    const matchesFilter = auditFilter === 'TODOS' || auditFilterKey(row) === auditFilter;
    if (!matchesFilter) return false;
    if (!q) return true;
    return normalizeText([
      row.trabajador_nombre,
      row.rol,
      row.accion,
      auditActionLabel(row.accion),
      row.entidad,
      row.entidad_id,
      row.descripcion,
      auditReason(row),
      auditMetadataSummary(row),
      formatAuditDate(row.created_at),
    ].join(' ')).includes(q);
  });
  const auditStats = AUDIT_FILTERS.filter((item) => item.key !== 'TODOS').map((item) => ({
    ...item,
    count: auditoria.filter((row) => auditFilterKey(row) === item.key).length,
  }));

  const openTable = (mesa = null) => {
    setTableForm(mesa ? {
      id: mesa.id,
      numero: String(mesa.numero || ''),
      ubicacion_id: mesa.ubicacion_id || null,
      capacidad: String(mesa.capacidad || 4),
      estado: mesa.estado || 'Libre',
      activo: Number(mesa.activo) === 1,
    } : {
      id: null,
      numero: '',
      ubicacion_id: ubicaciones.find((u) => Number(u.activo) === 1)?.id || null,
      capacidad: '4',
      estado: 'Libre',
      activo: true,
    });
    setTableModal(true);
  };

  const saveTable = async () => {
    if (!tableForm.numero.trim()) {
      Alert.alert('Falta numero', 'Escribe el numero de la mesa.');
      return;
    }
    try {
      const payload = {
        numero: Number(tableForm.numero),
        ubicacion_id: tableForm.ubicacion_id ? Number(tableForm.ubicacion_id) : null,
        capacidad: Number(tableForm.capacidad || 4),
        estado: tableForm.estado,
        activo: tableForm.activo ? 1 : 0,
      };
      if (tableForm.id) await updateMesa(tableForm.id, payload);
      else await createMesa(payload);
      setTableModal(false);
    } catch (error) {
      Alert.alert('No se pudo guardar', error.response?.data?.message || error.response?.data?.error || 'Revisa el backend.');
    }
  };

  const openLocation = (location = null) => {
    setLocationForm(location ? {
      id: location.id,
      nombre: location.nombre || '',
      descripcion: location.descripcion || '',
      activo: Number(location.activo) === 1,
    } : { id: null, nombre: '', descripcion: '', activo: true });
    setLocationModal(true);
  };

  const saveLocation = async () => {
    if (!locationForm.nombre.trim()) {
      Alert.alert('Falta nombre', 'Escribe el nombre de la ubicacion.');
      return;
    }
    try {
      const payload = {
        nombre: locationForm.nombre.trim(),
        descripcion: locationForm.descripcion.trim() || null,
        activo: locationForm.activo ? 1 : 0,
      };
      if (locationForm.id) await updateUbicacion(locationForm.id, payload);
      else await createUbicacion(payload);
      setLocationModal(false);
    } catch (error) {
      Alert.alert('No se pudo guardar', error.response?.data?.message || error.response?.data?.error || 'Revisa el backend.');
    }
  };

  const openWorker = (worker = null) => {
    setWorkerForm(worker ? {
      id: worker.id,
      nombre: worker.nombre || '',
      correo: worker.correo || '',
      password: '',
      pin: '',
      pin_configurado: Boolean(Number(worker.pin_configurado || 0)),
      rol: worker.rol || 'mesero',
      activo: Number(worker.activo) === 1,
    } : { id: null, nombre: '', correo: '', password: '', pin: '', pin_configurado: false, rol: 'mesero', activo: true });
    setWorkerModal(true);
  };

  const saveWorker = async () => {
    if (!workerForm.nombre.trim() || !workerForm.correo.trim()) {
      Alert.alert('Faltan datos', 'Nombre y correo son obligatorios.');
      return;
    }
    if (!workerForm.id && !workerForm.password.trim()) {
      Alert.alert('Falta contrasena', 'La contrasena es obligatoria para crear usuarios.');
      return;
    }
    if (workerForm.pin && !/^\d{4}$/.test(workerForm.pin)) {
      Alert.alert('PIN invalido', 'El PIN rapido debe tener 4 digitos.');
      return;
    }
    try {
      const payload = {
        nombre: workerForm.nombre.trim(),
        correo: workerForm.correo.trim().toLowerCase(),
        rol: workerForm.rol,
        activo: workerForm.activo ? 1 : 0,
        ...(workerForm.password ? { password: workerForm.password } : {}),
        ...(workerForm.pin ? { pin: workerForm.pin } : {}),
      };
      if (workerForm.id) await updateTrabajador(workerForm.id, payload);
      else await createTrabajador(payload);
      setWorkerModal(false);
    } catch (error) {
      Alert.alert('No se pudo guardar', error.response?.data?.message || error.response?.data?.error || 'Revisa el backend.');
    }
  };

  const openInventory = (item = null) => {
    setInventoryForm(item ? {
      id: item.id,
      nombre: item.nombre || '',
      categoria: item.categoria || '',
      proveedor: item.proveedor || '',
      unidad: item.unidad || 'unidad',
      stock: String(item.stock ?? 0),
      stock_minimo: String(item.stock_minimo ?? 0),
      costo_unitario: String(item.costo_unitario ?? 0),
    } : {
      id: null, nombre: '', categoria: 'Bebidas', proveedor: '', unidad: 'unidad',
      stock: '0', stock_minimo: '0', costo_unitario: '0',
    });
    setInventoryModal(true);
  };

  const saveInventory = async () => {
    if (!inventoryForm.nombre.trim()) {
      Alert.alert('Falta nombre', 'Escribe el nombre del item de inventario.');
      return;
    }
    try {
      const payload = {
        nombre: inventoryForm.nombre.trim(),
        categoria: inventoryForm.categoria.trim() || null,
        proveedor: inventoryForm.proveedor.trim() || null,
        unidad: inventoryForm.unidad.trim() || 'unidad',
        stock: Number(inventoryForm.stock || 0),
        stock_minimo: Number(inventoryForm.stock_minimo || 0),
        costo_unitario: Number(inventoryForm.costo_unitario || 0),
      };
      if (inventoryForm.id) await updateInventarioItem(inventoryForm.id, payload);
      else await createInventarioItem(payload);
      setInventoryModal(false);
    } catch (error) {
      Alert.alert('No se pudo guardar', error.response?.data?.message || error.response?.data?.error || 'Revisa el backend.');
    }
  };

  const openMovement = (item) => {
    setMovementItem(item);
    setMovementForm({ tipo: 'Entrada', cantidad: '', motivo: '' });
    setMovementModal(true);
  };

  const saveMovement = async () => {
    if (!movementItem || !movementForm.cantidad) {
      Alert.alert('Falta cantidad', 'Escribe la cantidad del movimiento.');
      return;
    }
    try {
      await movimientoInventario(movementItem.id, {
        tipo: movementForm.tipo,
        cantidad: Number(movementForm.cantidad),
        motivo: movementForm.motivo || null,
      });
      setMovementModal(false);
    } catch (error) {
      Alert.alert('No se pudo registrar', error.response?.data?.message || error.response?.data?.error || 'Revisa el stock.');
    }
  };

  const openExtra = (extra = null) => {
    setExtraForm(extra ? {
      id: extra.id,
      nombre: extra.nombre || '',
      precio: String(extra.precio ?? extra.precio_extra ?? 0),
      tipo: extra.tipo || 'EXTRA',
      categoria: extra.categoria || '',
      activo: Number(extra.activo) === 1,
    } : {
      id: null, nombre: '', precio: '0', tipo: 'EXTRA', categoria: '', activo: true,
    });
    setExtraModal(true);
  };

  const saveExtra = async () => {
    if (!extraForm.nombre.trim()) {
      Alert.alert('Falta nombre', 'Escribe el nombre del extra.');
      return;
    }
    try {
      const payload = {
        nombre: extraForm.nombre.trim(),
        precio: Number(String(extraForm.precio || '0').replace(',', '.')),
        tipo: extraForm.tipo,
        categoria: extraForm.categoria.trim() || null,
        activo: extraForm.activo ? 1 : 0,
      };
      if (extraForm.id) await updateExtra(extraForm.id, payload);
      else await createExtra(payload);
      setExtraModal(false);
    } catch (error) {
      Alert.alert('No se pudo guardar', error.response?.data?.message || error.response?.data?.error || 'Revisa el backend.');
    }
  };

  const updatePedido = async (id, estado) => {
    try {
      await axios.put(`${BASE_URL}/pedidos/${id}`, { estado });
      await refreshAll();
    } catch (error) {
      Alert.alert('No se pudo actualizar', error.response?.data?.message || 'Revisa el backend.');
    }
  };

  const showError = (title, error, fallback = 'Revisa el backend.') => {
    Alert.alert(title, error?.response?.data?.message || error?.response?.data?.error || error?.message || fallback);
  };

  const confirmDanger = (title, message, action, label = 'Eliminar') => {
    const run = async () => {
      try {
        await action();
      } catch (error) {
        showError('No se pudo completar', error);
      }
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm(`${title}\n\n${message}`)) run();
      return;
    }

    Alert.alert(title, message, [
      { text: 'Cancelar', style: 'cancel' },
      { text: label, style: 'destructive', onPress: run },
    ]);
  };

  const promptText = (title, message, defaultValue = '') => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return window.prompt(`${title}\n\n${message}`, defaultValue);
    }
    return defaultValue;
  };

  const cashExpectedFromSummary = () => {
    const open = caja?.caja;
    if (!open) return 0;
    const efectivo = (caja?.pagos || [])
      .filter((pago) => String(pago.metodo || '').toLowerCase() === 'efectivo' && String(pago.estado || 'ACTIVO').toUpperCase() !== 'ANULADO')
      .reduce((sum, pago) => sum + Number(pago.monto || 0), 0);
    const moves = (caja?.movimientos || []).reduce((acc, item) => {
      const tipo = String(item.tipo || '').toUpperCase();
      acc[tipo] = (acc[tipo] || 0) + Number(item.monto || 0);
      return acc;
    }, {});
    return Number(open.monto_inicial || 0)
      + efectivo
      + Number(moves.INGRESO || 0)
      - Number(moves.RETIRO || 0)
      - Number(moves.GASTO || 0)
      - Number(moves.DEVOLUCION || 0);
  };

  const handleAdminOpenCaja = async () => {
    if (caja?.caja) {
      Alert.alert('Caja ya abierta', `La caja #${caja.caja.id} ya esta abierta y sincronizada con el modulo de caja.`);
      return;
    }
    const amountText = promptText('Abrir caja', 'Monto inicial en efectivo:', '20.00');
    if (amountText === null) return;
    const amount = Number(String(amountText || '0').replace(',', '.'));
    if (!Number.isFinite(amount) || amount < 0) {
      Alert.alert('Monto invalido', 'Escribe un monto inicial valido.');
      return;
    }
    const note = promptText('Abrir caja', 'Observacion opcional:', 'Apertura desde admin');
    try {
      setCashActionBusy(true);
      await abrirCaja(amount, note === null ? null : String(note || '').trim() || null);
      await refreshAll();
      Alert.alert('Caja abierta', 'La caja quedo abierta y sincronizada con el modulo de caja.');
    } catch (error) {
      showError('No se pudo abrir caja', error);
    } finally {
      setCashActionBusy(false);
    }
  };

  const handleAdminCloseCaja = async () => {
    if (!caja?.caja) {
      Alert.alert('Caja cerrada', 'No hay una caja abierta para cerrar.');
      return;
    }
    const expected = cashExpectedFromSummary();
    const amountText = promptText('Cerrar caja', `Efectivo esperado: ${money(expected)}\nEscribe el efectivo contado:`, expected.toFixed(2));
    if (amountText === null) return;
    const amount = Number(String(amountText || '0').replace(',', '.'));
    if (!Number.isFinite(amount) || amount < 0) {
      Alert.alert('Monto invalido', 'Escribe el efectivo contado correctamente.');
      return;
    }
    const note = promptText('Cerrar caja', 'Observacion de cierre opcional:', '');
    try {
      setCashActionBusy(true);
      await cerrarCaja(amount, note === null ? null : String(note || '').trim() || null);
      await refreshAll();
      Alert.alert('Caja cerrada', 'El cierre se registro y el modulo de caja quedo sincronizado.');
    } catch (error) {
      showError('No se pudo cerrar caja', error);
    } finally {
      setCashActionBusy(false);
    }
  };

  const saveConfig = async () => {
    const iva = Number(String(configForm.iva_porcentaje || '0').replace(',', '.'));
    const servicio = Number(String(configForm.servicio_porcentaje || '0').replace(',', '.'));
    if (!configForm.nombre_restaurante.trim()) {
      Alert.alert('Falta nombre', 'Escribe el nombre del restaurante.');
      return;
    }
    if (!Number.isFinite(iva) || iva < 0 || iva > 100) {
      Alert.alert('IVA invalido', 'Escribe un porcentaje de IVA entre 0 y 100.');
      return;
    }
    if (!Number.isFinite(servicio) || servicio < 0 || servicio > 100) {
      Alert.alert('Servicio invalido', 'Escribe un porcentaje de servicio entre 0 y 100.');
      return;
    }
    try {
      setConfigBusy(true);
      await updateConfiguracion({
        ...configForm,
        iva_porcentaje: String(iva),
        servicio_porcentaje: String(servicio),
      });
      await refreshAll();
      Alert.alert('Configuracion guardada', 'Los datos del negocio se actualizaron correctamente.');
    } catch (error) {
      showError('No se pudo guardar configuracion', error);
    } finally {
      setConfigBusy(false);
    }
  };

  const pickLogo = async () => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      Alert.alert('Logo', 'En este dispositivo pega la URL del logo y guarda la configuracion.');
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        setLogoBusy(true);
        const data = await uploadLogoConfiguracion(file);
        setConfigForm((current) => ({ ...current, logo_url: data.logo_url || current.logo_url }));
      } catch (error) {
        showError('No se pudo subir logo', error);
      } finally {
        setLogoBusy(false);
      }
    };
    input.click();
  };

  const loadPrinters = async () => {
    try {
      setPrinterBusy(true);
      const { data } = await axios.get(`${BASE_URL}/configuracion/impresoras`);
      setAvailablePrinters(Array.isArray(data) ? data : []);
      if (!Array.isArray(data) || !data.length) {
        Alert.alert(
          'Sin impresoras detectadas',
          'No se encontraron impresoras instaladas en el equipo del backend. Si es Bluetooth o USB, primero debe estar emparejada/instalada en Windows y luego volver a buscar.'
        );
      }
    } catch (error) {
      showError('No se pudieron cargar impresoras', error);
    } finally {
      setPrinterBusy(false);
    }
  };

  const inputClass = 'bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-slate-800 mb-3';

  const renderTableModal = () => (
    <Modal visible={tableModal} transparent animationType="fade" onRequestClose={() => setTableModal(false)}>
      <View className="flex-1 bg-black/40 items-center justify-center px-5">
        <View className="bg-white rounded-lg w-full max-w-xl overflow-hidden" style={{ maxHeight: '90%' }}>
          <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-100">
            <Text className="text-lg font-extrabold text-slate-800">{tableForm.id ? 'Editar mesa' : 'Nueva mesa'}</Text>
            <TouchableOpacity onPress={() => setTableModal(false)}><X size={20} color="#64748b" /></TouchableOpacity>
          </View>
          <ScrollView className="p-5">
            <View className="flex-row">
              <View className="flex-1 mr-2">
                <Text className="text-slate-600 font-semibold text-sm mb-1">Numero</Text>
                <TextInput value={tableForm.numero} onChangeText={(v) => setTableForm((p) => ({ ...p, numero: v.replace(/[^0-9]/g, '') }))} keyboardType="number-pad" className={inputClass} />
              </View>
              <View className="flex-1 ml-2">
                <Text className="text-slate-600 font-semibold text-sm mb-1">Capacidad</Text>
                <TextInput value={tableForm.capacidad} onChangeText={(v) => setTableForm((p) => ({ ...p, capacidad: v.replace(/[^0-9]/g, '') }))} keyboardType="number-pad" className={inputClass} />
              </View>
            </View>

            <Text className="text-slate-600 font-semibold text-sm mb-2">Ubicacion</Text>
            <View className="flex-row flex-wrap mb-3">
              <TouchableOpacity
                onPress={() => setTableForm((p) => ({ ...p, ubicacion_id: null }))}
                className={`px-4 py-2 rounded-lg mr-2 mb-2 ${!tableForm.ubicacion_id ? 'bg-blue-600' : 'bg-slate-50 border border-slate-200'}`}
              >
                <Text className={`font-bold text-xs ${!tableForm.ubicacion_id ? 'text-white' : 'text-slate-500'}`}>Sin ubicacion</Text>
              </TouchableOpacity>
              {ubicaciones.filter((u) => Number(u.activo) === 1 || Number(u.id) === Number(tableForm.ubicacion_id)).map((u) => {
                const active = Number(tableForm.ubicacion_id) === Number(u.id);
                return (
                  <TouchableOpacity key={u.id} onPress={() => setTableForm((p) => ({ ...p, ubicacion_id: u.id }))} className={`px-4 py-2 rounded-lg mr-2 mb-2 ${active ? 'bg-blue-600' : 'bg-slate-50 border border-slate-200'}`}>
                    <Text className={`font-bold text-xs ${active ? 'text-white' : 'text-slate-500'}`}>{u.nombre}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text className="text-slate-600 font-semibold text-sm mb-2">Estado</Text>
            <View className="flex-row flex-wrap mb-3">
              {['Libre', 'Reservada', 'Ocupada', 'Cuenta'].map((estado) => {
                const active = tableForm.estado === estado;
                return (
                  <TouchableOpacity key={estado} onPress={() => setTableForm((p) => ({ ...p, estado }))} className={`px-4 py-2 rounded-lg mr-2 mb-2 ${active ? 'bg-blue-600' : 'bg-slate-50 border border-slate-200'}`}>
                    <Text className={`font-bold text-xs ${active ? 'text-white' : 'text-slate-500'}`}>{estado}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View className="flex-row items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 mb-4">
              <Text className="text-slate-700 font-bold">Mesa activa</Text>
              <Switch value={tableForm.activo} onValueChange={(v) => setTableForm((p) => ({ ...p, activo: v }))} />
            </View>
            <View className="flex-row justify-end mb-5">
              <TouchableOpacity onPress={() => setTableModal(false)} className="px-5 py-3 rounded-lg bg-slate-100 mr-3">
                <Text className="text-slate-600 font-bold">Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={saveTable} className="px-5 py-3 rounded-lg bg-blue-600">
                <Text className="text-white font-bold">Guardar</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  const renderLocationModal = () => (
    <Modal visible={locationModal} transparent animationType="fade" onRequestClose={() => setLocationModal(false)}>
      <View className="flex-1 bg-black/40 items-center justify-center px-5">
        <View className="bg-white rounded-lg w-full max-w-lg overflow-hidden" style={{ maxHeight: '90%' }}>
          <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-100">
            <Text className="text-lg font-extrabold text-slate-800">{locationForm.id ? 'Editar ubicacion' : 'Nueva ubicacion'}</Text>
            <TouchableOpacity onPress={() => setLocationModal(false)}><X size={20} color="#64748b" /></TouchableOpacity>
          </View>
          <ScrollView className="p-5" contentContainerStyle={{ paddingBottom: BOTTOM_INSET + 12 }}>
            <Text className="text-slate-600 font-semibold text-sm mb-1">Nombre</Text>
            <TextInput value={locationForm.nombre} onChangeText={(v) => setLocationForm((p) => ({ ...p, nombre: v }))} placeholder="Salon, Terraza, VIP..." placeholderTextColor="#94a3b8" className={inputClass} />
            <Text className="text-slate-600 font-semibold text-sm mb-1">Descripcion</Text>
            <TextInput value={locationForm.descripcion} onChangeText={(v) => setLocationForm((p) => ({ ...p, descripcion: v }))} placeholder="Referencia interna" placeholderTextColor="#94a3b8" className={inputClass} />
            <View className="flex-row items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 mb-4">
              <Text className="text-slate-700 font-bold">Ubicacion activa</Text>
              <Switch value={locationForm.activo} onValueChange={(v) => setLocationForm((p) => ({ ...p, activo: v }))} />
            </View>
            <View className="flex-row justify-end">
              <TouchableOpacity onPress={() => setLocationModal(false)} className="px-5 py-3 rounded-lg bg-slate-100 mr-3">
                <Text className="text-slate-600 font-bold">Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={saveLocation} className="px-5 py-3 rounded-lg bg-blue-600">
                <Text className="text-white font-bold">Guardar</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  const renderWorkerModal = () => (
    <Modal visible={workerModal} transparent animationType="fade" onRequestClose={() => setWorkerModal(false)}>
      <View className="flex-1 bg-black/40 items-center justify-center px-5">
        <View className="bg-white rounded-lg w-full max-w-xl overflow-hidden" style={{ maxHeight: '90%' }}>
          <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-100">
            <Text className="text-lg font-extrabold text-slate-800">{workerForm.id ? 'Editar usuario' : 'Nuevo usuario'}</Text>
            <TouchableOpacity onPress={() => setWorkerModal(false)}><X size={20} color="#64748b" /></TouchableOpacity>
          </View>
          <ScrollView className="p-5" contentContainerStyle={{ paddingBottom: BOTTOM_INSET + 12 }}>
            <Text className="text-slate-600 font-semibold text-sm mb-1">Nombre</Text>
            <TextInput value={workerForm.nombre} onChangeText={(v) => setWorkerForm((p) => ({ ...p, nombre: v }))} className={inputClass} />
            <Text className="text-slate-600 font-semibold text-sm mb-1">Correo</Text>
            <TextInput value={workerForm.correo} onChangeText={(v) => setWorkerForm((p) => ({ ...p, correo: v }))} autoCapitalize="none" keyboardType="email-address" className={inputClass} />
            <Text className="text-slate-600 font-semibold text-sm mb-1">{workerForm.id ? 'Nueva contrasena (opcional)' : 'Contrasena'}</Text>
            <TextInput value={workerForm.password} onChangeText={(v) => setWorkerForm((p) => ({ ...p, password: v }))} secureTextEntry className={inputClass} />
            <View className="flex-row items-center justify-between">
              <Text className="text-slate-600 font-semibold text-sm mb-1">PIN rapido de 4 digitos</Text>
              {workerForm.id && workerForm.pin_configurado ? (
                <Text className="text-emerald-600 text-xs font-extrabold mb-1">PIN configurado</Text>
              ) : null}
            </View>
            <TextInput
              value={workerForm.pin}
              onChangeText={(v) => setWorkerForm((p) => ({ ...p, pin: v.replace(/\D/g, '').slice(0, 4) }))}
              secureTextEntry
              keyboardType="number-pad"
              maxLength={4}
              placeholder={workerForm.id ? 'Dejar vacio para mantener' : 'Ej. 1234'}
              placeholderTextColor="#94a3b8"
              className={inputClass}
            />
            <Text className="text-slate-600 font-semibold text-sm mb-2">Rol</Text>
            <View className="flex-row flex-wrap mb-3">
              {['admin', 'supervisor', 'mesero', 'cocina', 'caja'].map((rol) => {
                const active = workerForm.rol === rol;
                return (
                  <TouchableOpacity
                    key={rol}
                    onPress={() => setWorkerForm((p) => ({ ...p, rol }))}
                    className={`px-4 py-2 rounded-lg mr-2 mb-2 ${active ? 'bg-blue-600' : 'bg-slate-50 border border-slate-200'}`}
                  >
                    <Text className={`font-bold text-xs capitalize ${active ? 'text-white' : 'text-slate-500'}`}>{rol}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View className="flex-row items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 mb-4">
              <Text className="text-slate-700 font-bold">Usuario activo</Text>
              <Switch value={workerForm.activo} onValueChange={(v) => setWorkerForm((p) => ({ ...p, activo: v }))} />
            </View>
            <View className="flex-row justify-end">
              <TouchableOpacity onPress={() => setWorkerModal(false)} className="px-5 py-3 rounded-lg bg-slate-100 mr-3">
                <Text className="text-slate-600 font-bold">Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={saveWorker} className="px-5 py-3 rounded-lg bg-blue-600">
                <Text className="text-white font-bold">Guardar</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  const renderInventoryModal = () => (
    <Modal visible={inventoryModal} transparent animationType="fade" onRequestClose={() => setInventoryModal(false)}>
      <View className="flex-1 bg-black/40 items-center justify-center px-5">
        <View className="bg-white rounded-lg w-full max-w-2xl overflow-hidden" style={{ maxHeight: '92%' }}>
          <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-100">
            <Text className="text-lg font-extrabold text-slate-800">{inventoryForm.id ? 'Editar item de inventario' : 'Nuevo item de inventario'}</Text>
            <TouchableOpacity onPress={() => setInventoryModal(false)}><X size={20} color="#64748b" /></TouchableOpacity>
          </View>
          <ScrollView className="p-5">
            <Text className="text-slate-600 font-semibold text-sm mb-1">Nombre</Text>
            <TextInput value={inventoryForm.nombre} onChangeText={(v) => setInventoryForm((p) => ({ ...p, nombre: v }))} placeholder="Ej. Cola 500ml" placeholderTextColor="#94a3b8" className={inputClass} />
            <View className="flex-row">
              <View className="flex-1 mr-2">
                <Text className="text-slate-600 font-semibold text-sm mb-1">Categoria</Text>
                <TextInput value={inventoryForm.categoria} onChangeText={(v) => setInventoryForm((p) => ({ ...p, categoria: v }))} className={inputClass} />
              </View>
              <View className="flex-1 ml-2">
                <Text className="text-slate-600 font-semibold text-sm mb-1">Proveedor</Text>
                <TextInput value={inventoryForm.proveedor} onChangeText={(v) => setInventoryForm((p) => ({ ...p, proveedor: v }))} className={inputClass} />
              </View>
            </View>
            <View className="flex-row">
              <View className="flex-1 mr-2">
                <Text className="text-slate-600 font-semibold text-sm mb-1">Unidad</Text>
                <TextInput value={inventoryForm.unidad} onChangeText={(v) => setInventoryForm((p) => ({ ...p, unidad: v }))} className={inputClass} />
              </View>
              <View className="flex-1 mx-2">
                <Text className="text-slate-600 font-semibold text-sm mb-1">Stock</Text>
                <TextInput value={inventoryForm.stock} onChangeText={(v) => setInventoryForm((p) => ({ ...p, stock: v.replace(',', '.') }))} keyboardType="decimal-pad" className={inputClass} />
              </View>
              <View className="flex-1 ml-2">
                <Text className="text-slate-600 font-semibold text-sm mb-1">Stock minimo</Text>
                <TextInput value={inventoryForm.stock_minimo} onChangeText={(v) => setInventoryForm((p) => ({ ...p, stock_minimo: v.replace(',', '.') }))} keyboardType="decimal-pad" className={inputClass} />
              </View>
            </View>
            <Text className="text-slate-600 font-semibold text-sm mb-1">Costo unitario</Text>
            <TextInput value={inventoryForm.costo_unitario} onChangeText={(v) => setInventoryForm((p) => ({ ...p, costo_unitario: v.replace(',', '.') }))} keyboardType="decimal-pad" className={inputClass} />
            <View className="flex-row justify-end mb-5">
              <TouchableOpacity onPress={() => setInventoryModal(false)} className="px-5 py-3 rounded-lg bg-slate-100 mr-3">
                <Text className="text-slate-600 font-bold">Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={saveInventory} className="px-5 py-3 rounded-lg bg-blue-600">
                <Text className="text-white font-bold">Guardar</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  const renderMovementModal = () => (
    <Modal visible={movementModal} transparent animationType="fade" onRequestClose={() => setMovementModal(false)}>
      <View className="flex-1 bg-black/40 items-center justify-center px-5">
        <View className="bg-white rounded-lg w-full max-w-md overflow-hidden" style={{ maxHeight: '90%' }}>
          <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-100">
            <Text className="text-lg font-extrabold text-slate-800">Movimiento: {movementItem?.nombre}</Text>
            <TouchableOpacity onPress={() => setMovementModal(false)}><X size={20} color="#64748b" /></TouchableOpacity>
          </View>
          <View className="p-5">
            <Text className="text-slate-600 font-semibold text-sm mb-2">Tipo</Text>
            <View className="flex-row mb-3">
              {['Entrada', 'Salida', 'Ajuste'].map((tipo) => {
                const active = movementForm.tipo === tipo;
                return (
                  <TouchableOpacity key={tipo} onPress={() => setMovementForm((p) => ({ ...p, tipo }))} className={`px-4 py-2 rounded-lg mr-2 ${active ? 'bg-blue-600' : 'bg-slate-50 border border-slate-200'}`}>
                    <Text className={`font-bold text-xs ${active ? 'text-white' : 'text-slate-500'}`}>{tipo}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text className="text-slate-600 font-semibold text-sm mb-1">Cantidad</Text>
            <TextInput value={movementForm.cantidad} onChangeText={(v) => setMovementForm((p) => ({ ...p, cantidad: v.replace(',', '.') }))} keyboardType="decimal-pad" className={inputClass} />
            <Text className="text-slate-600 font-semibold text-sm mb-1">Motivo</Text>
            <TextInput value={movementForm.motivo} onChangeText={(v) => setMovementForm((p) => ({ ...p, motivo: v }))} placeholder="Compra, merma, ajuste inicial..." placeholderTextColor="#94a3b8" className={inputClass} />
            <View className="flex-row justify-end">
              <TouchableOpacity onPress={() => setMovementModal(false)} className="px-5 py-3 rounded-lg bg-slate-100 mr-3">
                <Text className="text-slate-600 font-bold">Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={saveMovement} className="px-5 py-3 rounded-lg bg-blue-600">
                <Text className="text-white font-bold">Registrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderExtraModal = () => (
    <Modal visible={extraModal} transparent animationType="fade" onRequestClose={() => setExtraModal(false)}>
      <View className="flex-1 bg-black/40 items-center justify-center px-5">
        <View className="bg-white rounded-lg w-full max-w-lg overflow-hidden" style={{ maxHeight: '90%' }}>
          <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-100">
            <Text className="text-lg font-extrabold text-slate-800">{extraForm.id ? 'Editar extra' : 'Nuevo extra'}</Text>
            <TouchableOpacity onPress={() => setExtraModal(false)}><X size={20} color="#64748b" /></TouchableOpacity>
          </View>
          <View className="p-5">
            <Text className="text-slate-600 font-semibold text-sm mb-1">Nombre</Text>
            <TextInput value={extraForm.nombre} onChangeText={(v) => setExtraForm((p) => ({ ...p, nombre: v }))} placeholder="Ej. Mas cafe" placeholderTextColor="#94a3b8" className={inputClass} />
            <View className="flex-row">
              <View className="flex-1 mr-2">
                <Text className="text-slate-600 font-semibold text-sm mb-1">Precio adicional</Text>
                <TextInput value={extraForm.precio} onChangeText={(v) => setExtraForm((p) => ({ ...p, precio: v.replace(',', '.') }))} keyboardType="decimal-pad" placeholder="0.25" placeholderTextColor="#94a3b8" className={inputClass} />
              </View>
              <View className="flex-1 ml-2">
                <Text className="text-slate-600 font-semibold text-sm mb-1">Categoria</Text>
                <TextInput value={extraForm.categoria} onChangeText={(v) => setExtraForm((p) => ({ ...p, categoria: v }))} placeholder="Cafe, Bebidas..." placeholderTextColor="#94a3b8" className={inputClass} />
              </View>
            </View>
            <Text className="text-slate-600 font-semibold text-sm mb-2">Tipo</Text>
            <View className="flex-row flex-wrap mb-3">
              {['EXTRA', 'EXCLUSION', 'TERMINO', 'NOTA'].map((tipo) => {
                const active = extraForm.tipo === tipo;
                return (
                  <TouchableOpacity key={tipo} onPress={() => setExtraForm((p) => ({ ...p, tipo }))} className={`px-4 py-2 rounded-lg mr-2 mb-2 ${active ? 'bg-blue-600' : 'bg-slate-50 border border-slate-200'}`}>
                    <Text className={`font-bold text-xs ${active ? 'text-white' : 'text-slate-500'}`}>{tipo}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View className="flex-row items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 mb-4">
              <Text className="text-slate-700 font-bold">Extra activo</Text>
              <Switch value={extraForm.activo} onValueChange={(v) => setExtraForm((p) => ({ ...p, activo: v }))} />
            </View>
            <View className="flex-row justify-end">
              <TouchableOpacity onPress={() => setExtraModal(false)} className="px-5 py-3 rounded-lg bg-slate-100 mr-3">
                <Text className="text-slate-600 font-bold">Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={saveExtra} className="px-5 py-3 rounded-lg bg-blue-600">
                <Text className="text-white font-bold">Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );

  if (tab === 'pedidos') {
    return (
      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        <SectionHeader
          icon={ShoppingBag}
          title="Pedidos"
          subtitle={`${activeOrders.length} pedidos activos hoy`}
          action={(
            <TouchableOpacity onPress={fetchPedidos} className="flex-row items-center rounded-lg px-4 py-2" style={{ backgroundColor: c.soft }}>
              <RefreshCw size={16} color={c.primaryText} />
              <Text className="font-bold ml-2" style={{ color: c.primaryText }}>Actualizar</Text>
            </TouchableOpacity>
          )}
        />
        {pedidos.length ? pedidos.map((p) => {
          const estadoActual = String(p.estado || 'PENDIENTE').toUpperCase();
          const tint = statusTint(estadoActual, c);
          const nextStates = ORDER_ACTIONS[estadoActual] || [];
          return (
            <View key={p.id} className="rounded-lg p-5 mb-3" style={{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, ...softShadow(c) }}>
              <View className="flex-row justify-between items-start">
                <View>
                  <Text className="text-lg font-extrabold" style={{ color: c.text }}>Pedido #{p.id}</Text>
                  <Text className="text-sm mt-1" style={{ color: c.muted }}>Mesa {p.mesa_numero || p.mesa_id} - {p.mesero_nombre || 'Mesero'}</Text>
                </View>
                <View className="items-end">
                  <Text className="font-extrabold text-lg" style={{ color: c.primaryText }}>{money(p.total)}</Text>
                  <View className="px-3 py-1 rounded-full mt-1" style={{ backgroundColor: `${tint}22` }}>
                    <Text className="text-xs font-bold" style={{ color: tint }}>{estadoActual}</Text>
                  </View>
                </View>
              </View>
              <View className="mt-4">
                {(p.items || []).map((item, idx) => (
                  <Text key={`${p.id}-${idx}`} className="text-sm mb-1" style={{ color: c.muted }}>
                    {item.cantidad} x {item.nombre} - {money(item.precio)}
                  </Text>
                ))}
              </View>
              <View className="flex-row flex-wrap mt-3">
                {nextStates.map((estado) => (
                  <TouchableOpacity
                    key={estado}
                    onPress={() => updatePedido(p.id, estado)}
                    className="rounded-lg px-3 py-2 mr-2 mb-2"
                    style={{ backgroundColor: c.soft }}
                  >
                    <Text className="text-xs font-bold" style={{ color: c.text }}>{estado}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          );
        }) : <EmptyState text="No hay pedidos registrados hoy." />}
      </ScrollView>
    );
  }

  if (tab === 'caja') {
    const payableOrders = pedidos.filter((p) => !['PAGADO', 'CANCELADO'].includes(String(p.estado || '').toUpperCase()));
    const cashIsOpen = !!caja?.caja;
    const expectedCash = cashExpectedFromSummary();
    return (
      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        <SectionHeader
          icon={DollarSign}
          title="Caja"
          subtitle={cashIsOpen ? `Caja abierta #${caja.caja.id} - Efectivo esperado ${money(expectedCash)}` : 'No hay caja abierta'}
          action={(
            <View className="flex-row">
              <TouchableOpacity
                onPress={handleAdminOpenCaja}
                disabled={cashActionBusy || cashIsOpen}
                className="rounded-lg px-4 py-2 mr-2"
                style={{ backgroundColor: !cashIsOpen ? c.green : c.soft, opacity: cashActionBusy ? 0.65 : 1 }}
              >
                <Text className="font-bold" style={{ color: !cashIsOpen ? '#FFFFFF' : c.faint }}>Abrir caja</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleAdminCloseCaja}
                disabled={cashActionBusy || !cashIsOpen}
                className="rounded-lg px-4 py-2"
                style={{ backgroundColor: cashIsOpen ? c.primary : c.soft, opacity: cashActionBusy ? 0.65 : 1 }}
              >
                <Text className="font-bold" style={{ color: cashIsOpen ? c.onPrimary : c.faint }}>Cerrar caja</Text>
              </TouchableOpacity>
            </View>
          )}
        />
        <View className="flex-row flex-wrap" style={{ gap: 12 }}>
          {[
            ['Cobrado hoy', money(caja?.total_cobrado ?? salesTotal), c.green],
            ['Pagos hoy', String(caja?.pagos_hoy ?? pedidos.filter((p) => String(p.estado || '').toUpperCase() === 'PAGADO').length), c.sky],
            ['Por cobrar', money(caja?.monto_por_cobrar ?? payableOrders.reduce((s, p) => s + Number(p.total || 0), 0)), c.amber],
            ['Ticket promedio', money(pedidos.length ? salesTotal / pedidos.length : 0), c.accent],
          ].map(([title, value, color]) => (
            <View key={title} className="rounded-lg p-5" style={{ width: compact ? '48%' : undefined, flexGrow: compact ? 0 : 1, minWidth: compact ? undefined : 200, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, ...softShadow(c) }}>
              <View className="w-11 h-11 rounded-lg items-center justify-center mb-3" style={{ backgroundColor: `${color}1f` }}>
                <DollarSign size={20} color={color} />
              </View>
              <Text className="font-semibold" style={{ color: c.muted }}>{title}</Text>
              <Text className="text-2xl font-extrabold mt-1" style={{ color: c.text }}>{value}</Text>
            </View>
          ))}
        </View>
        <View className={`${compact ? 'flex-col' : 'flex-row'} mt-5`}>
          <View className={`rounded-lg p-5 flex-1 ${compact ? 'mb-4' : 'mr-5'}`} style={{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, ...softShadow(c) }}>
            <Text className="text-base font-extrabold mb-4" style={{ color: c.text }}>Pedidos listos para cobrar</Text>
            {payableOrders.length ? payableOrders.map((p) => (
              <View key={p.id} className="flex-row items-center py-3" style={{ borderBottomWidth: 1, borderBottomColor: c.line }}>
                <View className="flex-1">
                  <Text className="font-bold" style={{ color: c.text }}>Pedido #{p.id}</Text>
                  <Text className="text-xs" style={{ color: c.faint }}>Mesa {p.mesa_numero || p.mesa_id} - {String(p.estado || '').toUpperCase()}</Text>
                </View>
                <Text className="font-extrabold mr-4" style={{ color: c.primaryText }}>{money(p.total)}</Text>
                <TouchableOpacity onPress={() => cobrarPedido(p.id, 'Efectivo')} className="rounded-lg px-4 py-2" style={{ backgroundColor: c.primary }}>
                  <Text className="font-bold text-xs" style={{ color: c.onPrimary }}>Cobrar</Text>
                </TouchableOpacity>
              </View>
            )) : (
              <Text className="font-semibold" style={{ color: c.faint }}>No hay pedidos listos para cobrar.</Text>
            )}
          </View>

          <View className="rounded-lg p-5" style={{ width: compact ? '100%' : 384, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, ...softShadow(c) }}>
            <Text className="text-base font-extrabold mb-4" style={{ color: c.text }}>Pagos recientes</Text>
            {(caja?.pagos || []).length ? caja.pagos.map((pago) => (
              <View key={pago.id} className="flex-row items-center justify-between py-3" style={{ borderBottomWidth: 1, borderBottomColor: c.line }}>
                <View>
                  <Text className="font-bold" style={{ color: c.text }}>Pago #{pago.id}</Text>
                  <Text className="text-xs" style={{ color: c.faint }}>Mesa {pago.mesa_numero || pago.mesa_id || '-' } - {pago.metodo}</Text>
                </View>
                <Text className="font-extrabold" style={{ color: c.green }}>{money(pago.monto)}</Text>
              </View>
            )) : (
              <Text className="font-semibold" style={{ color: c.faint }}>Aun no hay pagos registrados.</Text>
            )}
          </View>
        </View>
      </ScrollView>
    );
  }

  if (tab === 'mesas') {
    return (
      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        <SectionHeader
          icon={LayoutGrid}
          title="Mesas"
          subtitle={`${mesas.filter((m) => Number(m.activo) === 1).length} mesas activas`}
          action={(
            <TouchableOpacity onPress={() => openTable()} className="bg-blue-600 rounded-lg px-4 py-2 flex-row items-center">
              <Plus size={16} color="#fff" />
              <Text className="text-white font-bold ml-2">Nueva mesa</Text>
            </TouchableOpacity>
          )}
        />
        <SearchBox value={searchTerm} onChangeText={setSearchTerm} placeholder="Buscar por mesa, ubicacion o estado..." />
        <View className="flex-row flex-wrap" style={{ gap: 12 }}>
          {filteredMesas.length ? filteredMesas.map((m) => {
            const activa = Number(m.activo) === 1;
            return (
            <View
              key={m.id}
              className="rounded-lg p-5"
              style={{ width: gridCardWidth, opacity: activa ? 1 : 0.7, backgroundColor: c.surface, borderWidth: 1, borderColor: activa ? c.line : c.red, ...softShadow(c) }}
            >
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-xl font-extrabold" style={{ color: c.text }}>Mesa {m.numero}</Text>
                <View className="px-2 py-1 rounded-full" style={{ backgroundColor: activa ? c.greenSoft : c.redSoft }}>
                  <Text className="text-[11px] font-bold" style={{ color: activa ? c.green : c.red }}>
                    {activa ? 'Activa' : 'Inactiva'}
                  </Text>
                </View>
              </View>
              <Text className="text-sm" style={{ color: c.muted }}>{m.ubicacion_nombre || 'Sin ubicacion'}</Text>
              <Text className="text-xs mb-3" style={{ color: c.faint }}>{m.capacidad} personas - {m.pedidos_activos || 0} pedidos activos</Text>
              <View className="flex-row flex-wrap">
                {['Libre', 'Reservada', 'Ocupada', 'Cuenta'].map((estado) => {
                  const sel = m.estado === estado;
                  return (
                  <TouchableOpacity
                    key={estado}
                    onPress={() => updateMesaEstado(m.id, estado)}
                    className="px-3 py-2 rounded-lg mr-2 mb-2"
                    style={{ backgroundColor: sel ? c.primary : c.soft }}
                  >
                    <Text className="text-xs font-bold" style={{ color: sel ? c.onPrimary : c.muted }}>{estado}</Text>
                  </TouchableOpacity>
                  );
                })}
              </View>
              <View className="flex-row mt-3">
                <TouchableOpacity onPress={() => openTable(m)} className="flex-1 rounded-lg px-3 py-2 flex-row items-center justify-center mr-2" style={{ backgroundColor: c.soft }}>
                  <Edit3 size={15} color={c.muted} />
                  <Text className="font-bold text-xs ml-1" style={{ color: c.text }}>Editar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => confirmDanger('Eliminar mesa', `Eliminar permanentemente mesa ${m.numero}? Solo se permite si no tiene historial.`, () => deleteMesa(m.id))}
                  className="flex-1 rounded-lg px-3 py-2 flex-row items-center justify-center ml-2"
                  style={{ backgroundColor: c.redSoft }}
                >
                  <Trash2 size={15} color={c.red} />
                  <Text className="font-bold text-xs ml-1" style={{ color: c.red }}>Eliminar</Text>
                </TouchableOpacity>
              </View>
            </View>
            );
          }) : <EmptyState text="No hay mesas con ese filtro." />}
        </View>
        {renderTableModal()}
      </ScrollView>
    );
  }

  if (tab === 'trabajadores') {
    return (
      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        <SectionHeader
          icon={Users}
          title="Trabajadores"
          subtitle={`${trabajadores.length} usuarios registrados`}
          action={(
            <TouchableOpacity onPress={() => openWorker()} className="bg-blue-600 rounded-lg px-4 py-2 flex-row items-center">
              <Plus size={16} color="#fff" />
              <Text className="text-white font-bold ml-2">Nuevo usuario</Text>
            </TouchableOpacity>
          )}
        />
        <SearchBox value={searchTerm} onChangeText={setSearchTerm} placeholder="Buscar usuario, correo o rol..." />
        <View className="rounded-lg overflow-hidden" style={{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, ...softShadow(c) }}>
          {filteredTrabajadores.length ? filteredTrabajadores.map((w) => (
            <View key={w.id} className={`${compact ? 'flex-col items-start' : 'flex-row items-center'} px-5 py-4`} style={{ borderBottomWidth: 1, borderBottomColor: c.line }}>
              <View className="w-11 h-11 rounded-full items-center justify-center mr-3" style={{ backgroundColor: c.primarySoft }}>
                <Text className="font-extrabold" style={{ color: c.primaryText }}>{w.nombre?.charAt(0) || 'U'}</Text>
              </View>
              <View className="flex-1">
                <Text className="font-bold" style={{ color: c.text }}>{w.nombre}</Text>
                <Text className="text-xs" style={{ color: c.faint }}>{w.correo}</Text>
              </View>
              <View className={`${compact ? 'mt-3 flex-row items-center' : 'flex-row items-center'}`}>
                <Text className="font-bold capitalize mr-4" style={{ color: c.muted }}>{w.rol}</Text>
                <View className="px-3 py-1 rounded-full mr-2" style={{ backgroundColor: Number(w.pin_configurado || 0) ? c.greenSoft : c.soft }}>
                  <Text className="text-xs font-bold" style={{ color: Number(w.pin_configurado || 0) ? c.green : c.faint }}>
                    {Number(w.pin_configurado || 0) ? 'PIN' : 'Sin PIN'}
                  </Text>
                </View>
                <View className="px-3 py-1 rounded-full" style={{ backgroundColor: w.activo ? c.greenSoft : c.redSoft }}>
                  <Text className="text-xs font-bold" style={{ color: w.activo ? c.green : c.red }}>
                    {w.activo ? 'Activo' : 'Inactivo'}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => openWorker(w)} className="ml-3 w-9 h-9 rounded-lg items-center justify-center" style={{ backgroundColor: c.soft }}>
                  <Edit3 size={16} color={c.muted} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => confirmDanger('Eliminar usuario', `Eliminar permanentemente a ${w.nombre}? Solo se permite si no tiene historial.`, () => deleteTrabajador(w.id))}
                  className="ml-2 w-9 h-9 rounded-lg items-center justify-center"
                  style={{ backgroundColor: c.redSoft }}
                >
                  <Trash2 size={16} color={c.red} />
                </TouchableOpacity>
              </View>
            </View>
          )) : <EmptyState text="No hay usuarios con ese filtro." />}
        </View>
        {renderWorkerModal()}
      </ScrollView>
    );
  }

  if (tab === 'inventario') {
    return (
      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        <SectionHeader
          icon={Package}
          title="Inventario"
          subtitle={`${lowStock.length} items bajo stock minimo`}
          action={(
            <TouchableOpacity onPress={() => openInventory()} className="bg-blue-600 rounded-lg px-4 py-2 flex-row items-center">
              <Plus size={16} color="#fff" />
              <Text className="text-white font-bold ml-2">Nuevo item</Text>
            </TouchableOpacity>
          )}
        />
        <SearchBox value={searchTerm} onChangeText={setSearchTerm} placeholder="Buscar insumo, categoria o proveedor..." />
        <View className="rounded-lg overflow-hidden" style={{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, ...softShadow(c) }}>
          {filteredInventario.length ? filteredInventario.map((p) => {
            const danger = Number(p.stock || 0) <= 0;
            const warn = Number(p.stock || 0) > 0 && Number(p.stock || 0) <= Number(p.stock_minimo || 0);
            const stockColor = danger ? c.red : warn ? c.amber : c.green;
            return (
              <View key={p.id} className={`${compact ? 'flex-col items-start' : 'flex-row items-center'} px-5 py-4`} style={{ borderBottomWidth: 1, borderBottomColor: c.line }}>
                <View className="w-12 h-12 rounded-lg items-center justify-center" style={{ backgroundColor: c.soft }}>
                  <Package size={20} color={danger ? c.red : warn ? c.amber : c.muted} />
                </View>
                <View className="flex-1 ml-3">
                  <Text className="font-bold" style={{ color: c.text }}>{p.nombre}</Text>
                  <Text className="text-xs" style={{ color: c.faint }}>
                    {p.categoria || 'Sin categoria'} - {p.proveedor || 'Sin proveedor'} - {p.unidad}
                  </Text>
                </View>
                <View className={`${compact ? 'mt-3 flex-row flex-wrap items-center' : 'flex-row items-center'}`}>
                  <Text className="font-extrabold mr-5" style={{ color: c.primaryText }}>Costo {money(p.costo_unitario)}</Text>
                  <View className="px-3 py-1 rounded-full" style={{ backgroundColor: `${stockColor}22` }}>
                    <Text className="text-xs font-bold" style={{ color: stockColor }}>
                      {danger ? 'Sin stock' : `Stock ${Number(p.stock).toFixed(0)} / min ${Number(p.stock_minimo).toFixed(0)}`}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => openMovement(p)} className="ml-3 rounded-lg px-3 py-2" style={{ backgroundColor: c.soft }}>
                    <Text className="text-xs font-bold" style={{ color: c.text }}>Movimiento</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => openInventory(p)} className="ml-2 w-9 h-9 rounded-lg items-center justify-center" style={{ backgroundColor: c.soft }}>
                    <Edit3 size={16} color={c.muted} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => confirmDanger('Eliminar item', `Eliminar permanentemente ${p.nombre}? Solo se permite si no tiene movimientos o vinculos.`, () => deleteInventarioItem(p.id), 'Eliminar')}
                    className="ml-2 w-9 h-9 rounded-lg items-center justify-center"
                    style={{ backgroundColor: c.redSoft }}
                  >
                    <Trash2 size={16} color={c.red} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          }) : <EmptyState text="No hay inventario con ese filtro." />}
        </View>
        {renderInventoryModal()}
        {renderMovementModal()}
      </ScrollView>
    );
  }

  if (tab === 'extras') {
    return (
      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        <SectionHeader
          icon={Plus}
          title="Extras y modificadores"
          subtitle="Adicionales reales que el mesero puede sumar al pedido"
          action={(
            <TouchableOpacity onPress={() => openExtra()} className="bg-blue-600 rounded-lg px-4 py-3 flex-row items-center">
              <Plus size={17} color="#fff" />
              <Text className="text-white font-bold ml-2">Nuevo extra</Text>
            </TouchableOpacity>
          )}
        />
        <SearchBox value={searchTerm} onChangeText={setSearchTerm} placeholder="Buscar extra, tipo o categoria..." />

        <View className="rounded-lg overflow-hidden" style={{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, ...softShadow(c) }}>
          {filteredExtras.length ? filteredExtras.map((extra) => {
            const activo = Number(extra.activo) === 1;
            return (
            <View key={extra.id} className="p-4 flex-row items-center" style={{ borderBottomWidth: 1, borderBottomColor: c.line }}>
              <View className="flex-1 pr-3">
                <View className="flex-row items-center flex-wrap">
                  <Text className="font-extrabold mr-2" style={{ color: c.text }}>{extra.nombre}</Text>
                  <View className="px-2 py-1 rounded-full" style={{ backgroundColor: activo ? c.greenSoft : c.soft }}>
                    <Text className="text-[10px] font-bold" style={{ color: activo ? c.green : c.muted }}>
                      {activo ? 'Activo' : 'Inactivo'}
                    </Text>
                  </View>
                </View>
                <Text className="text-sm mt-1" style={{ color: c.muted }}>
                  {extra.tipo} - {extra.categoria || 'Sin categoria'} - {money(extra.precio)}
                </Text>
              </View>
              <TouchableOpacity onPress={() => openExtra(extra)} className="w-10 h-10 rounded-lg items-center justify-center mr-2" style={{ backgroundColor: c.soft }}>
                <Edit3 size={17} color={c.primaryText} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => confirmDanger('Eliminar extra', `Eliminar permanentemente ${extra.nombre}?`, () => deleteExtra(extra.id))}
                className="w-10 h-10 rounded-lg items-center justify-center"
                style={{ backgroundColor: c.redSoft }}
              >
                <Trash2 size={17} color={c.red} />
              </TouchableOpacity>
            </View>
            );
          }) : (
            <EmptyState text="No hay extras registrados." />
          )}
        </View>
        {renderExtraModal()}
      </ScrollView>
    );
  }

  if (tab === 'auditoria') {
    return (
      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        <SectionHeader
          icon={ShieldCheck}
          title="Auditoria visible"
          subtitle={`${auditoria.length} acciones recientes registradas`}
          action={(
            <TouchableOpacity onPress={() => fetchAuditoria()} className="rounded-lg px-4 py-2 flex-row items-center" style={{ backgroundColor: c.soft }}>
              <RefreshCw size={16} color={c.primaryText} />
              <Text className="font-bold ml-2" style={{ color: c.primaryText }}>Actualizar</Text>
            </TouchableOpacity>
          )}
        />

        <View className="flex-row flex-wrap mb-4" style={{ gap: 10 }}>
          {auditStats.map((item) => {
            const active = auditFilter === item.key;
            return (
              <TouchableOpacity
                key={item.key}
                onPress={() => setAuditFilter(item.key)}
                className="rounded-lg px-4 py-3"
                style={{
                  minWidth: compact ? '48%' : 190,
                  backgroundColor: active ? c.primary : c.surface,
                  borderWidth: 1,
                  borderColor: active ? c.primary : c.line,
                  ...softShadow(c),
                }}
              >
                <Text className="font-extrabold" style={{ color: active ? c.onPrimary : c.text }}>{item.count}</Text>
                <Text className="text-xs font-bold mt-1" style={{ color: active ? c.onPrimary : c.faint }}>{item.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View className="flex-row flex-wrap mb-4" style={{ gap: 8 }}>
          {AUDIT_FILTERS.map((item) => {
            const active = auditFilter === item.key;
            return (
              <TouchableOpacity
                key={item.key}
                onPress={() => setAuditFilter(item.key)}
                className="rounded-lg px-4 py-2"
                style={{ backgroundColor: active ? c.primary : c.soft, borderWidth: 1, borderColor: active ? c.primary : c.line }}
              >
                <Text className="text-xs font-extrabold" style={{ color: active ? c.onPrimary : c.muted }}>{item.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <SearchBox value={searchTerm} onChangeText={setSearchTerm} placeholder="Buscar por usuario, accion, entidad, fecha o motivo..." />

        {filteredAuditoria.length ? filteredAuditoria.map((row) => {
          const tint = auditTint(row, c);
          const summary = auditMetadataSummary(row);
          return (
            <View key={row.id} className="rounded-lg p-5 mb-3" style={{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, ...softShadow(c) }}>
              <View className={`${compact ? 'flex-col' : 'flex-row'} ${compact ? '' : 'items-start justify-between'}`}>
                <View className="flex-1" style={{ minWidth: 0 }}>
                  <View className="flex-row items-center mb-2">
                    <View className="w-10 h-10 rounded-lg items-center justify-center mr-3" style={{ backgroundColor: `${tint}1f` }}>
                      <ShieldCheck size={18} color={tint} />
                    </View>
                    <View className="flex-1" style={{ minWidth: 0 }}>
                      <Text className="text-base font-extrabold" style={{ color: c.text }} numberOfLines={1}>{auditActionLabel(row.accion)}</Text>
                      <Text className="text-xs font-bold mt-1" style={{ color: c.faint }} numberOfLines={1}>
                        {row.trabajador_nombre || 'Usuario desconocido'} · {row.rol || 'sin rol'}
                      </Text>
                    </View>
                  </View>
                  <Text className="font-bold mb-1" style={{ color: c.muted }}>{row.descripcion || auditActionLabel(row.accion)}</Text>
                  <Text className="text-sm" style={{ color: c.faint }}>
                    Motivo: {auditReason(row)}
                  </Text>
                  {summary ? (
                    <Text className="text-xs font-bold mt-2" style={{ color: c.text }}>
                      {summary}
                    </Text>
                  ) : null}
                </View>
                <View className={compact ? 'mt-3' : 'items-end ml-4'} style={{ minWidth: compact ? undefined : 178 }}>
                  <View className="px-3 py-1 rounded-full mb-2" style={{ backgroundColor: `${tint}1f` }}>
                    <Text className="text-xs font-extrabold" style={{ color: tint }}>{row.entidad}{row.entidad_id ? ` #${row.entidad_id}` : ''}</Text>
                  </View>
                  <Text className="text-xs font-bold" style={{ color: c.faint }}>{formatAuditDate(row.created_at)}</Text>
                  <Text className="text-xs font-bold mt-2" style={{ color: c.muted }}>{row.accion}</Text>
                </View>
              </View>
            </View>
          );
        }) : (
          <EmptyState text="No hay acciones de auditoria con ese filtro." />
        )}
      </ScrollView>
    );
  }

  if (tab === 'reportes') {
    const completed = pedidos.filter((p) => String(p.estado || '').toUpperCase() === 'PAGADO').length;
    const pending = pedidos.filter((p) => String(p.estado || '').toUpperCase() === 'PENDIENTE').length;
    const max = Math.max(completed, pending, activeOrders.length, 1);
    return (
      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        <SectionHeader icon={TrendingUp} title="Reportes" subtitle="Lectura rapida del dia" />
        <View className="rounded-lg p-5" style={{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, ...softShadow(c) }}>
          {[
            ['Completados', completed, c.green],
            ['Pendientes', pending, c.amber],
            ['Activos', activeOrders.length, c.sky],
          ].map(([label, value, color]) => (
            <View key={label} className="mb-5">
              <View className="flex-row justify-between mb-2">
                <Text className="font-bold" style={{ color: c.text }}>{label}</Text>
                <Text className="font-bold" style={{ color: c.muted }}>{value}</Text>
              </View>
              <View className="h-3 rounded-full overflow-hidden" style={{ backgroundColor: c.soft }}>
                <View className="h-3 rounded-full" style={{ width: `${(Number(value) / max) * 100}%`, backgroundColor: color }} />
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    );
  }

  if (tab === 'ubicaciones') {
    return (
      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        <SectionHeader
          icon={MapPin}
          title="Ubicaciones"
          subtitle={`${ubicaciones.filter((u) => Number(u.activo) === 1).length} zonas activas`}
          action={(
            <TouchableOpacity onPress={() => openLocation()} className="bg-blue-600 rounded-lg px-4 py-2 flex-row items-center">
              <Plus size={16} color="#fff" />
              <Text className="text-white font-bold ml-2">Nueva ubicacion</Text>
            </TouchableOpacity>
          )}
        />
        <SearchBox value={searchTerm} onChangeText={setSearchTerm} placeholder="Buscar zona o descripcion..." />
        {filteredUbicaciones.length ? filteredUbicaciones.map((location) => {
          const items = mesas.filter((m) => Number(m.ubicacion_id) === Number(location.id));
          const activa = Number(location.activo) === 1;
          return (
          <View key={location.id} className="rounded-lg p-5 mb-4" style={{ backgroundColor: c.surface, borderWidth: 1, borderColor: activa ? c.line : c.red, opacity: activa ? 1 : 0.7, ...softShadow(c) }}>
            <View className="flex-row items-start justify-between mb-3">
              <View className="flex-1">
                <Text className="text-lg font-extrabold" style={{ color: c.text }}>{location.nombre}</Text>
                <Text className="text-sm" style={{ color: c.faint }}>{location.descripcion || 'Sin descripcion'}</Text>
              </View>
              <View className="items-end">
                <View className="px-3 py-1 rounded-full mb-2" style={{ backgroundColor: activa ? c.greenSoft : c.redSoft }}>
                  <Text className="text-xs font-bold" style={{ color: activa ? c.green : c.red }}>
                    {activa ? 'Activa' : 'Inactiva'}
                  </Text>
                </View>
                <Text className="font-bold text-xs" style={{ color: c.muted }}>{items.filter((m) => Number(m.activo) === 1).length} mesas</Text>
              </View>
            </View>
            <View className="flex-row flex-wrap">
              {items.map((m) => (
                <View key={m.id} className="rounded-lg px-4 py-3 mr-3 mb-3" style={{ backgroundColor: c.soft }}>
                  <Text className="font-bold" style={{ color: c.text }}>Mesa {m.numero}</Text>
                  <Text className="text-xs" style={{ color: c.faint }}>{m.capacidad} pers. - {m.estado}</Text>
                </View>
              ))}
              {!items.length ? <Text className="font-semibold" style={{ color: c.faint }}>Sin mesas asignadas.</Text> : null}
            </View>
            <View className="flex-row mt-3">
              <TouchableOpacity onPress={() => openLocation(location)} className="rounded-lg px-4 py-2 flex-row items-center mr-2" style={{ backgroundColor: c.soft }}>
                <Edit3 size={15} color={c.muted} />
                <Text className="font-bold text-xs ml-1" style={{ color: c.text }}>Editar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => confirmDanger('Eliminar ubicacion', `Eliminar permanentemente ${location.nombre}? Solo se permite si no tiene mesas asignadas.`, () => deleteUbicacion(location.id))}
                className="rounded-lg px-4 py-2 flex-row items-center"
                style={{ backgroundColor: c.redSoft }}
              >
                <Trash2 size={15} color={c.red} />
                <Text className="font-bold text-xs ml-1" style={{ color: c.red }}>Eliminar</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
        }) : <EmptyState text="No hay ubicaciones con ese filtro." />}
        {renderLocationModal()}
      </ScrollView>
    );
  }

  const previewTaxRate = Math.max(0, Number(String(configForm.iva_porcentaje || '0').replace(',', '.'))) / 100;
  const previewServiceRate = Math.max(0, Number(String(configForm.servicio_porcentaje || '0').replace(',', '.'))) / 100;
  const previewBase = 10;
  const previewTax = previewBase * previewTaxRate;
  const previewService = previewBase * previewServiceRate;
  const previewTotal = previewBase + previewTax + previewService;
  const previewMoney = (value) => `${configForm.simbolo_moneda || '$'}${Number(value || 0).toFixed(2)}`;

  return (
    <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
      <SectionHeader
        icon={Settings}
        title="Configuracion del negocio"
        subtitle="Datos fiscales, logo, impuestos, tickets e impresoras"
        action={(
          <TouchableOpacity
            onPress={saveConfig}
            disabled={configBusy}
            className="rounded-lg px-4 py-2 flex-row items-center"
            style={{ backgroundColor: c.primary, opacity: configBusy ? 0.65 : 1 }}
          >
            <CheckCircle2 size={16} color={c.onPrimary} />
            <Text className="font-bold ml-2" style={{ color: c.onPrimary }}>
              {configBusy ? 'Guardando...' : 'Guardar cambios'}
            </Text>
          </TouchableOpacity>
        )}
      />

      <View className={`${compact ? 'flex-col' : 'flex-row'}`} style={{ gap: 16 }}>
        <View className="flex-1" style={{ gap: 16 }}>
          <View className="rounded-lg p-5" style={{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, ...softShadow(c) }}>
            <View className="flex-row items-center mb-4">
              <Settings size={18} color={c.primaryText} />
              <Text className="text-base font-extrabold ml-2" style={{ color: c.text }}>Identidad y datos fiscales</Text>
            </View>

            {[
              ['Nombre del restaurante', 'nombre_restaurante', 'Morena Mia'],
              ['Razon social', 'razon_social', 'Morena Mia Restaurante y Cafeteria'],
              ['RUC / Cedula fiscal', 'ruc', '0999999999001'],
              ['Direccion', 'direccion', 'Av. Principal y Calle Secundaria'],
              ['Telefono', 'telefono', '0999999999'],
              ['Correo', 'correo', 'facturacion@morenamia.com'],
            ].map(([label, key, placeholder]) => (
              <View key={key} className="mb-3">
                <Text className="font-bold text-xs mb-1" style={{ color: c.muted }}>{label}</Text>
                <TextInput
                  value={configForm[key]}
                  onChangeText={(value) => setConfigForm((current) => ({ ...current, [key]: value }))}
                  placeholder={placeholder}
                  placeholderTextColor={c.faint}
                  style={{ height: 44, borderRadius: 8, borderWidth: 1, borderColor: c.line, backgroundColor: c.surfaceAlt, color: c.text, paddingHorizontal: 12, fontWeight: '800' }}
                />
              </View>
            ))}
          </View>

          <View className="rounded-lg p-5" style={{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, ...softShadow(c) }}>
            <View className="flex-row items-center mb-4">
              <DollarSign size={18} color={c.primaryText} />
              <Text className="text-base font-extrabold ml-2" style={{ color: c.text }}>Impuestos y moneda</Text>
            </View>

            <View className={`${compact ? 'flex-col' : 'flex-row'}`} style={{ gap: 12 }}>
              {[
                ['IVA (%)', 'iva_porcentaje', '16'],
                ['Servicio (%)', 'servicio_porcentaje', '10'],
                ['Moneda', 'moneda', 'USD'],
                ['Simbolo', 'simbolo_moneda', '$'],
              ].map(([label, key, placeholder]) => (
                <View key={key} className="flex-1">
                  <Text className="font-bold text-xs mb-1" style={{ color: c.muted }}>{label}</Text>
                  <TextInput
                    value={configForm[key]}
                    onChangeText={(value) => setConfigForm((current) => ({ ...current, [key]: value }))}
                    placeholder={placeholder}
                    placeholderTextColor={c.faint}
                    keyboardType={key.includes('porcentaje') ? 'decimal-pad' : 'default'}
                    style={{ height: 44, borderRadius: 8, borderWidth: 1, borderColor: c.line, backgroundColor: c.surfaceAlt, color: c.text, paddingHorizontal: 12, fontWeight: '800' }}
                  />
                </View>
              ))}
            </View>
          </View>

          <View className="rounded-lg p-5" style={{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, ...softShadow(c) }}>
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-row items-center">
                <Printer size={18} color={c.primaryText} />
                <Text className="text-base font-extrabold ml-2" style={{ color: c.text }}>Impresoras predeterminadas</Text>
              </View>
              <TouchableOpacity
                onPress={loadPrinters}
                disabled={printerBusy}
                className="rounded-lg px-3 py-2 flex-row items-center"
                style={{ backgroundColor: c.soft, opacity: printerBusy ? 0.65 : 1 }}
              >
                <Search size={14} color={c.primaryText} />
                <Text className="font-bold text-xs ml-1" style={{ color: c.primaryText }}>
                  {printerBusy ? 'Buscando...' : 'Buscar impresoras'}
                </Text>
              </TouchableOpacity>
            </View>
            <Text className="text-sm mb-4" style={{ color: c.faint }}>
              Bluetooth o USB deben estar emparejadas/instaladas en el equipo donde corre el backend o el agente de impresion.
            </Text>
            <View className={`${compact ? 'flex-col' : 'flex-row'}`} style={{ gap: 12 }}>
              <View className="flex-1">
                <Text className="font-bold text-xs mb-1" style={{ color: c.muted }}>Caja / facturas / tickets</Text>
                <TextInput
                  value={configForm.impresora_caja}
                  onChangeText={(value) => setConfigForm((current) => ({ ...current, impresora_caja: value }))}
                  placeholder="Ej. EPSON TM-T20 Caja"
                  placeholderTextColor={c.faint}
                  style={{ height: 44, borderRadius: 8, borderWidth: 1, borderColor: c.line, backgroundColor: c.surfaceAlt, color: c.text, paddingHorizontal: 12, fontWeight: '800' }}
                />
              </View>
              <View className="flex-1">
                <Text className="font-bold text-xs mb-1" style={{ color: c.muted }}>Cocina / comandas</Text>
                <TextInput
                  value={configForm.impresora_cocina}
                  onChangeText={(value) => setConfigForm((current) => ({ ...current, impresora_cocina: value }))}
                  placeholder="Ej. EPSON Cocina"
                  placeholderTextColor={c.faint}
                  style={{ height: 44, borderRadius: 8, borderWidth: 1, borderColor: c.line, backgroundColor: c.surfaceAlt, color: c.text, paddingHorizontal: 12, fontWeight: '800' }}
                />
              </View>
            </View>
            {availablePrinters.length ? (
              <View className="mt-4">
                <Text className="font-bold text-xs mb-2" style={{ color: c.muted }}>Seleccionar impresora detectada</Text>
                {availablePrinters.map((printer) => (
                  <View key={printer.name} className={`${compact ? 'flex-col items-start' : 'flex-row items-center'} rounded-lg p-3 mb-2`} style={{ backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.line }}>
                    <View className="flex-1">
                      <Text className="font-extrabold" style={{ color: c.text }}>{printer.name}</Text>
                      <Text className="text-xs mt-1" style={{ color: c.faint }}>
                        {[printer.connection, printer.port, printer.driver].filter(Boolean).join(' - ') || 'Impresora del sistema'}
                      </Text>
                    </View>
                    <View className={`${compact ? 'mt-3' : ''} flex-row`} style={{ gap: 8 }}>
                      <TouchableOpacity
                        onPress={() => setConfigForm((current) => ({ ...current, impresora_caja: printer.name }))}
                        className="rounded-lg px-3 py-2"
                        style={{ backgroundColor: configForm.impresora_caja === printer.name ? c.primary : c.soft }}
                      >
                        <Text className="font-bold text-xs" style={{ color: configForm.impresora_caja === printer.name ? c.onPrimary : c.text }}>Usar en caja</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => setConfigForm((current) => ({ ...current, impresora_cocina: printer.name }))}
                        className="rounded-lg px-3 py-2"
                        style={{ backgroundColor: configForm.impresora_cocina === printer.name ? c.primary : c.soft }}
                      >
                        <Text className="font-bold text-xs" style={{ color: configForm.impresora_cocina === printer.name ? c.onPrimary : c.text }}>Usar en cocina</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        </View>

        <View className="rounded-lg p-5" style={{ width: compact ? '100%' : 380, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, ...softShadow(c) }}>
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-row items-center">
              <Receipt size={18} color={c.primaryText} />
              <Text className="text-base font-extrabold ml-2" style={{ color: c.text }}>Ticket y logo</Text>
            </View>
            <TouchableOpacity onPress={pickLogo} disabled={logoBusy} className="rounded-lg px-3 py-2 flex-row items-center" style={{ backgroundColor: c.soft, opacity: logoBusy ? 0.65 : 1 }}>
              <Upload size={14} color={c.primaryText} />
              <Text className="font-bold text-xs ml-1" style={{ color: c.primaryText }}>{logoBusy ? 'Subiendo...' : 'Logo'}</Text>
            </TouchableOpacity>
          </View>

          <View className="items-center rounded-lg p-4 mb-4" style={{ backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.line }}>
            {configForm.logo_url ? (
              <Image source={{ uri: assetUrl(configForm.logo_url) }} style={{ width: 190, height: 76, resizeMode: 'contain' }} />
            ) : (
              <Text className="font-bold" style={{ color: c.faint }}>Sin logo cargado</Text>
            )}
          </View>

          <Text className="font-bold text-xs mb-1" style={{ color: c.muted }}>URL del logo</Text>
          <TextInput
            value={configForm.logo_url}
            onChangeText={(value) => setConfigForm((current) => ({ ...current, logo_url: value }))}
            placeholder="/uploads/configuracion/logo.png"
            placeholderTextColor={c.faint}
            style={{ height: 44, borderRadius: 8, borderWidth: 1, borderColor: c.line, backgroundColor: c.surfaceAlt, color: c.text, paddingHorizontal: 12, fontWeight: '800', marginBottom: 12 }}
          />

          <Text className="font-bold text-xs mb-1" style={{ color: c.muted }}>Texto al pie del ticket</Text>
          <TextInput
            value={configForm.texto_ticket}
            onChangeText={(value) => setConfigForm((current) => ({ ...current, texto_ticket: value }))}
            multiline
            placeholder="Gracias por su compra"
            placeholderTextColor={c.faint}
            style={{ minHeight: 80, borderRadius: 8, borderWidth: 1, borderColor: c.line, backgroundColor: c.surfaceAlt, color: c.text, paddingHorizontal: 12, paddingVertical: 10, fontWeight: '800', textAlignVertical: 'top' }}
          />

          <View className="rounded-lg p-4 mt-5" style={{ backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CBD5E1' }}>
            <Text style={{ color: '#0F172A', textAlign: 'center', fontWeight: '900', fontSize: 16 }}>{configForm.nombre_restaurante || 'Morena Mia'}</Text>
            <Text style={{ color: '#475569', textAlign: 'center', fontSize: 11, fontWeight: '800', marginTop: 3 }}>{configForm.razon_social || 'Razon social'}</Text>
            <Text style={{ color: '#475569', textAlign: 'center', fontSize: 11, marginTop: 2 }}>{configForm.ruc ? `RUC: ${configForm.ruc}` : 'RUC pendiente'}</Text>
            <Text style={{ color: '#475569', textAlign: 'center', fontSize: 11, marginTop: 2 }}>{configForm.direccion || 'Direccion pendiente'}</Text>
            <Text style={{ color: '#475569', textAlign: 'center', fontSize: 11, marginTop: 2 }}>
              {[configForm.telefono, configForm.correo].filter(Boolean).join(' - ') || 'Telefono / correo pendiente'}
            </Text>
            <View style={{ height: 1, backgroundColor: '#CBD5E1', marginVertical: 12 }} />
            <Text style={{ color: '#0F172A', fontWeight: '900' }}>FACTURA FAC-000000123</Text>
            <Text style={{ color: '#334155', marginTop: 6 }}>Cliente: Consumidor Final</Text>
            <Text style={{ color: '#334155' }}>Metodo: Efectivo</Text>
            <View style={{ height: 1, backgroundColor: '#E2E8F0', marginVertical: 12 }} />
            <View className="flex-row justify-between"><Text>Subtotal</Text><Text>{previewMoney(previewBase)}</Text></View>
            <View className="flex-row justify-between"><Text>IVA {Number(configForm.iva_porcentaje || 0)}%</Text><Text>{previewMoney(previewTax)}</Text></View>
            <View className="flex-row justify-between"><Text>Servicio {Number(configForm.servicio_porcentaje || 0)}%</Text><Text>{previewMoney(previewService)}</Text></View>
            <View style={{ height: 1, backgroundColor: '#CBD5E1', marginVertical: 10 }} />
            <View className="flex-row justify-between"><Text style={{ fontWeight: '900' }}>TOTAL</Text><Text style={{ fontWeight: '900' }}>{previewMoney(previewTotal)}</Text></View>
            <Text style={{ textAlign: 'center', color: '#475569', fontWeight: '800', marginTop: 14 }}>{configForm.texto_ticket || 'Gracias por su compra'}</Text>
          </View>
        </View>
      </View>

      <View className="rounded-lg p-4 mt-4" style={{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.line }}>
        <View className="flex-row items-center mb-2">
          <CheckCircle2 size={18} color={c.green} />
          <Text className="font-bold ml-2" style={{ color: c.text }}>API conectada</Text>
        </View>
        <Text className="text-sm" style={{ color: c.muted }}>Backend actual: <Text style={{ color: c.primaryText, fontWeight: '900' }}>{BASE_URL}</Text></Text>
        <View className="flex-row items-center rounded-lg p-3 mt-3" style={{ backgroundColor: c.amberSoft }}>
          <AlertTriangle size={18} color={c.amber} />
          <Text className="text-sm ml-2 flex-1" style={{ color: c.amber }}>
            La impresora predeterminada se usara por el agente de impresion cuando se conecte al equipo de caja o cocina.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}




