import { Banknote, ChartNoAxesCombined, CirclePlus, LayoutDashboard, LayoutGrid, MapPin, Package, ScrollText, Settings2, ShoppingBag, UsersRound, UtensilsCrossed } from 'lucide-react-native';

// Navegación del panel: una sola fuente para barra lateral, barra inferior y buscador.
export const NAV_GROUPS = [
  { title: 'Operación', items: [
    { key: 'dashboard', label: 'Resumen', icon: LayoutDashboard, description: 'El pulso del día y lo que necesita atención' },
    { key: 'pedidos', label: 'Pedidos', icon: ShoppingBag, description: 'Cuentas abiertas, cocina y entregas' },
    { key: 'caja', label: 'Caja', icon: Banknote, description: 'Turno, cobros y cierres' },
    { key: 'mesas', label: 'Mesas', icon: LayoutGrid, description: 'Salón, estados y capacidad' },
  ] },
  { title: 'Catálogo', items: [
    { key: 'menu', label: 'Menú', icon: UtensilsCrossed, description: 'Productos, precios y categorías' },
    { key: 'extras', label: 'Extras', icon: CirclePlus, description: 'Adicionales y preferencias' },
    { key: 'inventario', label: 'Inventario', icon: Package, description: 'Insumos, stock y costos' },
    { key: 'ubicaciones', label: 'Ubicaciones', icon: MapPin, description: 'Zonas del local' },
  ] },
  { title: 'Gestión', items: [
    { key: 'reportes', label: 'Reportes', icon: ChartNoAxesCombined, description: 'Ventas, canales y productos' },
    { key: 'trabajadores', label: 'Equipo', icon: UsersRound, description: 'Usuarios, roles y accesos' },
    { key: 'auditoria', label: 'Auditoría', icon: ScrollText, description: 'Historial de acciones' },
    { key: 'configuracion', label: 'Ajustes', icon: Settings2, description: 'Negocio, facturación e impresión' },
  ] },
];

export const NAV = NAV_GROUPS.flatMap(group => group.items);
export const navItem = key => NAV.find(item => item.key === key) || { key, label: key, description: '' };
export const MOBILE_PRIMARY = ['dashboard', 'pedidos', 'caja', 'mesas'];
