import { StyleSheet, Text, type TextProps } from 'react-native';
import { fontSize, fontWeight, monoFont, spacing, type Palette } from '@/constants/theme';
import { useThemedStyles } from '@/lib/theme';

export function Title({ style, ...props }: TextProps) {
  const styles = useThemedStyles(makeStyles);
  return <Text style={[styles.title, style]} {...props} />;
}

// Big, bold, Equinox-style headline ("Who's putting in the work?").
export function Headline({ style, ...props }: TextProps) {
  const styles = useThemedStyles(makeStyles);
  return <Text style={[styles.headline, style]} {...props} />;
}

// Small uppercase monospace label ("YOUR WEEK", "LEADERBOARD").
export function Label({ style, ...props }: TextProps) {
  const styles = useThemedStyles(makeStyles);
  return <Text style={[styles.label, style]} {...props} />;
}

export function Body({ style, ...props }: TextProps) {
  const styles = useThemedStyles(makeStyles);
  return <Text style={[styles.body, style]} {...props} />;
}

export function Muted({ style, ...props }: TextProps) {
  const styles = useThemedStyles(makeStyles);
  return <Text style={[styles.muted, style]} {...props} />;
}

export function ErrorText({ style, ...props }: TextProps) {
  const styles = useThemedStyles(makeStyles);
  return <Text style={[styles.error, style]} {...props} />;
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    title: {
      fontSize: fontSize.xl,
      fontWeight: fontWeight.bold,
      color: colors.text,
      marginBottom: spacing.sm,
    },
    headline: {
      fontSize: fontSize.xxl,
      lineHeight: fontSize.xxl * 1.15,
      fontWeight: fontWeight.heavy,
      letterSpacing: -0.5,
      color: colors.text,
    },
    label: {
      fontFamily: monoFont,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.semibold,
      letterSpacing: 1.5,
      textTransform: 'uppercase',
      color: colors.textMuted,
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
