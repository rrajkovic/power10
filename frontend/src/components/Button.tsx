import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { fontSize, fontWeight, radius, spacing, type Palette } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/lib/theme';

type ButtonProps = {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
};

export function Button({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
}: ButtonProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const isDisabled = disabled || loading;
  const isPrimary = variant === 'primary';

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        isPrimary ? styles.primary : styles.secondary,
        pressed && styles.pressed,
        isDisabled && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? colors.onPrimary : colors.text} />
      ) : (
        <Text style={[styles.text, isPrimary ? styles.textPrimary : styles.textSecondary]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

// A plain text link-style button, for secondary actions like "Resend code".
export function TextButton({ title, onPress, disabled = false }: Omit<ButtonProps, 'loading' | 'variant'>) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      style={({ pressed }) => [pressed && styles.pressed, disabled && styles.disabled]}
    >
      <Text style={styles.textLink}>{title}</Text>
    </Pressable>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    textLink: {
      fontSize: fontSize.md,
      fontWeight: fontWeight.semibold,
      color: colors.primary,
    },
    base: {
      borderRadius: radius.md,
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.xl,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 52,
    },
    primary: {
      backgroundColor: colors.primary,
    },
    secondary: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    pressed: {
      opacity: 0.85,
    },
    disabled: {
      opacity: 0.5,
    },
    text: {
      fontSize: fontSize.md,
      fontWeight: fontWeight.semibold,
    },
    textPrimary: {
      color: colors.onPrimary,
    },
    textSecondary: {
      color: colors.text,
    },
  });
