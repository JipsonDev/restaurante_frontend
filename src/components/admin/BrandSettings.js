// Ajustes → Marca: logo y color del restaurante, con una vista previa de la app del mesero.
// El color se valida al vuelo: si es muy claro, los botones llevan texto oscuro (la vista previa lo muestra).
import React from 'react';
import { Image, Pressable, Text, TextInput, View } from 'react-native';
import { Check, ImageIcon, LayoutGrid, MoreHorizontal, ShoppingBag, Upload, UtensilsCrossed } from 'lucide-react-native';
import { useTheme } from '../../theme';
import { MenuButton } from '../MenuUI';
import { PRODUCT_BRAND, brandInitials, brandTones, parseHex } from '../../utils/brandPalette.mjs';
import { space, type } from './ui';

const PRESETS = ['#D63B20', '#E85D04', '#F4B400', '#2F9E44', '#0B7A5E', '#0A7EA4', '#1D4ED8', '#0A1F44', '#7C3AED', '#C2185B', '#5D4037', '#212121'];

export function BrandSettings({ name, logo, color, onColor, onPickLogo, logoBusy }) {
  const { c } = useTheme();
  const valid = !color || /^#[0-9a-f]{6}$/i.test(color);
  const tones = brandTones(valid && color ? color : PRODUCT_BRAND);
  const hexText = String(color || '');
  return <View style={{ gap: space.xl }}>
    <View style={{ gap: 8 }}>
      <Text style={[type.h3, { color: c.text }]}>Logo</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, flexWrap: 'wrap' }}>
        <View style={{ width: 160, height: 64, borderRadius: 8, borderWidth: 1, borderColor: c.line, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', padding: 8 }}>
          {logo ? <Image source={{ uri: logo }} resizeMode="contain" style={{ width: '100%', height: '100%' }} accessibilityLabel="Logo actual" /> : <ImageIcon size={24} color="#94A3B8" />}
        </View>
        <MenuButton icon={Upload} busy={logoBusy} onPress={onPickLogo}>{logo ? 'Cambiar logo' : 'Subir logo'}</MenuButton>
      </View>
      <Text style={[type.small, { color: c.muted }]}>Mejor en horizontal y con fondo transparente (PNG). Sin logo, la app muestra las iniciales del local.</Text>
    </View>

    <View style={{ gap: 8 }}>
      <Text style={[type.h3, { color: c.text }]}>Color principal</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }} accessibilityRole="radiogroup">
        {PRESETS.map(hex => {
          const on = hexText.toUpperCase() === hex;
          return <Pressable key={hex} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={`Color ${hex}`} onPress={() => onColor(hex)}
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: hex, alignItems: 'center', justifyContent: 'center', borderWidth: on ? 3 : 0, borderColor: c.surface, ...(on ? { boxShadow: `0 0 0 2px ${c.text}` } : null) }}>
            {on ? <Check size={18} color={brandTones(hex).onPrimary} strokeWidth={3} /> : null}
          </Pressable>;
        })}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: valid && color ? color : PRODUCT_BRAND, borderWidth: 1, borderColor: c.line }} />
        <TextInput value={hexText} onChangeText={v => onColor(('#' + v.replace(/[^0-9a-f]/gi, '')).slice(0, 7).toUpperCase().replace(/^#$/, ''))} placeholder={PRODUCT_BRAND} placeholderTextColor={c.muted}
          autoCapitalize="characters" maxLength={7} accessibilityLabel="Código del color de marca"
          style={{ width: 120, height: 36, borderRadius: 8, borderWidth: 1, borderColor: valid ? c.line : c.red, paddingHorizontal: 10, color: c.text, fontSize: 14, fontVariant: ['tabular-nums'], outlineStyle: 'none' }} />
        {color ? <Pressable accessibilityRole="button" onPress={() => onColor('')} style={{ paddingHorizontal: 8, height: 36, justifyContent: 'center' }}><Text style={[type.body, { color: c.interactive || c.primary }]}>Usar el color del sistema</Text></Pressable> : null}
      </View>
      {!valid ? <Text style={[type.small, { color: c.red }]}>Escribe un código de 6 cifras, por ejemplo #D63B20.</Text>
        : <Text style={[type.small, { color: c.muted }]}>Se usa en el botón principal, la pestaña activa y el carrito. Los estados de las mesas (lista, por cobrar…) tienen colores propios para no confundirse.</Text>}
    </View>

    {/* Vista previa: cabecera, barra del carrito y pestañas, con el texto que corresponde al color. */}
    <View style={{ gap: 8 }}>
      <Text style={[type.h3, { color: c.text }]}>Así se verá en la app del mesero</Text>
      <View style={{ width: 300, borderRadius: 20, borderWidth: 1, borderColor: c.line, backgroundColor: '#FFFFFF', overflow: 'hidden' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 }}>
          {logo ? <Image source={{ uri: logo }} resizeMode="contain" style={{ width: 96, height: 26 }} /> : <>
            <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: tones.primary, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: tones.onPrimary, fontWeight: '800', fontSize: 12 }}>{brandInitials(name)}</Text></View>
            <Text style={{ color: '#17171A', fontWeight: '700', fontSize: 15 }} numberOfLines={1}>{name || 'Restaurante'}</Text>
          </>}
        </View>
        <View style={{ paddingHorizontal: 12, paddingBottom: 12, gap: 10 }}>
          <View style={{ height: 48, borderRadius: 12, backgroundColor: tones.primary, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, gap: 10 }}>
            <View style={{ minWidth: 28, height: 28, borderRadius: 8, backgroundColor: tones.brandIsLight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: tones.onPrimary, fontWeight: '800' }}>3</Text></View>
            <Text style={{ flex: 1, color: tones.onPrimary, fontWeight: '700', fontSize: 15 }}>Ver ronda</Text>
            <Text style={{ color: tones.onPrimary, fontWeight: '700', fontVariant: ['tabular-nums'] }}>$12,35</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#EAEAEC', paddingVertical: 8 }}>
          {[[LayoutGrid, 'Mesas', false], [UtensilsCrossed, 'Menú', true], [ShoppingBag, 'Express', false], [MoreHorizontal, 'Más', false]].map(([Icon, label, on]) =>
            <View key={label} style={{ flex: 1, alignItems: 'center', gap: 2 }}>
              <Icon size={20} color={on ? tones.primaryText : '#5F5F6B'} />
              <Text style={{ fontSize: 11, fontWeight: on ? '700' : '500', color: on ? tones.primaryText : '#5F5F6B' }}>{label}</Text>
            </View>)}
        </View>
      </View>
    </View>
  </View>;
}
