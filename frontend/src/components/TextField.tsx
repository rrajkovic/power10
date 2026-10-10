import { useState } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { fontSize, fontWeight, radius, spacing, type Palette } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/lib/theme';

type TextFieldProps = TextInputProps & {
  label?: string;
  error?: string | null;
};

export function TextField({ label, error, style, onFocus, onBlur, ...props }: TextFieldProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.textMuted}
        {...props}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={[
          styles.input,
          focused ? styles.inputFocused : null,
          error ? styles.inputError : null,
          style,
        ]}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    wrapper: {
      gap: spacing.xs,
    },
    label: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.medium,
      color: colors.text,
    },
    input: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingVertical: spacing.md + 2,
      paddingHorizontal: spacing.lg,
      fontSize: fontSize.md,
      color: colors.text,
    },
    inputFocused: {
      borderColor: colors.primary,
    },
    inputError: {
      borderColor: colors.danger,
    },
    error: {
      fontSize: fontSize.sm,
      color: colors.danger,
    },
  });
