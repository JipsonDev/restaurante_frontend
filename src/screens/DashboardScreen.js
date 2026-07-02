import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Image, useWindowDimensions } from 'react-native';
import {
  ShoppingBag, DollarSign, Utensils, Users, Package,
  ChevronRight, Clock, AlertTriangle,
  ShieldCheck, Receipt, BadgePercent, PlusCircle,
} from 'lucide-react-native';
import axios from 'axios';
import { assetUrl, BASE_URL } from '../context/AuthContext';
import { useAdmin } from '../context/AdminContext';
import { useTheme, softShadow } from '../theme';

const money = (value) => `$${Number(value || 0).toLocaleString('es-MX', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})}`;

function isPickupOrder(order) {
  return !order?.mesa_id || ['Delivery', 'Para llevar', 'Express'].includes(order?.tipo);
}

const normalizeText = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function orderTargetLabel(order) {
  if (!order) return 'Pedido';
  if (isPickupOrder(order)) {
    const prefix = order.tipo === 'Delivery' ? 'Delivery' : 'Para llevar';
    const customer = order.cliente_nombre ? ` - ${order.cliente_nombre}` : '';
    return `${prefix} #${order.id || '-'}${customer}`;
  }
  return `Mesa ${order.mesa_numero || order.mesa_id || '-'}`;
}

function isPromotionProduct(product) {
  const name = normalizeText(product?.nombre || '');
  const category = normalizeText(product?.categoria_nombre || product?.categoria || '');
  const description = normalizeText(product?.descripcion || '');
  return category.includes('promo') || name.includes('promo') || description.includes('promo');
}

function productStock(product) {
  return Number((product?.inventario_item_id ? product?.inventario_stock : product?.stock) ?? 0);
}

function MetricCard({ title, value, detail, icon: Icon, tint, c, width }) {
  return (
    <View style={{ width, backgroundColor: c.surface, borderRadius: 12, borderWidth: 1, borderColor: c.line, padding: 16, ...softShadow(c) }}>
      <View className="flex-row items-center justify-between mb-3">
        <Text className="font-extrabold text-xs uppercase" style={{ color: c.faint, letterSpacing: 0.4 }}>{title}</Text>
        <View className="p-2 rounded-lg" style={{ backgroundColor: `${tint}1f` }}>
          <Icon size={19} color={tint} />
        </View>
      </View>
      <Text className="text-2xl font-extrabold mb-1" style={{ color: c.text }} numberOfLines={1}>{value}</Text>
      <Text className="text-xs font-bold" style={{ color: c.muted }}>{detail}</Text>
    </View>
  );
}

export default function DashboardScreen({ setActiveTab }) {
  const { pedidos, productos, trabajadores, mesas, inventario, extras, caja } = useAdmin();
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const isPhone = width < 700;
  const isWide = width >= 1100;
  const [stats, setStats] = useState(null);
  const [loadStats, setLoadStats] = useState(true);

  // En el área de contenido (con sidebar) el ancho disponible es menor; usamos
  // % para garantizar 2 columnas en móvil y más en pantallas grandes.
  const metricW = isPhone ? '48%' : isWide ? '23%' : '48%';

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await axios.get(`${BASE_URL}/dashboard/stats`);
        setStats(res.data);
      } catch {
        setStats(null);
      } finally {
        setLoadStats(false);
      }
    };
    fetchStats();
  }, []);

  const derived = useMemo(() => {
    const ventas = pedidos.reduce((sum, p) => sum + Number(p.total || 0), 0);
    const stockBajo = inventario.filter((p) => Number(p.stock || 0) <= Number(p.stock_minimo || 0)).length;
    const agotados = inventario.filter((p) => Number(p.stock || 0) <= 0).length;
    return {
      pedidosHoy: stats?.pedidosHoy ?? pedidos.length,
      ventasHoy: stats?.ventasHoy ?? ventas,
      ticketPromedio: stats?.ticketPromedio ?? (pedidos.length ? ventas / pedidos.length : 0),
      clientesHoy: stats?.clientesHoy ?? mesas.filter((m) => m.estado !== 'Libre').length,
      stock: stats?.stock ?? inventario.length,
      stockBajo: stats?.stockBajo ?? stockBajo,
      agotados: stats?.agotados ?? agotados,
    };
  }, [pedidos, inventario, mesas, stats]);

  const metrics = [
    { title: 'Pedidos hoy', value: String(derived.pedidosHoy), detail: 'Ordenes activas del dia', icon: ShoppingBag, tint: c.amber },
    { title: 'Ventas hoy', value: money(derived.ventasHoy), detail: 'Total registrado', icon: DollarSign, tint: c.green },
    { title: 'Ticket promedio', value: money(derived.ticketPromedio), detail: 'Promedio por pedido', icon: Utensils, tint: c.accent },
    { title: 'Mesas ocupadas', value: String(derived.clientesHoy), detail: 'Mesas con consumo', icon: Users, tint: c.sky },
  ];

  const STATUS_COLOR = {
    PAGADO: c.green, PENDIENTE: c.muted, PREPARANDO: c.amber,
    LISTO: c.sky, ENTREGADO: c.accent, CANCELADO: c.red,
  };

  const recentOrders = pedidos.slice(0, 4);
  const promoProducts = productos.filter(isPromotionProduct);
  const menuProducts = productos.filter((p) => !isPromotionProduct(p));
  const menuIssues = menuProducts.filter((p) => Number(p.disponible) !== 1 || productStock(p) <= 0);
  const promoIssues = promoProducts.filter((p) => Number(p.disponible) !== 1 || productStock(p) <= 0);
  const inventoryIssues = inventario.filter((p) => Number(p.stock || 0) <= Number(p.stock_minimo || 0));
  const extraInactive = extras.filter((extra) => Number(extra.activo) !== 1).length;
  const stockSections = [
    {
      key: 'inventario',
      title: 'Inventario',
      value: String(inventario.length),
      detail: `${inventoryIssues.length} bajo minimo`,
      tint: inventoryIssues.length ? c.amber : c.green,
      bg: inventoryIssues.length ? c.amberSoft : c.greenSoft,
      icon: Package,
      tab: 'inventario',
    },
    {
      key: 'menu',
      title: 'Menu',
      value: String(menuProducts.filter((p) => Number(p.disponible) === 1).length),
      detail: `${menuIssues.length} con alerta`,
      tint: menuIssues.length ? c.red : c.sky,
      bg: menuIssues.length ? c.redSoft : c.skySoft,
      icon: Utensils,
      tab: 'menu',
    },
    {
      key: 'promos',
      title: 'Promos',
      value: String(promoProducts.filter((p) => Number(p.disponible) === 1).length),
      detail: `${promoIssues.length} con alerta`,
      tint: promoIssues.length ? c.amber : c.green,
      bg: promoIssues.length ? c.amberSoft : c.greenSoft,
      icon: BadgePercent,
      tab: 'menu',
    },
    {
      key: 'extras',
      title: 'Extras',
      value: String(extras.filter((extra) => Number(extra.activo) === 1).length),
      detail: `${extraInactive} inactivos`,
      tint: extraInactive ? c.amber : c.primaryText,
      bg: extraInactive ? c.amberSoft : c.primarySoft,
      icon: PlusCircle,
      tab: 'extras',
    },
  ];
  const lowStock = [
    ...inventoryIssues.map((item) => ({
      ...item,
      source: 'Inventario',
      stockLabel: `${Number(item.stock || 0).toFixed(0)} / min ${Number(item.stock_minimo || 0).toFixed(0)}`,
      alertColor: Number(item.stock || 0) <= 0 ? c.red : c.amber,
    })),
    ...menuIssues.map((item) => ({
      ...item,
      source: 'Menu',
      stockLabel: Number(item.disponible) !== 1 ? 'Inactivo' : 'Sin stock',
      alertColor: c.red,
    })),
    ...promoIssues.map((item) => ({
      ...item,
      source: 'Promo',
      stockLabel: Number(item.disponible) !== 1 ? 'Inactiva' : 'Sin stock',
      alertColor: c.amber,
    })),
  ].slice(0, 4);
  const stockRows = (lowStock.length ? lowStock : stockSections.map((section) => ({
    id: section.key,
    source: section.title,
    nombre: `${section.title} en orden`,
    categoria_nombre: section.detail,
    stockLabel: section.value,
    alertColor: section.tint,
    icon: section.icon,
    tab: section.tab,
  }))).slice(0, 2);

  const card = { backgroundColor: c.surface, borderRadius: 12, borderWidth: 1, borderColor: c.line, ...softShadow(c) };
  const activeOrdersCount = pedidos.filter((p) => !['PAGADO', 'CANCELADO'].includes(String(p.estado || '').toUpperCase())).length;

  return (
    <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
      <View style={{ ...card, padding: isPhone ? 16 : 20, marginBottom: 14 }}>
        <View className={isWide ? 'flex-row items-center justify-between' : 'flex-col'} style={{ gap: 14 }}>
          <View className="flex-1">
            <View className="flex-row items-center mb-2">
              <View className="w-10 h-10 rounded-lg items-center justify-center mr-3" style={{ backgroundColor: c.primarySoft }}>
                <Receipt size={20} color={c.primaryText} />
              </View>
              <View className="flex-1">
                <Text className="text-xl font-extrabold" style={{ color: c.text }}>Operacion de hoy</Text>
                <Text className="text-sm font-bold" style={{ color: c.faint }} numberOfLines={1}>
                  Caja {caja?.caja ? `abierta #${caja.caja.id}` : 'cerrada'} - {activeOrdersCount} pedidos activos
                </Text>
              </View>
            </View>
            <Text className="text-sm font-semibold" style={{ color: c.muted }}>
              Resumen rapido para controlar ventas, pedidos, stock y acciones administrativas desde un solo lugar.
            </Text>
          </View>
          <View className="flex-row flex-wrap" style={{ gap: 8 }}>
            {[
              ['Cobrar', 'caja', c.green, DollarSign],
              ['Pedidos', 'pedidos', c.amber, ShoppingBag],
              ['Seguridad', 'auditoria', c.primaryText, ShieldCheck],
            ].map(([label, tab, tint, Icon]) => (
              <TouchableOpacity
                key={label}
                onPress={() => setActiveTab?.(tab)}
                className="rounded-lg px-4 py-3 flex-row items-center"
                style={{ backgroundColor: `${tint}18`, borderWidth: 1, borderColor: `${tint}44` }}
              >
                <Icon size={16} color={tint} />
                <Text className="font-extrabold text-xs ml-2" style={{ color: tint }}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      <View className={isWide ? 'flex-row' : 'flex-col'} style={{ gap: 14, marginBottom: 14 }}>
        <View style={{ ...card, padding: 16, flex: 1.2 }}>
          <View className="flex-row justify-between items-center mb-4">
            <View>
              <Text className="text-base font-extrabold" style={{ color: c.text }}>Equipo activo</Text>
              <Text className="text-xs font-bold mt-1" style={{ color: c.faint }}>{trabajadores.length} usuarios registrados</Text>
            </View>
            <TouchableOpacity onPress={() => setActiveTab?.('trabajadores')} className="rounded-lg px-3 py-2" style={{ backgroundColor: c.soft }}>
              <Text className="text-xs font-extrabold" style={{ color: c.primaryText }}>Gestionar</Text>
            </TouchableOpacity>
          </View>
          <View className="flex-row flex-wrap" style={{ gap: 10 }}>
            {trabajadores.slice(0, isWide ? 7 : 8).map((w) => (
              <TouchableOpacity
                key={w.id}
                onPress={() => setActiveTab?.('trabajadores')}
                className="rounded-lg px-3 py-3 flex-row items-center"
                style={{ minWidth: isPhone ? '47%' : 138, flexGrow: 1, backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.line }}
              >
                <View className="w-10 h-10 rounded-lg items-center justify-center mr-3" style={{ backgroundColor: c.primarySoft }}>
                  <Text className="font-extrabold" style={{ color: c.primaryText }}>{w.nombre?.charAt(0)?.toUpperCase() || 'U'}</Text>
                </View>
                <View className="flex-1" style={{ minWidth: 0 }}>
                  <Text className="font-extrabold text-xs" style={{ color: c.text }} numberOfLines={1}>{w.nombre || 'Usuario'}</Text>
                  <Text className="text-xs capitalize font-bold mt-0.5" style={{ color: c.faint }}>{w.rol || 'equipo'}</Text>
                </View>
              </TouchableOpacity>
            ))}
            {!trabajadores.length && <Text className="text-sm font-bold" style={{ color: c.faint }}>No se cargaron trabajadores.</Text>}
          </View>
        </View>

        <View style={{ ...card, padding: 16, flex: 0.8 }}>
          <View className="flex-row justify-between items-center mb-4">
            <View>
              <Text className="text-base font-extrabold" style={{ color: c.text }}>Flujo rapido</Text>
              <Text className="text-xs font-bold mt-1" style={{ color: c.faint }}>Atajos del turno</Text>
            </View>
          </View>
          <View style={{ gap: 8 }}>
            {[
              ['Abrir o cerrar caja', 'caja', DollarSign, c.green],
              ['Ver pedidos activos', 'pedidos', ShoppingBag, c.amber],
              ['Auditoria y seguridad', 'auditoria', ShieldCheck, c.primaryText],
            ].map(([label, tab, Icon, tint]) => (
              <TouchableOpacity
                key={label}
                onPress={() => setActiveTab?.(tab)}
                className="rounded-lg px-4 py-3 flex-row items-center justify-between"
                style={{ backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.line }}
              >
                <View className="flex-row items-center">
                  <Icon size={17} color={tint} />
                  <Text className="font-extrabold text-sm ml-2" style={{ color: c.text }}>{label}</Text>
                </View>
                <ChevronRight size={16} color={c.faint} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {loadStats ? (
        <View className="items-center py-8" style={card}>
          <ActivityIndicator color={c.primary} />
        </View>
      ) : (
        <View className="flex-row flex-wrap mb-4" style={{ gap: 10 }}>
          {metrics.map((m) => <MetricCard key={m.title} {...m} c={c} width={metricW} />)}
        </View>
      )}

      <View className={isWide ? 'flex-row' : 'flex-col'} style={{ gap: 14 }}>
        <View style={{ flex: isWide ? 1 : undefined, minWidth: 0 }}>
          <View style={{ ...card, padding: 16, minHeight: isWide ? 390 : undefined }}>
            <View className="flex-row justify-between items-center mb-4">
              <View>
                <Text className="text-base font-extrabold" style={{ color: c.text }}>Estado de existencias</Text>
                <Text className="text-xs font-bold mt-1" style={{ color: c.faint }}>Inventario fisico, menu, promos y extras</Text>
              </View>
              <TouchableOpacity onPress={() => setActiveTab?.('inventario')} className="flex-row items-center">
                <Text className="text-sm font-bold mr-1" style={{ color: c.primaryText }}>Ver detalle</Text>
                <ChevronRight size={14} color={c.primaryText} />
              </TouchableOpacity>
            </View>
            <View className="flex-row flex-wrap mb-4" style={{ gap: 10 }}>
              {stockSections.map((section) => {
                const Icon = section.icon;
                return (
                  <TouchableOpacity
                    key={section.key}
                    onPress={() => setActiveTab?.(section.tab)}
                    className="rounded-lg p-3"
                    style={{ width: isPhone ? '48%' : '23.5%', minWidth: 142, flexGrow: 1, minHeight: 86, backgroundColor: section.bg, borderWidth: 1, borderColor: `${section.tint}33` }}
                  >
                    <View className="flex-row items-center justify-between mb-2">
                      <Icon size={18} color={section.tint} />
                      <Text className="text-2xl font-extrabold" style={{ color: section.tint }}>{section.value}</Text>
                    </View>
                    <Text className="font-extrabold text-sm" style={{ color: section.tint }}>{section.title}</Text>
                    <Text className="text-xs font-bold mt-1" style={{ color: section.tint }}>{section.detail}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={{ maxHeight: isWide ? 116 : undefined, overflow: 'hidden' }}>
              {stockRows.map((p) => {
                const RowIcon = p.icon || AlertTriangle;
                return (
                <TouchableOpacity
                  key={`${p.source}-${p.id}`}
                  onPress={() => p.tab ? setActiveTab?.(p.tab) : undefined}
                  className="flex-row items-center py-2"
                  style={{ minHeight: 48, borderTopWidth: 1, borderTopColor: c.line }}
                >
                  {p.imagen_url ? (
                    <Image source={{ uri: assetUrl(p.imagen_url) }} style={{ width: 38, height: 38, borderRadius: 10 }} />
                  ) : (
                    <View className="w-10 h-10 rounded-xl items-center justify-center" style={{ backgroundColor: `${p.alertColor || c.amber}1f` }}>
                      <RowIcon size={17} color={p.alertColor || c.amber} />
                    </View>
                  )}
                  <View className="flex-1 ml-3">
                    <Text className="font-bold text-sm" style={{ color: c.text }} numberOfLines={1}>{p.nombre}</Text>
                    <Text className="text-xs font-bold" style={{ color: c.faint }}>{p.source} - {p.categoria_nombre || p.categoria || 'Sin categoria'}</Text>
                  </View>
                  <Text className="font-bold text-sm" style={{ color: p.alertColor || c.amber }}>
                    {p.stockLabel}
                  </Text>
                </TouchableOpacity>
              );
              })}
            </View>
            <TouchableOpacity
              onPress={() => setActiveTab?.('inventario')}
              className="rounded-lg px-4 py-3 flex-row items-center justify-between mt-3"
              style={{ backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.line }}
            >
              <Text className="text-sm font-extrabold" style={{ color: c.text }}>Revisar existencias completas</Text>
              <ChevronRight size={16} color={c.faint} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ flex: isWide ? 1 : undefined, width: isWide ? undefined : '100%', minWidth: 0 }}>
          <View style={{ ...card, padding: 16, minHeight: isWide ? 390 : undefined }}>
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-base font-extrabold" style={{ color: c.text }}>Pedidos recientes</Text>
              <TouchableOpacity onPress={() => setActiveTab?.('pedidos')}>
                <Text className="text-sm font-bold" style={{ color: c.primaryText }}>Ver todos</Text>
              </TouchableOpacity>
            </View>
            <View style={{ maxHeight: isWide ? 268 : undefined, overflow: 'hidden' }}>
              {recentOrders.length ? recentOrders.map((o) => {
                const tint = STATUS_COLOR[o.estado] || c.muted;
                return (
                  <View key={o.id} className="py-2.5" style={{ minHeight: 66, borderBottomWidth: 1, borderBottomColor: c.line }}>
                    <View className="flex-row justify-between items-start">
                      <View style={{ flex: 1, minWidth: 0, paddingRight: 10 }}>
                        <Text className="font-bold text-sm" style={{ color: c.text }}>Pedido #{o.id}</Text>
                        <Text className="text-xs mt-0.5" style={{ color: c.muted }} numberOfLines={1}>
                          {orderTargetLabel(o)} - {o.items?.length || 0} items
                        </Text>
                      </View>
                      <View className="items-end">
                        <Text className="font-bold text-sm" style={{ color: c.text }}>{money(o.total)}</Text>
                        <View className="mt-1 px-2.5 py-0.5 rounded-full" style={{ backgroundColor: `${tint}22` }}>
                          <Text className="text-xs font-bold" style={{ color: tint }}>{o.estado}</Text>
                        </View>
                      </View>
                    </View>
                    <View className="flex-row items-center mt-1">
                      <Clock size={12} color={c.faint} />
                      <Text className="text-xs ml-1" style={{ color: c.faint }}>
                        {new Date(o.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                  </View>
                );
              }) : (
                <View className="rounded-lg px-4 py-4" style={{ backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.line }}>
                  <Text className="text-sm font-bold" style={{ color: c.faint }}>Todavia no hay pedidos hoy.</Text>
                </View>
              )}
            </View>
            <TouchableOpacity
              onPress={() => setActiveTab?.('pedidos')}
              className="rounded-lg px-4 py-3 flex-row items-center justify-between mt-3"
              style={{ backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.line }}
            >
              <Text className="text-sm font-extrabold" style={{ color: c.text }}>Abrir seguimiento de pedidos</Text>
              <ChevronRight size={16} color={c.faint} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
