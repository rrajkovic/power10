import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { fontSize, fontWeight, monoFont, radius, spacing, type Palette } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/lib/theme';

export type MenuOption<T extends string> = { value: T; label: string };

type OptionMenuProps<T extends string> = {
  options: MenuOption<T>[];
  value: T;
  onChange: (value: T) => void;
  // "pill" for the team switcher; "label" for small uppercase menus.
  appearance?: 'pill' | 'label';
  accessibilityLabel?: string;
};

// A button showing the current choice ("Week ▾"). Tapping it opens a list.
export function OptionMenu<T extends string>({
  options,
  value,
  onChange,
  appearance = 'label',
  accessibilityLabel,
}: OptionMenuProps<T>) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [open, setOpen] = useState(false);
  const current = options.find((option) => option.value === value);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={() => setOpen(true)}
        hitSlop={8}
        style={({ pressed }) => [
          appearance === 'pill' ? styles.pill : styles.labelButton,
          pressed && { opacity: 0.7 },
        ]}
      >
        <Text style={appearance === 'pill' ? styles.pillText : styles.labelText}>
          {current?.label ?? ''} ▾
        </Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.sheet}>
            {options.map((option) => {
              const selected = option.value === value;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="menuitem"
                  accessibilityState={{ selected }}
                  onPress={() => {
                    setOpen(false);
                    if (!selected) onChange(option.value);
                  }}
                  style={({ pressed }) => [styles.item, pressed && { backgroundColor: colors.track }]}
                >
                  <Text style={[styles.itemText, selected && styles.itemSelected]}>{option.label}</Text>
                  {selected ? <Text style={styles.itemSelected}>✓</Text> : null}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    pill: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    pillText: {
      fontSize: fontSize.md,
      fontWeight: fontWeight.semibold,
      color: colors.text,
    },
    labelButton: {
      paddingVertical: spacing.xs,
    },
    labelText: {
      fontFamily: monoFont,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.semibold,
      letterSpacing: 1.5,
      textTransform: 'uppercase',
      color: colors.text,
    },
    backdrop: {
      flex: 1,
      justifyContent: 'center',
      padding: spacing.xl,
      backgroundColor: 'rgba(0, 0, 0, 0.45)',
    },
    sheet: {
      width: '100%',
      maxWidth: 360,
      alignSelf: 'center',
      borderRadius: radius.lg,
      backgroundColor: colors.surfaceRaised,
      paddingVertical: spacing.sm,
      overflow: 'hidden',
    },
    item: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: spacing.md + 2,
      paddingHorizontal: spacing.xl,
    },
    itemText: {
      fontSize: fontSize.md,
      color: colors.text,
    },
    itemSelected: {
      fontSize: fontSize.md,
      fontWeight: fontWeight.semibold,
      color: colors.text,
    },
  });
