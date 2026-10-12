import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { TextField } from '@/components/TextField';
import { Label, Muted } from '@/components/Typography';
import { fontSize, fontWeight, radius, spacing, type Palette } from '@/constants/theme';
import { useThemedStyles } from '@/lib/theme';

// Small building blocks shared by the settings sections.

// A titled box.
export function Card({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.card}>
      <Label>{title}</Label>
      {hint ? <Muted style={styles.small}>{hint}</Muted> : null}
      {children}
    </View>
  );
}

// A small text button inside a row ("Save", "Archive", "Add").
export function SmallButton({
  title,
  onPress,
  disabled = false,
  quiet = false,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  // Less prominent, for actions like Archive.
  quiet?: boolean;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      style={({ pressed }) => [styles.smallButton, (pressed || disabled) && styles.faded]}
    >
      <Text style={[styles.smallButtonText, quiet && styles.quietText]}>{title}</Text>
    </Pressable>
  );
}

// A text box with a Save button that appears once the text differs from
// what's saved. `check` returns a message if the text isn't acceptable.
export function SavedField({
  label,
  saved,
  onSave,
  check,
  placeholder,
  keyboardType,
  hint,
}: {
  label?: string;
  saved: string;
  onSave: (text: string) => void;
  check?: (text: string) => string | null;
  placeholder?: string;
  keyboardType?: 'default' | 'decimal-pad' | 'number-pad' | 'numbers-and-punctuation';
  hint?: string;
}) {
  const styles = useThemedStyles(makeStyles);
  const [text, setText] = useState(saved);
  // When the saved value changes underneath (after a save, or a reload),
  // start again from it.
  const [lastSaved, setLastSaved] = useState(saved);
  if (saved !== lastSaved) {
    setLastSaved(saved);
    setText(saved);
  }

  const changed = text.trim() !== saved.trim();
  const problem = changed && check ? check(text) : null;

  return (
    <View style={styles.field}>
      {label ? <Muted style={styles.fieldLabel}>{label}</Muted> : null}
      <View style={styles.savedRow}>
        <View style={styles.grow}>
          <TextField
            value={text}
            onChangeText={setText}
            placeholder={placeholder}
            keyboardType={keyboardType}
            autoCapitalize="none"
            autoCorrect={false}
            error={problem}
            accessibilityLabel={label}
            onSubmitEditing={() => changed && !problem && onSave(text.trim())}
          />
        </View>
        {changed ? (
          <SmallButton title="Save" disabled={!!problem} onPress={() => onSave(text.trim())} />
        ) : null}
      </View>
      {hint ? <Muted style={styles.small}>{hint}</Muted> : null}
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    card: {
      gap: spacing.md,
      padding: spacing.lg,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    small: {
      fontSize: fontSize.sm,
    },
    field: {
      gap: spacing.xs,
    },
    fieldLabel: {
      fontSize: fontSize.sm,
      color: colors.text,
    },
    savedRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.md,
    },
    grow: {
      flex: 1,
    },
    smallButton: {
      paddingVertical: spacing.md + 2,
      paddingHorizontal: spacing.xs,
    },
    smallButtonText: {
      fontSize: fontSize.md,
      fontWeight: fontWeight.semibold,
      color: colors.text,
    },
    quietText: {
      fontWeight: fontWeight.regular,
      color: colors.textMuted,
    },
    faded: {
      opacity: 0.4,
    },
  });
