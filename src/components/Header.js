import React, { useMemo, useState } from 'react';
import { Modal, ScrollView, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import {
  AlertTriangle,
  Bell,
  CalendarCheck,
  ClipboardList,
  Moon,
  RefreshCw,
  Sun,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react-native';
import { useAdmin } from '../context/AdminContext';
import { useTheme } from '../theme';

function isPickupOrder(order) {
  return !order?.mesa_id || ['Delivery', 'Para llevar', 'Express'].includes(order?.tipo);
}

function orderTargetLabel(order) {
  if (!order) return 'Pedido';
  if (isPickupOrder(order)) {
    const prefix = order.tipo === 'Delivery' ? 'Delivery' : 'Para llevar';
    return `${prefix} #${order.id || '-'}`;
  }
  return `Mesa ${order.mesa_numero || order.mesa_id || '-'}`;
}

const TITLES = {
  dashboard: ['Resumen', 'Lectura rapida de la operacion'],
  pedidos: ['Pedidos', 'Seguimiento de comandas y estados'],
  caja: ['Caja', 'Cobros, cortes y pagos recientes'],
  menu: ['Menu', 'Productos, categorias y recetas'],
  extras: ['Extras', 'Modificadores para pedidos'],
  mesas: ['Mesas', 'Salon, estados y ubicaciones'],
  trabajadores: ['Equipo', 'Usuarios y roles del sistema'],
  inventario: ['Inventario', 'Stock, costos y movimientos'],
  reportes: ['Reportes', 'Indicadores del dia'],
  auditoria: ['Auditoria', 'Trazabilidad de acciones criticas'],
  ubicaciones: ['Ubicaciones', 'Zonas del restaurante'],
  configuracion: ['Ajustes', 'Conexion y parametros'],
};

export default function Header({ activeTab }) {
  const [title, subtitle] = TITLES[activeTab] || [activeTab, 'Panel administrativo'];
  const { refreshAll, pedidos, productos, mesas, syncStatus } = useAdmin();
  const { c, isDark, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const { width } = useWindowDimensions();
  const compact = width < 760;

  const notifications = useMemo(() => {
    const activeOrders = pedidos.filter((p) => !['PAGADO', 'CANCELADO'].includes(String(p.estado || '').toUpperCase()));
    const lowStock = productos.filter((p) => Number(p.stock || 0) <= 3 || Number(p.disponible) === 0);
    const reserved = mesas.filter((m) => m.estado === 'Reservada');
    return [
      ...activeOrders.map((p) => ({
        id: `p-${p.id}`,
        title: `Pedido #${p.id}`,
        body: `${orderTargetLabel(p)} esta ${p.estado}.`,
        icon: ClipboardList,
      })),
      ...reserved.map((m) => ({
        id: `m-${m.id}`,
        title: `Mesa ${m.numero} reservada`,
        body: `${m.ubicacion_nombre || 'Salon'} - ${m.capacidad} personas.`,
        icon: CalendarCheck,
      })),
      ...lowStock.map((p) => ({
        id: `s-${p.id}`,
        title: `Stock bajo: ${p.nombre}`,
        body: `Stock actual: ${p.stock || 0}.`,
        icon: AlertTriangle,
      })),
    ];
  }, [pedidos, productos, mesas]);

  const connected = syncStatus === 'connected';
  const iconBtn = {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.soft,
  };

  return (
    <View style={{ minHeight: compact ? 64 : 78, paddingHorizontal: compact ? 10 : 24, paddingVertical: compact ? 9 : 12, backgroundColor: c.bg, borderBottomWidth: 1, borderBottomColor: c.line }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={{ color: c.text, fontSize: compact ? 18 : 26, fontWeight: '900' }} numberOfLines={1}>{title}</Text>
          {!compact ? <Text style={{ color: c.faint, fontSize: 13, fontWeight: '800', marginTop: 3 }}>{subtitle}</Text> : null}
        </View>

        {!compact ? (
          <View style={{ height: 42, borderRadius: 999, paddingHorizontal: 14, backgroundColor: connected ? c.greenSoft : c.amberSoft, flexDirection: 'row', alignItems: 'center', marginRight: 10 }}>
            {connected ? <Wifi size={17} color={c.green} /> : <WifiOff size={17} color={c.amber} />}
            <Text style={{ marginLeft: 8, color: connected ? c.green : c.amber, fontSize: 12, fontWeight: '900' }}>
              {connected ? 'En vivo' : 'Reconectando'}
            </Text>
          </View>
        ) : null}

        <TouchableOpacity onPress={toggle} style={{ ...iconBtn, marginRight: 8 }}>
          {isDark ? <Sun size={18} color={c.amber} /> : <Moon size={18} color={c.muted} />}
        </TouchableOpacity>
        <TouchableOpacity onPress={refreshAll} style={{ ...iconBtn, marginRight: 8 }}>
          <RefreshCw size={18} color={c.muted} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setOpen(true)} style={iconBtn}>
          <Bell size={18} color={c.muted} />
          {!!notifications.length && (
            <View style={{ position: 'absolute', top: -4, right: -4, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: c.red }}>
              <Text style={{ color: '#fff', fontSize: 10, fontWeight: '900' }}>{notifications.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: c.overlay }}>
          <View style={{ width: '100%', maxWidth: 480, maxHeight: '82%', borderRadius: 10, overflow: 'hidden', backgroundColor: c.surface }}>
            <View style={{ paddingHorizontal: 18, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: c.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: c.text, fontSize: 18, fontWeight: '900' }}>Alertas operativas</Text>
              <TouchableOpacity onPress={() => setOpen(false)}><X size={20} color={c.text} /></TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingVertical: 8 }}>
              {notifications.length ? notifications.map((n) => {
                const Icon = n.icon;
                return (
                  <View key={n.id} style={{ flexDirection: 'row', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: c.line }}>
                    <View style={{ width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12, backgroundColor: c.primarySoft }}>
                      <Icon size={18} color={c.primaryText} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: c.text, fontWeight: '900' }}>{n.title}</Text>
                      <Text style={{ color: c.muted, fontSize: 13, marginTop: 3, fontWeight: '700' }}>{n.body}</Text>
                    </View>
                  </View>
                );
              }) : (
                <Text style={{ color: c.faint, fontWeight: '800', textAlign: 'center', paddingVertical: 32 }}>No hay alertas pendientes.</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
