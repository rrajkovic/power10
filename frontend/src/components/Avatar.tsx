import { StyleSheet, Text, View } from 'react-native';
import { fontWeight } from '@/constants/theme';
import { withAlpha } from '@/lib/color';
import { useTheme } from '@/lib/theme';

export function initials(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

// A round avatar with initials, tinted with the team color. (Photos later.)
export function Avatar({
  name,
  color,
  size = 36,
}: {
  name: string | null | undefined;
  color: string;
  size?: number;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: withAlpha(color, 0.22) },
      ]}
    >
      <Text style={[styles.text, { fontSize: size * 0.38, color: colors.text }]}>{initials(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: fontWeight.bold,
  },
});
