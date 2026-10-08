import { StyleSheet, Text, type TextProps } from 'react-native';
import { colors, fontSize, fontWeight, spacing } from '@/constants/theme';

export function Title({ style, ...props }: TextProps) {
  return <Text style={[styles.title, style]} {...props} />;
}

export function Body({ style, ...props }: TextProps) {
  return <Text style={[styles.body, style]} {...props} />;
}

export function Muted({ style, ...props }: TextProps) {
  return <Text style={[styles.muted, style]} {...props} />;
}

export function ErrorText({ style, ...props }: TextProps) {
  return <Text style={[styles.error, style]} {...props} />;
}

const styles = StyleSheet.create({
  title: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  body: {
    fontSize: fontSize.md,
    color: colors.text,
  },
  muted: {
    fontSize: fontSize.md,
    color: colors.textMuted,
  },
  error: {
    fontSize: fontSize.sm,
    color: colors.danger,
  },
});
