import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { AlertCircle, ArrowRight, Eye, EyeOff, Lock, Mail, ShieldCheck, Store, Users } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import Logo from '../components/Logo';
import PwaInstallPrompt from '../components/PwaInstallPrompt';
import { BOTTOM_INSET, TOP_INSET } from '../utils/safeArea';

const LOGIN_COLORS = {
  page: '#EEF3F8',
  panel: '#FFFFFF',
  ink: '#0F172A',
  muted: '#64748B',
  line: '#D8E1EE',
  field: '#F8FAFC',
  primary: '#2563EB',
  primaryDark: '#1D4ED8',
  dark: '#0B1220',
  darkSoft: '#111C31',
  success: '#059669',
  successSoft: '#D1FAE5',
};

export default function LoginScreen() {
  const { login, loginWithPin, setupPin } = useAuth();
  const { width, height } = useWindowDimensions();
  const isWide = width >= 940;
  const isTablet = width >= 680;
  const isShort = height < 720;
  const compactLogin = !isWide;
  const showModuleCards = isWide || (isTablet && !isShort);

  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [loginMode, setLoginMode] = useState('password');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [setupLoading, setSetupLoading] = useState(false);
  const [error, setError] = useState('');
  const [pinSetupVisible, setPinSetupVisible] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  const handleLogin = async () => {
    const usePin = loginMode === 'pin';
    if (usePin ? !pin.trim() : (!correo.trim() || !password.trim())) {
      setError(usePin ? 'Completa tu PIN.' : 'Completa correo y contrasena.');
      return;
    }
    if (usePin && !/^\d{4}$/.test(pin.trim())) {
      setError('El PIN debe tener 4 digitos.');
      return;
    }
    setError('');
    setLoading(true);
    const result = usePin
      ? await loginWithPin(pin.trim())
      : await login(correo.trim(), password);
    setLoading(false);
    if (result.requiresPinSetup) {
      setNewPin('');
      setConfirmPin('');
      setPinSetupVisible(true);
      return;
    }
    if (!result.success) setError(result.message);
  };

  const handleSetupPin = async () => {
    if (!/^\d{4}$/.test(newPin)) {
      setError('El PIN nuevo debe tener 4 digitos.');
      return;
    }
    if (newPin !== confirmPin) {
      setError('Los PIN no coinciden.');
      return;
    }
    setError('');
    setSetupLoading(true);
    const result = await setupPin(correo.trim(), password, newPin);
    setSetupLoading(false);
    if (!result.success) {
      setError(result.message);
      return;
    }
    setPinSetupVisible(false);
  };

  const shellShadow = Platform.select({
    web: { boxShadow: '0 22px 60px rgba(15, 23, 42, 0.14)' },
    default: { elevation: 6 },
  });

  const softShadow = Platform.select({
    web: { boxShadow: '0 12px 28px rgba(15, 23, 42, 0.08)' },
    default: { elevation: 3 },
  });

  const modules = [
    [Store, 'Salon', 'Pedidos y mesas'],
    [ShieldCheck, 'Caja', 'Cobros seguros'],
    [Users, 'Roles', 'Accesos por equipo'],
  ];

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: LOGIN_COLORS.page }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: TOP_INSET + 18,
          paddingBottom: BOTTOM_INSET + 18,
          paddingHorizontal: isWide ? 28 : isTablet ? 18 : 10,
          justifyContent: 'center',
        }}
      >
        <View style={{ width: '100%', maxWidth: 1180, alignSelf: 'center' }}>
          <View style={{ flexDirection: isWide ? 'row' : 'column', gap: compactLogin ? 10 : 16, minHeight: isWide ? 650 : undefined }}>
            <View
              style={{
                flex: isWide ? 1.05 : undefined,
                minHeight: isWide ? undefined : isShort ? undefined : 190,
                borderRadius: 8,
                padding: isWide ? 34 : isTablet ? 22 : 16,
                backgroundColor: LOGIN_COLORS.dark,
                borderWidth: 1,
                borderColor: '#17233A',
                justifyContent: isWide ? 'space-between' : 'center',
                overflow: 'hidden',
                ...shellShadow,
              }}
            >
              <View style={{ position: 'absolute', right: -120, top: -90, width: 300, height: 300, borderRadius: 150, backgroundColor: 'rgba(37, 99, 235, 0.20)' }} />
              <View style={{ position: 'absolute', left: -90, bottom: -120, width: 260, height: 260, borderRadius: 130, backgroundColor: 'rgba(14, 165, 233, 0.14)' }} />

              <View>
                <View style={{ alignItems: isWide ? 'flex-start' : 'center' }}>
                  <Logo height={isWide ? 62 : isShort ? 42 : 48} dark />
                </View>
                <View style={{ marginTop: isWide ? 48 : isShort ? 12 : 18, maxWidth: 520, alignSelf: isWide ? 'auto' : 'center' }}>
                  {isWide ? (
                    <View style={{ alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: 'rgba(37, 99, 235, 0.18)', borderWidth: 1, borderColor: 'rgba(96, 165, 250, 0.35)' }}>
                      <Text style={{ color: '#BFDBFE', fontSize: 12, fontWeight: '900' }}>SISTEMA POS</Text>
                    </View>
                  ) : null}
                  <Text style={{ color: '#F8FAFC', fontSize: isWide ? 42 : isTablet ? 27 : 22, lineHeight: isWide ? 48 : isTablet ? 32 : 27, fontWeight: '900', marginTop: isWide ? 18 : 0, textAlign: isWide ? 'left' : 'center' }}>
                    Gestion interna Morena Mia
                  </Text>
                  {!isShort ? (
                    <Text style={{ color: '#CBD5E1', fontSize: isTablet ? 14 : 12, lineHeight: isTablet ? 21 : 18, fontWeight: '700', marginTop: 8, textAlign: isWide ? 'left' : 'center' }}>
                      Acceso seguro para operar salon, cocina y caja durante el turno.
                    </Text>
                  ) : null}
                </View>
              </View>

              {showModuleCards ? (
                <View style={{ flexDirection: isWide ? 'row' : 'row', flexWrap: 'wrap', gap: 10, marginTop: isWide ? 24 : 16 }}>
                  {modules.map(([Icon, title, subtitle]) => (
                    <View key={title} style={{ flex: 1, minWidth: isWide ? 0 : 150, borderRadius: 8, padding: isWide ? 14 : 12, backgroundColor: LOGIN_COLORS.darkSoft, borderWidth: 1, borderColor: '#24324D' }}>
                      <View style={{ width: 34, height: 34, borderRadius: 8, backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon size={18} color={LOGIN_COLORS.primary} />
                      </View>
                      <Text style={{ color: '#FFFFFF', fontWeight: '900', marginTop: 9 }}>{title}</Text>
                      <Text style={{ color: '#94A3B8', fontSize: 12, fontWeight: '700', marginTop: 3 }}>{subtitle}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>

            <View
              style={{
                width: isWide ? 440 : '100%',
                borderRadius: 8,
                backgroundColor: LOGIN_COLORS.panel,
                borderWidth: 1,
                borderColor: LOGIN_COLORS.line,
                padding: isWide ? 32 : isTablet ? 22 : 14,
                justifyContent: 'center',
                ...softShadow,
              }}
            >
              {!isWide && !isShort ? (
                <View style={{ alignItems: 'center', marginBottom: 22 }}>
                  <Logo size="lg" />
                </View>
              ) : null}

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: LOGIN_COLORS.ink, fontSize: isTablet ? 28 : 23, fontWeight: '900' }}>Iniciar sesion</Text>
                  <Text style={{ color: LOGIN_COLORS.muted, marginTop: 7, fontSize: 13, lineHeight: 19, fontWeight: '700' }}>
                    Entra con tu usuario asignado.
                  </Text>
                </View>
                <View style={{ borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: LOGIN_COLORS.successSoft }}>
                  <Text style={{ color: LOGIN_COLORS.success, fontSize: 11, fontWeight: '900' }}>EN LINEA</Text>
                </View>
              </View>

              <PwaInstallPrompt role="equipo" compact style={{ marginTop: isShort ? 12 : 18, boxShadow: 'none' }} />

              <View style={{ flexDirection: 'row', gap: 8, marginTop: isShort ? 12 : 18 }}>
                {[
                  ['password', 'Contrasena'],
                  ['pin', 'PIN rapido'],
                ].map(([mode, label]) => {
                  const active = loginMode === mode;
                  return (
                    <TouchableOpacity
                      key={mode}
                      onPress={() => {
                        setLoginMode(mode);
                        setError('');
                      }}
                      style={{
                        flex: 1,
                        height: 42,
                        borderRadius: 8,
                        backgroundColor: active ? LOGIN_COLORS.primary : LOGIN_COLORS.field,
                        borderWidth: 1,
                        borderColor: active ? LOGIN_COLORS.primary : LOGIN_COLORS.line,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ color: active ? '#FFFFFF' : LOGIN_COLORS.muted, fontWeight: '900' }}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {error ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF1F2', borderWidth: 1, borderColor: '#FECDD3', borderRadius: 8, padding: 12, marginTop: 18 }}>
                  <AlertCircle size={18} color="#E11D48" />
                  <Text style={{ color: '#BE123C', marginLeft: 10, flex: 1, fontWeight: '800' }}>{error}</Text>
                </View>
              ) : null}

              {loginMode === 'password' ? (
                <View style={{ marginTop: isShort ? 14 : 22 }}>
                  <Text style={{ color: LOGIN_COLORS.ink, fontWeight: '900', marginBottom: 8 }}>Correo</Text>
                  <View style={{ height: 52, borderRadius: 8, borderWidth: 1, borderColor: LOGIN_COLORS.line, backgroundColor: LOGIN_COLORS.field, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center' }}>
                    <Mail size={18} color={LOGIN_COLORS.muted} />
                    <TextInput
                      value={correo}
                      onChangeText={setCorreo}
                      placeholder="usuario@morenamia.com"
                      placeholderTextColor="#94A3B8"
                      autoCapitalize="none"
                      keyboardType="email-address"
                      style={{ flex: 1, marginLeft: 12, color: LOGIN_COLORS.ink, fontWeight: '800' }}
                    />
                  </View>
                </View>
              ) : null}

              {loginMode === 'password' ? (
                <View style={{ marginTop: 14 }}>
                  <Text style={{ color: LOGIN_COLORS.ink, fontWeight: '900', marginBottom: 8 }}>Contrasena</Text>
                  <View style={{ height: 52, borderRadius: 8, borderWidth: 1, borderColor: LOGIN_COLORS.line, backgroundColor: LOGIN_COLORS.field, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center' }}>
                    <Lock size={18} color={LOGIN_COLORS.muted} />
                    <TextInput
                      value={password}
                      onChangeText={setPassword}
                      placeholder="********"
                      placeholderTextColor="#94A3B8"
                      secureTextEntry={!showPwd}
                      style={{ flex: 1, marginLeft: 12, color: LOGIN_COLORS.ink, fontWeight: '800' }}
                    />
                    <TouchableOpacity onPress={() => setShowPwd((value) => !value)} style={{ padding: 6 }}>
                      {showPwd ? <EyeOff size={18} color={LOGIN_COLORS.muted} /> : <Eye size={18} color={LOGIN_COLORS.muted} />}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={{ marginTop: isShort ? 14 : 22 }}>
                  <Text style={{ color: LOGIN_COLORS.ink, fontWeight: '900', marginBottom: 8 }}>PIN rapido</Text>
                  <View style={{ height: 52, borderRadius: 8, borderWidth: 1, borderColor: LOGIN_COLORS.line, backgroundColor: LOGIN_COLORS.field, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center' }}>
                    <ShieldCheck size={18} color={LOGIN_COLORS.muted} />
                    <TextInput
                      value={pin}
                      onChangeText={(value) => setPin(value.replace(/\D/g, '').slice(0, 4))}
                      placeholder="0000"
                      placeholderTextColor="#94A3B8"
                      keyboardType="number-pad"
                      secureTextEntry
                      maxLength={4}
                      style={{ flex: 1, marginLeft: 12, color: LOGIN_COLORS.ink, fontWeight: '900', letterSpacing: 8 }}
                    />
                  </View>
                  <Text style={{ color: LOGIN_COLORS.muted, fontSize: 12, fontWeight: '700', marginTop: 8 }}>
                    El PIN identifica al usuario. Usa un PIN unico y no lo compartas.
                  </Text>
                </View>
              )}

              <TouchableOpacity
                onPress={handleLogin}
                disabled={loading}
                style={{
                  height: 54,
                  borderRadius: 8,
                  backgroundColor: loading ? '#93C5FD' : LOGIN_COLORS.primary,
                  marginTop: isShort ? 16 : 22,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row',
                }}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={{ color: '#fff', fontSize: 15, fontWeight: '900' }}>{loginMode === 'pin' ? 'Entrar con PIN' : 'Entrar al sistema'}</Text>
                    <ArrowRight size={18} color="#fff" style={{ marginLeft: 10 }} />
                  </>
                )}
              </TouchableOpacity>

              <View style={{ marginTop: isShort ? 12 : 18, borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: isShort ? 12 : 16 }}>
                <Text style={{ color: LOGIN_COLORS.muted, fontSize: 12, fontWeight: '900' }}>Modulos disponibles</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                  {['Admin', 'Supervisor', 'Mesero', 'Cocina', 'Caja'].map((role) => (
                    <View key={role} style={{ borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE' }}>
                      <Text style={{ color: LOGIN_COLORS.primaryDark, fontSize: 12, fontWeight: '900' }}>{role}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
      <Modal visible={pinSetupVisible} transparent animationType="fade" onRequestClose={() => {}}>
        <View style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', padding: 18, justifyContent: 'center' }}>
          <View style={{ width: '100%', maxWidth: 420, alignSelf: 'center', borderRadius: 8, backgroundColor: LOGIN_COLORS.panel, borderWidth: 1, borderColor: LOGIN_COLORS.line, padding: 20, ...softShadow }}>
            <View style={{ width: 46, height: 46, borderRadius: 8, backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldCheck size={23} color={LOGIN_COLORS.primary} />
            </View>
            <Text style={{ color: LOGIN_COLORS.ink, fontSize: 22, fontWeight: '900', marginTop: 14 }}>Crea tu PIN rapido</Text>
            <Text style={{ color: LOGIN_COLORS.muted, fontSize: 13, lineHeight: 19, fontWeight: '700', marginTop: 8 }}>
              Este PIN sera personal y unico para entrar sin correo durante el turno.
            </Text>
            {error ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF1F2', borderWidth: 1, borderColor: '#FECDD3', borderRadius: 8, padding: 10, marginTop: 14 }}>
                <AlertCircle size={17} color="#E11D48" />
                <Text style={{ color: '#BE123C', marginLeft: 9, flex: 1, fontWeight: '800' }}>{error}</Text>
              </View>
            ) : null}
            <View style={{ marginTop: 16 }}>
              <Text style={{ color: LOGIN_COLORS.ink, fontWeight: '900', marginBottom: 8 }}>PIN de 4 digitos</Text>
              <TextInput
                value={newPin}
                onChangeText={(value) => setNewPin(value.replace(/\D/g, '').slice(0, 4))}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={4}
                placeholder="0000"
                placeholderTextColor="#94A3B8"
                style={{ height: 52, borderRadius: 8, borderWidth: 1, borderColor: LOGIN_COLORS.line, backgroundColor: LOGIN_COLORS.field, paddingHorizontal: 14, color: LOGIN_COLORS.ink, fontWeight: '900', letterSpacing: 8 }}
              />
            </View>
            <View style={{ marginTop: 12 }}>
              <Text style={{ color: LOGIN_COLORS.ink, fontWeight: '900', marginBottom: 8 }}>Confirmar PIN</Text>
              <TextInput
                value={confirmPin}
                onChangeText={(value) => setConfirmPin(value.replace(/\D/g, '').slice(0, 4))}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={4}
                placeholder="0000"
                placeholderTextColor="#94A3B8"
                style={{ height: 52, borderRadius: 8, borderWidth: 1, borderColor: LOGIN_COLORS.line, backgroundColor: LOGIN_COLORS.field, paddingHorizontal: 14, color: LOGIN_COLORS.ink, fontWeight: '900', letterSpacing: 8 }}
              />
            </View>
            <TouchableOpacity
              onPress={handleSetupPin}
              disabled={setupLoading}
              style={{ height: 52, borderRadius: 8, backgroundColor: setupLoading ? '#93C5FD' : LOGIN_COLORS.primary, alignItems: 'center', justifyContent: 'center', marginTop: 18 }}
            >
              {setupLoading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontSize: 15, fontWeight: '900' }}>Guardar PIN y entrar</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}
