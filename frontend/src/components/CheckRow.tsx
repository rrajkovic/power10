import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fontSize, fontWeight, spacing, type Palette } from '@/constants/theme';
import { readableOn } from '@/lib/color';
import { useThemedStyles } from '@/lib/theme';

// One line in a checklist of people, with a checkbox.
export function CheckRow({
  name,
  selected,
  accent,
  onPress,
  bold = false,
}: {
  name: string;
  selected: boolean;
  accent: string;
  onPress: () => void;
  bold?: boolean;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={name}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={[styles.checkbox, selected && { backgroundColor: accent, borderColor: accent }]}>
        {selected ? <Text style={[styles.check, { color: readableOn(accent) }]}>✓</Text> : null}
      </View>
      <Text style={[styles.name, bold && styles.nameBold]} numberOfLines={1}>
        {name}
      </Text>
    </Pressable>
  );
}

// The rounded box a list of CheckRows sits in.
export function CheckList({ children }: { children: React.ReactNode }) {
  const styles = useThemedStyles(makeStyles);
  return <View style={styles.list}>{children}</View>;
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    list: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingVertical: spacing.xs,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.lg,
    },
    pressed: {
      opacity: 0.3,
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 1.5,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    check: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
    },
    name: {
      flex: 1,
      fontSize: fontSize.md,
      color: colors.text,
    },
    nameBold: {
      fontWeight: fontWeight.semibold,
    },
  });
