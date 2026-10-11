import { router } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';
import { fontSize, fontWeight, radius, spacing, type Palette } from '@/constants/theme';
import { useMyFlaggedSessions } from '@/lib/review';
import { useThemedStyles } from '@/lib/theme';

// On Home: appears only when one of YOUR workouts was flagged and is waiting
// for your answer. Opens the review screen.
export function FlaggedNotice({ teamId }: { teamId: string }) {
  const styles = useThemedStyles(makeStyles);
  const flagged = useMyFlaggedSessions(teamId);
  const count = flagged.data?.length ?? 0;
  if (count === 0) return null;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push('/review')}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <Text style={styles.text}>
        {count === 1 ? '1 workout needs a quick check' : `${count} workouts need a quick check`}
      </Text>
      <Text style={styles.action}>Review ›</Text>
    </Pressable>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
      marginHorizontal: spacing.xl,
      padding: spacing.lg,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.caution,
      backgroundColor: colors.surface,
    },
    pressed: {
      opacity: 0.7,
    },
    text: {
      flex: 1,
      fontSize: fontSize.md,
      fontWeight: fontWeight.semibold,
      color: colors.text,
    },
    action: {
      fontSize: fontSize.md,
      fontWeight: fontWeight.semibold,
      color: colors.caution,
    },
  });
