import { StyleSheet, Text, View } from 'react-native';
import { fontSize, spacing, type Palette } from '@/constants/theme';
import { useThemedStyles } from '@/lib/theme';

// A horizontal line, optionally with a word in the middle ("or").
export function Divider({ label }: { label?: string }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.row}>
      <View style={styles.line} />
      {label ? <Text style={styles.label}>{label}</Text> : null}
      {label ? <View style={styles.line} /> : null}
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginVertical: spacing.sm,
    },
    line: {
      flex: 1,
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
    },
    label: {
      fontSize: fontSize.sm,
      color: colors.textMuted,
    },
  });
