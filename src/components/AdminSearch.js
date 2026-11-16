import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { ArrowUpRight, Search, X } from 'lucide-react-native';
import { useTheme } from '../theme';

const sections = [
  ['dashboard', 'Resumen', 'Indicadores y operación'],
  ['pedidos', 'Pedidos', 'Comandas y cuentas abiertas'],
  ['caja', 'Caja', 'Cobros y turnos'],
  ['menu', 'Menú', 'Productos, categorías y recetas'],
  ['inventario', 'Inventario', 'Insumos, existencias y movimientos'],
  ['mesas', 'Mesas', 'Salón y capacidad'],
  ['trabajadores', 'Equipo', 'Usuarios y roles'],
  ['reportes', 'Reportes', 'Ventas e indicadores'],
  ['extras', 'Extras', 'Modificadores y complementos'],
  ['ubicaciones', 'Ubicaciones', 'Zonas del restaurante'],
  ['auditoria', 'Auditoría', 'Historial de acciones'],
  ['configuracion', 'Ajustes', 'Configuración del sistema'],
];
const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export default function AdminSearch({ onNavigate, compact }) {
  const { c } = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const results = sections.filter(([, title, description]) => normalize(`${title} ${description}`).includes(normalize(query.trim())));
  const choose = key => { setOpen(false); setQuery(''); onNavigate?.(key); };
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel="Buscar sección" onPress={() => { setQuery(''); setOpen(true); }} style={{ minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: c.line, backgroundColor: c.surfaceAlt, maxWidth: 440, flex: compact ? undefined : 1 }}>
      <Search size={18} color={c.muted} />
      {!compact && <Text style={{ color: c.muted, fontSize: 12 }}>Buscar una sección del panel…</Text>}
    </Pressable>
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: c.overlay }}>
        <View style={{ width: '100%', maxWidth: 520, maxHeight: '80%', borderRadius: 12, backgroundColor: c.surface, overflow: 'hidden' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderBottomWidth: 1, borderBottomColor: c.line }}>
            <Search size={20} color={c.muted} />
            <TextInput autoFocus accessibilityLabel="Buscar en las secciones" placeholder="¿A qué sección quieres ir?" placeholderTextColor={c.muted} value={query} onChangeText={setQuery} onSubmitEditing={() => results.length && choose(results[0][0])} style={{ flex: 1, minWidth: 0, minHeight: 44, color: c.text, fontSize: 14 }} />
            <Pressable accessibilityRole="button" accessibilityLabel="Cerrar búsqueda" onPress={() => setOpen(false)} style={{ padding: 10 }}><X size={20} color={c.muted} /></Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 8 }}>
            {results.map(([key, title, description]) => <Pressable key={key} accessibilityRole="button" accessibilityLabel={`Ir a ${title}`} onPress={() => choose(key)} style={({ hovered }) => ({ padding: 14, borderRadius: 8, backgroundColor: hovered ? c.soft : c.surface, flexDirection: 'row', alignItems: 'center', gap: 12 })}>
              <View style={{ flex: 1 }}><Text style={{ color: c.text, fontSize: 14, fontWeight: '600' }}>{title}</Text><Text style={{ color: c.muted, fontSize: 12, marginTop: 4 }}>{description}</Text></View><ArrowUpRight size={17} color={c.primaryText} />
            </Pressable>)}
            {!results.length && <Text style={{ color: c.muted, padding: 24, textAlign: 'center' }}>No se encontraron secciones.</Text>}
          </ScrollView>
        </View>
      </View>
    </Modal>
  </>;
}
