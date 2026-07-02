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
export default function Logo({ size = 'md', height, style, dark = false }) {
  const h = height || SIZES[size] || SIZES.md;
  const w = Math.round(h * RATIO);
  return (
    <Image
      source={require('../../assets/logo-wide.png')}
      style={[
        { width: w, height: h, resizeMode: 'contain' },
        dark ? { tintColor: '#ffffff' } : null,
        style,
      ]}
      accessibilityLabel="Morena Mia"
    />
  );
}
