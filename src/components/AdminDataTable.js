import React from 'react';
import { useWindowDimensions } from 'react-native';
import { Text, View } from './AdminPrimitives';
import { softShadow, useTheme } from '../theme';

const alignment = {
  left: 'flex-start',
  center: 'center',
  right: 'flex-end',
};

function columnStyle(column) {
  return {
    width: column.width,
    minWidth: column.minWidth,
    flex: column.flex,
    alignItems: alignment[column.align || 'left'],
    paddingHorizontal: 8,
  };
}

export function AdminStatusPill({ label, tone = 'neutral' }) {
  const { c } = useTheme();
  const tones = {
    success: [c.greenSoft, c.green],
    warning: [c.amberSoft, c.amber],
    danger: [c.redSoft, c.red],
    info: [c.skySoft, c.sky],
    primary: [c.primarySoft, c.primaryText],
    neutral: [c.soft, c.muted],
  };
  const [backgroundColor, color] = tones[tone] || tones.neutral;

  return (
    <View
      adminClassName="flex-row items-center rounded-full px-3 py-1"
      style={{ backgroundColor, alignSelf: 'flex-start' }}
    >
      <View adminClassName="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: color }} />
      <Text adminClassName="text-xs font-bold" style={{ color }}>{label}</Text>
    </View>
  );
}

export default function AdminDataTable({
  title,
  subtitle,
  icon: Icon,
  badge,
  columns,
  rows,
  rowKey = (row) => row.id,
  renderCell,
  renderMobileRow,
  emptyText = 'No hay registros para mostrar.',
  minWidth = 760,
}) {
  const { width } = useWindowDimensions();
  const { c } = useTheme();
  const compact = width < 780;

  return (
    <View
      adminClassName="rounded-lg overflow-hidden"
      style={{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, ...softShadow(c) }}
    >
      <View
        adminClassName="flex-row items-center px-5 py-4"
        style={{ borderBottomWidth: 1, borderBottomColor: c.line }}
      >
        {Icon ? (
          <View adminClassName="w-10 h-10 rounded-lg items-center justify-center mr-3" style={{ backgroundColor: c.primarySoft }}>
            <Icon size={19} color={c.primaryText} />
          </View>
        ) : null}
        <View adminClassName="flex-1">
          <Text adminClassName="text-base font-extrabold" style={{ color: c.text }}>{title}</Text>
          {subtitle ? <Text adminClassName="text-xs mt-1" style={{ color: c.faint }}>{subtitle}</Text> : null}
        </View>
        {badge}
      </View>

      {!rows.length ? (
        <View adminClassName="items-center px-5 py-10">
          <Text adminClassName="text-sm font-semibold text-center" style={{ color: c.faint }}>{emptyText}</Text>
        </View>
      ) : compact ? (
        <View adminClassName="px-4 py-2">
          {rows.map((row, index) => (
            <View
              key={rowKey(row)}
              adminClassName="py-4"
              style={{ borderBottomWidth: index === rows.length - 1 ? 0 : 1, borderBottomColor: c.line }}
            >
              {renderMobileRow(row, index)}
            </View>
          ))}
        </View>
      ) : (
        <View style={{ minWidth, width: '100%' }}>
          <View adminClassName="flex-row items-center px-4 py-3" style={{ backgroundColor: c.surfaceAlt }}>
            {columns.map((column) => (
              <View key={column.key} style={columnStyle(column)}>
                <Text
                  adminClassName="text-xs font-bold"
                  style={{ color: c.faint, letterSpacing: 0.55, textAlign: column.align || 'left' }}
                >
                  {column.label.toUpperCase()}
                </Text>
              </View>
            ))}
          </View>
          {rows.map((row, rowIndex) => (
            <View
              key={rowKey(row)}
              adminClassName="flex-row items-center px-4 py-4"
              style={{ borderTopWidth: rowIndex ? 1 : 0, borderTopColor: c.line }}
            >
              {columns.map((column) => (
                <View key={column.key} style={columnStyle(column)}>
                  {renderCell(row, column.key, rowIndex)}
                </View>
              ))}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
