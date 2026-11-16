import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Plus, X } from 'lucide-react-native';
import { initials } from '../../utils/knownUsers.mjs';
import { loginColors as c, loginStyles as s } from './loginStyles';

const ROLE_LABEL = { admin: 'Administración', mesero: 'Mesero', cocina: 'Cocina', caja: 'Caja', supervisor: 'Supervisor' };

// Personas que ya entraron en este equipo, como en la pantalla de bloqueo de un TPV.
// El PIN siempre se valida contra la persona elegida.
export default function PinUserPicker({ users, selected, onSelect, onForget, busy, compact = false }) {
  const tileSize = compact ? { width: 78, paddingVertical: 8 } : null;
  const avatarSize = compact ? { width: 52, height: 52, borderRadius: 26 } : null;
  return <View accessibilityRole="radiogroup" accessibilityLabel="¿Quién inicia el turno?" style={[s.tiles, compact ? { gap: 6 } : null]}>
    {users.map(user => {
      const active = selected === user.correo;
      return <View key={user.correo}>
        <Pressable accessibilityRole="radio" accessibilityState={{ checked: active, disabled: busy }}
          accessibilityLabel={`${user.nombre}${ROLE_LABEL[user.rol] ? `, ${ROLE_LABEL[user.rol]}` : ''}`}
          disabled={busy} onPress={() => onSelect(user.correo)}
          style={({ hovered }) => [s.tile, tileSize, { backgroundColor: active ? c.goldSoft : hovered ? c.paper : 'transparent' }]}>
          <View style={[s.tileAvatar, avatarSize, { backgroundColor: active ? c.gold : c.field, borderColor: active ? c.goldHover : c.hairline }]}>
            <Text style={[s.tileInitials, { color: active ? c.onGold : c.ink }]}>{initials(user.nombre)}</Text>
          </View>
          <View>
            <Text numberOfLines={1} style={[s.tileName, { color: active ? c.ink : c.muted, maxWidth: 96 }]}>{user.nombre.split(' ')[0]}</Text>
            {ROLE_LABEL[user.rol] ? <Text style={s.tileRole}>{ROLE_LABEL[user.rol]}</Text> : null}
          </View>
        </Pressable>
        {active ? <Pressable accessibilityRole="button" accessibilityLabel={`Quitar a ${user.nombre} de este equipo`} disabled={busy}
          onPress={() => onForget(user.correo)}
          style={({ hovered }) => ({ position: 'absolute', top: 4, right: compact ? 4 : 10, width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center',
            backgroundColor: hovered ? c.fieldHover : c.paper, borderWidth: 1, borderColor: c.hairline })}>
          <X size={13} color={c.muted} />
        </Pressable> : null}
      </View>;
    })}
    <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected === null, disabled: busy }} accessibilityLabel="Otro usuario"
      disabled={busy} onPress={() => onSelect(null)}
      style={({ hovered }) => [s.tile, tileSize, { backgroundColor: selected === null ? c.goldSoft : hovered ? c.paper : 'transparent' }]}>
      <View style={[s.tileAvatar, avatarSize, { borderStyle: 'dashed', borderColor: selected === null ? c.gold : c.line, backgroundColor: 'transparent' }]}>
        <Plus size={24} color={c.muted} />
      </View>
      <Text style={[s.tileName, { color: c.muted }]}>Otro</Text>
    </Pressable>
  </View>;
}
