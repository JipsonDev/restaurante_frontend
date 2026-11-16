import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { Delete } from 'lucide-react-native';
import { loginColors as c, loginStyles as s } from './loginStyles';

const KEYS = [['1', ''], ['2', 'ABC'], ['3', 'DEF'], ['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'], ['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ'], [null], ['0', ''], ['back']];

/**
 * PIN de 4 dígitos estilo pantalla de bloqueo: 4 puntos + teclado circular grande
 * (cómodo en tablets del local). Envía al marcar el 4º dígito, acepta teclado físico
 * (input oculto) y sacude los puntos cuando cambia `errorKey` (respeta "reducir movimiento").
 */
export default function PinPad({ value, onChange, onComplete, disabled, errorKey, inputRef, label = 'PIN de acceso', autoFocus, compact = false }) {
  const size = compact ? 64 : 76;
  const keySize = { width: size, height: size, borderRadius: size / 2 };
  const shake = useRef(new Animated.Value(0)).current;
  const reduceMotion = useRef(false);
  const hasError = useRef(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled?.().then(v => { reduceMotion.current = !!v; }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!errorKey) return;
    hasError.current = true;
    shake.setValue(0);
    Animated.sequence([12, -10, 7, -4, 0].map(toValue => Animated.timing(shake, { toValue, duration: 50, useNativeDriver: Platform.OS !== 'web' }))).start();
  }, [errorKey, shake]);

  function setPin(next) {
    const clean = next.replace(/\D/g, '').slice(0, 4);
    hasError.current = false;
    onChange(clean);
    if (clean.length === 4 && clean !== value) onComplete?.(clean);
  }

  function press(key) {
    if (disabled) return;
    if (key === 'back') return onChange(value.slice(0, -1));
    if (value.length < 4) setPin(value + key);
  }

  return <View style={{ alignItems: 'center', gap: compact ? 16 : 22 }}>
    <Pressable onPress={() => inputRef?.current?.focus()} accessible={false}>
      <Animated.View style={[s.pinCells, { transform: [{ translateX: shake }] }]}>
        {[0, 1, 2, 3].map(index => {
          const filled = index < value.length;
          return <View key={index} style={[s.pinDot, { borderColor: filled ? c.gold : c.line, backgroundColor: filled ? c.gold : 'transparent' }]} />;
        })}
      </Animated.View>
    </Pressable>
    {/* Input real (oculto) para teclado físico y lectores de pantalla. */}
    <TextInput
      ref={inputRef}
      nativeID="login-pin"
      value={value}
      onChangeText={setPin}
      editable={!disabled}
      autoFocus={autoFocus}
      keyboardType="number-pad"
      secureTextEntry
      maxLength={4}
      autoComplete="off"
      showSoftInputOnFocus={false}
      accessibilityLabel={`${label}, ${value.length} de 4 dígitos`}
      style={{ position: 'absolute', opacity: 0, width: 1, height: 1, ...(Platform.OS === 'web' ? { pointerEvents: 'none' } : {}) }}
    />
    <View style={[s.keypad, { width: size * 3 + 44 }]}>
      {KEYS.map(([key, letters], index) => {
        if (key === null) return <View key={`gap-${index}`} style={[s.key, keySize]} />;
        const back = key === 'back';
        return <Pressable
          key={key}
          accessibilityRole="button"
          accessibilityLabel={back ? 'Borrar último dígito' : key}
          accessibilityState={{ disabled: disabled || (back && !value) }}
          disabled={disabled || (back && !value)}
          onPress={() => press(key)}
          style={({ hovered, pressed }) => [s.key, keySize, {
            backgroundColor: back ? 'transparent' : pressed ? c.gold : hovered ? c.fieldHover : c.field,
            borderWidth: back ? 0 : 1, borderColor: c.hairline,
            opacity: disabled ? 0.5 : 1,
            transform: [{ scale: pressed ? 0.94 : 1 }],
          }]}>
          {({ pressed }) => back
            ? <Delete size={26} color={value ? c.ink : c.faint} />
            : <View style={{ alignItems: 'center' }}>
              <Text style={[s.keyText, compact ? { fontSize: 26, lineHeight: 30 } : null, pressed ? { color: c.onGold } : null]}>{key}</Text>
              {letters ? <Text style={[s.keySub, pressed ? { color: c.onGold } : null]}>{letters}</Text> : null}
            </View>}
        </Pressable>;
      })}
    </View>
  </View>;
}
