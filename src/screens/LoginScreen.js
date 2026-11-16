import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { AlertCircle, ArrowLeft, ArrowRight, Eye, EyeOff, KeyRound, Lock, Mail, ShieldCheck, Smartphone } from 'lucide-react-native';
import { useFonts } from 'expo-font';
import { useAuth } from '../context/AuthContext';
import PwaInstallPrompt from '../components/PwaInstallPrompt';
import Logo from '../components/Logo';
import LoginField from '../components/login/LoginField';
import PinPad from '../components/login/PinPad';
import PinUserPicker from '../components/login/PinUserPicker';
import { loginColors as c, loginStyles as s } from '../components/login/loginStyles';
import { validateLogin, validatePinSetup } from '../utils/loginLogic.mjs';
import { BOTTOM_INSET, TOP_INSET } from '../utils/safeArea';

const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function greetingFor(date) {
  const hour = date.getHours();
  if (hour < 12) return 'Buenos días';
  if (hour < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

function SubmitButton({ onPress, busy, children }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy, busy }} disabled={busy} onPress={onPress}
    style={({ hovered, pressed }) => [s.submit, { backgroundColor: hovered || pressed ? c.goldHover : c.gold, opacity: busy ? 0.75 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
    {busy ? <ActivityIndicator color={c.onGold} size="small" /> : null}
    <Text style={s.submitText}>{busy ? 'Verificando…' : children}</Text>
    {busy ? null : <ArrowRight size={18} color={c.onGold} />}
  </Pressable>;
}

function ErrorNotice({ message }) {
  return message ? <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={s.status}>
    <AlertCircle size={18} color={c.error} />
    <Text style={s.statusText}>{message}</Text>
  </View> : null;
}

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

const two = n => String(n).padStart(2, '0');
const longDate = d => { const t = `${WEEKDAYS[d.getDay()]} ${d.getDate()} de ${MONTHS[d.getMonth()]}`; return t.charAt(0).toUpperCase() + t.slice(1); };

function LinkButton({ icon: Icon, children, onPress, disabled, expanded }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled, expanded }} disabled={disabled} onPress={onPress}
    style={({ hovered }) => [s.link, { backgroundColor: hovered ? c.paper : 'transparent' }]}>
    {Icon ? <Icon size={16} color={c.muted} /> : null}
    <Text style={s.linkText}>{children}</Text>
  </Pressable>;
}

export default function LoginScreen() {
  const { login, loginWithPin, setupPin, knownUsers = [], forgetKnownUser } = useAuth();
  const { width, height } = useWindowDimensions();
  const narrow = width < 380;
  const compactHeight = height < 960 || width < 480;
  const now = useClock();
  const [fontsReady, fontError] = useFonts({
    'Manrope-Regular': require('../../assets/fonts/Manrope-Regular.ttf'),
    'Manrope-Medium': require('../../assets/fonts/Manrope-Medium.ttf'),
  });
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [chosenMode, setChosenMode] = useState(null);
  // Si este equipo ya conoce a alguien, el acceso rápido por PIN es el predeterminado.
  const mode = chosenMode ?? (knownUsers.length ? 'pin' : 'password');
  const [pinUser, setPinUser] = useState(undefined);
  const selectedPinUser = pinUser === undefined ? (knownUsers[0]?.correo ?? null) : pinUser;
  const pinCorreo = selectedPinUser ?? correo;
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [errorKey, setErrorKey] = useState(0);
  const [fieldErrors, setFieldErrors] = useState({});
  const [pinSetup, setPinSetup] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showInstall, setShowInstall] = useState(false);
  const requestBusy = useRef(false);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const pinRef = useRef(null);
  const newPinRef = useRef(null);
  const confirmRef = useRef(null);
  const modeRefs = useRef({});

  function edit(setter, field, value) {
    setter(value);
    setError('');
    setFieldErrors(current => ({ ...current, [field]: undefined }));
  }

  function fail(message) {
    setError(message);
    setErrorKey(key => key + 1);
  }

  function changeMode(next) {
    if (requestBusy.current) return;
    setChosenMode(next);
    setPassword('');
    setPin('');
    setShowPassword(false);
    setError('');
    setFieldErrors({});
  }

  function moveMode(event, currentMode) {
    const key = event.key || event.nativeEvent?.key;
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(key)) return;
    event.preventDefault();
    const next = key === 'Home' ? 'password' : key === 'End' ? 'pin' : currentMode === 'password' ? 'pin' : 'password';
    changeMode(next);
    modeRefs.current[next]?.focus();
  }

  async function handleLogin(pinOverride) {
    if (requestBusy.current) return;
    const pinValue = typeof pinOverride === 'string' ? pinOverride : pin;
    const errors = validateLogin({ mode, correo: mode === 'pin' ? pinCorreo : correo, password, pin: pinValue });
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      if (mode === 'pin' && errors.pin && !errors.correo) setErrorKey(key => key + 1);
      (errors.correo ? emailRef : errors.password ? passwordRef : pinRef).current?.focus();
      return;
    }
    requestBusy.current = true;
    setBusy(true);
    setError('');
    try {
      const result = mode === 'pin' ? await loginWithPin(pinCorreo.trim().toLowerCase(), pinValue) : await login(correo.trim().toLowerCase(), password);
      if (result.requiresPinSetup) {
        setNewPin('');
        setConfirmPin('');
        setPinSetup(true);
        setShowPassword(false);
      } else if (!result.success) {
        fail(result.message || 'No se pudo iniciar sesión. Inténtalo otra vez.');
        if (mode === 'pin') setPin('');
      } else {
        setPassword('');
        setPin('');
      }
    } catch {
      fail('No se pudo conectar. Revisa tu conexión e inténtalo otra vez.');
    } finally {
      requestBusy.current = false;
      setBusy(false);
    }
  }

  async function handleSetupPin() {
    if (requestBusy.current) return;
    const errors = validatePinSetup(newPin, confirmPin);
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      (errors.newPin ? newPinRef : confirmRef).current?.focus();
      return;
    }
    requestBusy.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await setupPin(correo.trim().toLowerCase(), password, newPin);
      if (!result.success) fail(result.message || 'No se pudo guardar el PIN. Inténtalo otra vez.');
      else { setPassword(''); setNewPin(''); setConfirmPin(''); }
    } catch {
      fail('No se pudo conectar. Revisa tu conexión e inténtalo otra vez.');
    } finally {
      requestBusy.current = false;
      setBusy(false);
    }
  }

  function cancelSetup() {
    if (requestBusy.current) return;
    setPinSetup(false);
    setNewPin('');
    setConfirmPin('');
    setPassword('');
    setFieldErrors({});
    setError('');
  }

  if (!fontsReady && !fontError) return <View style={[s.root, { justifyContent: 'center', alignItems: 'center' }]}><ActivityIndicator color={c.gold} accessibilityLabel="Cargando inicio de sesión" /></View>;

  const selectedUser = knownUsers.find(user => user.correo === selectedPinUser);
  const pinMode = mode === 'pin' && !pinSetup;

  const header = <View style={{ alignItems: 'center', gap: compactHeight ? 2 : 6 }}>
    <Logo width={compactHeight ? 132 : 156} dark={c.isDark} />
    <Text accessibilityLabel={`Son las ${two(now.getHours())}:${two(now.getMinutes())}`} style={[s.clock, compactHeight ? { fontSize: 56, lineHeight: 64 } : null]}>{two(now.getHours())}:{two(now.getMinutes())}</Text>
    <Text style={s.clockDate}>{longDate(now)} · {greetingFor(now)}</Text>
  </View>;

  const links = <View style={s.linkRow}>
    {pinSetup ? <LinkButton icon={ArrowLeft} disabled={busy} onPress={cancelSetup}>Volver</LinkButton>
      : pinMode ? <LinkButton icon={Lock} disabled={busy} onPress={() => changeMode('password')}>Entrar con contraseña</LinkButton>
        : knownUsers.length ? <LinkButton icon={KeyRound} disabled={busy} onPress={() => changeMode('pin')}>Usar PIN rápido</LinkButton> : null}
    {Platform.OS === 'web' ? <LinkButton icon={Smartphone} expanded={showInstall} onPress={() => setShowInstall(value => !value)}>
      {showInstall ? 'Ocultar instalación' : 'Instalar en este equipo'}</LinkButton> : null}
  </View>;

  // Acceso rápido: pantalla de bloqueo con avatares y teclado.
  const pinView = <View style={[s.lock, compactHeight ? { gap: 18 } : null]} nativeID="login-fields">
    <View style={{ alignItems: 'center', gap: 6 }}>
      <Text accessibilityRole="header" style={[s.title, { textAlign: 'center' }]}>{selectedUser ? `Hola, ${selectedUser.nombre.split(' ')[0]}` : knownUsers.length ? '¿Quién inicia el turno?' : 'Acceso con PIN'}</Text>
      <Text style={[s.description, { textAlign: 'center' }]}>{selectedUser ? 'Marca tu PIN de 4 dígitos.' : 'Escribe tu correo y marca tu PIN.'}</Text>
    </View>
    {knownUsers.length ? <PinUserPicker users={knownUsers} selected={selectedPinUser} busy={busy} compact={width < 480}
      onSelect={value => { setPinUser(value); setError(''); setFieldErrors({}); setPin(''); }}
      onForget={value => { forgetKnownUser?.(value); setPinUser(undefined); setPin(''); }} /> : null}
    {selectedPinUser === null ? <View style={{ width: '100%', maxWidth: 340 }}>
      <LoginField id="login-pin-email" label="Correo electrónico" icon={Mail} inputRef={emailRef}
        value={correo} onChangeText={value => edit(setCorreo, 'correo', value)} error={fieldErrors.correo}
        placeholder="nombre@correo.com" keyboardType="email-address" autoComplete="username" textContentType="username"
        maxLength={254} editable={!busy} returnKeyType="next" onSubmitEditing={() => pinRef.current?.focus()} />
    </View> : null}
    <PinPad compact={compactHeight} value={pin} inputRef={pinRef} disabled={busy} errorKey={errorKey} autoFocus={Platform.OS === 'web' && selectedPinUser !== null}
      onChange={value => { setPin(value); setError(''); setFieldErrors(current => ({ ...current, pin: undefined })); }}
      onComplete={value => handleLogin(value)} />
    <View style={{ minHeight: 44, width: '100%', maxWidth: 340, justifyContent: 'center', gap: 8 }} accessibilityLiveRegion="polite">
      {busy ? <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8 }}><ActivityIndicator color={c.gold} size="small" /><Text style={s.help}>Verificando…</Text></View> : null}
      {fieldErrors.pin ? <Text style={[s.fieldError, { textAlign: 'center' }]}>{fieldErrors.pin}</Text> : null}
      <ErrorNotice message={error} />
      {!busy && !error && !fieldErrors.pin ? <Text style={[s.help, { textAlign: 'center' }]}>Tras 5 intentos fallidos el PIN se bloquea 15 minutos.</Text> : null}
    </View>
  </View>;

  // Contraseña o creación de PIN: tarjeta centrada.
  const cardView = <View style={[s.formArea, s.formCard, { maxWidth: 420, padding: narrow ? 20 : 32 }]}>
    <View style={s.form}>
      <View style={{ gap: 6 }}>
        <Text accessibilityRole="header" style={s.title}>{pinSetup ? 'Crea tu PIN' : 'Iniciar sesión'}</Text>
        <Text style={s.description}>{pinSetup ? 'Tu contraseña es correcta. Elige 4 dígitos para entrar más rápido en tus próximos turnos.' : 'Entra con el correo y la contraseña de tu cuenta.'}</Text>
      </View>
      <View nativeID="login-fields" style={s.fields}>
        {pinSetup ? <>
          <LoginField id="login-new-pin" label="Nuevo PIN" icon={KeyRound} inputRef={newPinRef}
            value={newPin} onChangeText={value => edit(setNewPin, 'newPin', value.replace(/\D/g, '').slice(0, 4))}
            error={fieldErrors.newPin} placeholder="4 dígitos" secureTextEntry keyboardType="number-pad" autoComplete="off"
            maxLength={4} editable={!busy} autoFocus returnKeyType="next" onSubmitEditing={() => confirmRef.current?.focus()} />
          <LoginField id="login-confirm-pin" label="Confirma tu PIN" icon={KeyRound} inputRef={confirmRef}
            value={confirmPin} onChangeText={value => edit(setConfirmPin, 'confirmPin', value.replace(/\D/g, '').slice(0, 4))}
            error={fieldErrors.confirmPin} placeholder="Repite los 4 dígitos" secureTextEntry keyboardType="number-pad" autoComplete="off"
            maxLength={4} editable={!busy} returnKeyType="go" onSubmitEditing={handleSetupPin} />
          <View style={s.hint}><ShieldCheck size={16} color={c.muted} style={{ marginTop: 2 }} /><Text style={[s.help, { flex: 1 }]}>El PIN es personal. No lo compartas con otros miembros del equipo.</Text></View>
          <ErrorNotice message={error} />
          <SubmitButton busy={busy} onPress={handleSetupPin}>Guardar PIN e ingresar</SubmitButton>
        </> : <>
          <LoginField id="login-email" label="Correo electrónico" icon={Mail} inputRef={emailRef}
            value={correo} onChangeText={value => edit(setCorreo, 'correo', value)} error={fieldErrors.correo}
            placeholder="nombre@correo.com" keyboardType="email-address" autoComplete="username" textContentType="username"
            maxLength={254} editable={!busy} returnKeyType="next" onSubmitEditing={() => passwordRef.current?.focus()} />
          <LoginField id="login-password" label="Contraseña" icon={Lock} inputRef={passwordRef}
            value={password} onChangeText={value => edit(setPassword, 'password', value)} error={fieldErrors.password}
            placeholder="Tu contraseña" autoComplete="current-password" textContentType="password" secureTextEntry={!showPassword}
            maxLength={1024} editable={!busy} returnKeyType="go" onSubmitEditing={() => handleLogin()}
            trailing={<Pressable accessibilityRole="button" accessibilityLabel={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              accessibilityState={{ disabled: busy }} disabled={busy} onPress={() => setShowPassword(value => !value)} style={s.iconButton}>
              {showPassword ? <EyeOff size={19} color={c.muted} /> : <Eye size={19} color={c.muted} />}
            </Pressable>} />
          <ErrorNotice message={error} />
          <SubmitButton busy={busy} onPress={() => handleLogin()}>Ingresar</SubmitButton>
          <Text style={[s.help, { textAlign: 'center' }]}>¿Sin cuenta o sin acceso? Pídelo al administrador del local.</Text>
        </>}
      </View>
    </View>
  </View>;

  return <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View pointerEvents="none" style={s.heroGlow} />
    <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={[s.layout, { gap: compactHeight ? 18 : 28, paddingHorizontal: narrow ? 12 : 24, paddingTop: TOP_INSET + (compactHeight ? 20 : 40), paddingBottom: BOTTOM_INSET + (compactHeight ? 16 : 32) }]}>
      {header}
      {pinMode ? pinView : cardView}
      {links}
      {showInstall ? <PwaInstallPrompt dark compact role="equipo" style={{ width: '100%', maxWidth: 420 }} /> : null}
    </ScrollView>
  </KeyboardAvoidingView>;
}
