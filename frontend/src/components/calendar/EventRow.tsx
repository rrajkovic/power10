import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Muted } from '@/components/Typography';
import { fontSize, fontWeight, spacing, type Palette } from '@/constants/theme';
import { formatTime, KIND_LABELS, longDay, type CalendarEvent, type EventKind } from '@/lib/calendar';
import { useTheme, useThemedStyles } from '@/lib/theme';

// Tests and races stand out; workouts use the team color; the rest is quiet.
export function useKindColor(accent: string): (kind: EventKind) => string {
  const { colors } = useTheme();
  return (kind) =>
    kind === 'race' ? colors.danger : kind === 'test' ? colors.caution : kind === 'workout' ? accent : colors.textMuted;
}

// One event in a list. Tapping opens it.
export function EventRow({
  event,
  accent,
  showDay = false,
}: {
  event: CalendarEvent;
  accent: string;
  showDay?: boolean;
}) {
  const styles = useThemedStyles(makeStyles);
  const kindColor = useKindColor(accent);
  const details = [
    showDay ? longDay(event.event_date) : null,
    event.start_time ? formatTime(event.start_time) : null,
    event.activity ? `${event.activity.name}${event.intensity ? ` · ${event.intensity.name}` : ''}` : null,
  ].filter(Boolean);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${KIND_LABELS[event.kind]}: ${event.title}. Open`}
      onPress={() => router.push({ pathname: '/event', params: { id: event.id } })}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={[styles.bar, { backgroundColor: kindColor(event.kind) }]} />
      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={2}>
          {event.title}
        </Text>
        <Muted style={styles.small}>
          {[KIND_LABELS[event.kind], ...details].join(' · ')}
        </Muted>
      </View>
      <Muted style={styles.chevron}>›</Muted>
    </Pressable>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.sm,
    },
    pressed: {
      opacity: 0.6,
    },
    bar: {
      width: 4,
      alignSelf: 'stretch',
      borderRadius: 2,
    },
    text: {
      flex: 1,
      gap: 2,
    },
    title: {
      fontSize: fontSize.md,
      fontWeight: fontWeight.semibold,
      color: colors.text,
    },
    small: {
      fontSize: fontSize.sm,
    },
    chevron: {
      fontSize: fontSize.lg,
    },
  });
