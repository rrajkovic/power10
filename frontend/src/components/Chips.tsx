import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fontSize, fontWeight, spacing, type Palette } from '@/constants/theme';
import { readableOn } from '@/lib/color';
import { useThemedStyles } from '@/lib/theme';

type ChipsProps<T extends string> = {
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (value: T | null) => void;
  // The selected chip's color (the team color).
  accent: string;
  // Tapping the selected chip again clears the choice.
  allowNone?: boolean;
};

// A row of rounded buttons where one is selected ("Erg  Row  Run  Lift").
export function Chips<T extends string>({
  options,
  value,
  onChange,
  accent,
  allowNone = false,
}: ChipsProps<T>) {
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={styles.row}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(selected && allowNone ? null : option.value)}
            style={({ pressed }) => [
              styles.chip,
              selected && { backgroundColor: accent, borderColor: accent },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.text, selected && { color: readableOn(accent) }]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    chip: {
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.lg,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    pressed: {
      opacity: 0.7,
    },
    text: {
      fontSize: fontSize.md,
      fontWeight: fontWeight.semibold,
      color: colors.text,
    },
  });
