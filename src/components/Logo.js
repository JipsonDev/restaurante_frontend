import React from 'react';
import { Image } from 'react-native';

// Relación de aspecto real del logo (ancho/alto ≈ 2.8).
const RATIO = 2.8;

const SIZES = {
  xs: 36,
  sm: 46,
  md: 60,
  lg: 76,
};

/**
 * Logo de Morena Mia.
 *
 * Se dimensiona por ALTURA y deriva el ancho con la relación de aspecto, así
 * nunca se deforma. Antes algunos modulos lo escalaban con `transform: scale()`
 * y se salía de la pantalla en móvil; ahora basta con elegir `size` o pasar una
 * altura concreta y el ancho se ajusta solo (con `resizeMode: contain`).
 */
export default function Logo({ size = 'md', height, width, style, dark = false }) {
  const h = width ? width / RATIO : height || SIZES[size] || SIZES.md;
  const w = width || Math.round(h * RATIO);
  return (
    <Image
      source={require('../../assets/logo-wide.png')}
      style={[
        { width: w, height: h, maxWidth: '100%', resizeMode: 'contain', flexShrink: 1 },
        dark ? { tintColor: '#F7F4E9' } : null,
        style,
      ]}
      accessibilityLabel="Morena Mia"
    />
  );
}
