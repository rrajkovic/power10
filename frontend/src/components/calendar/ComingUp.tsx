import { StyleSheet, Text, View } from 'react-native';
import { Label, Muted } from '@/components/Typography';
import { fontSize, fontWeight, radius, spacing, type Palette } from '@/constants/theme';
import { daysAway, useEventsBetween } from '@/lib/calendar';
import { todayInTimeZone } from '@/lib/logging';
import { addDays } from '@/lib/progress';
import type { MyTeam } from '@/lib/teams';
import { useThemedStyles } from '@/lib/theme';
import { EventRow } from './EventRow';

// How far ahead to look for the next test or race.
const DAYS_AHEAD = 120;

// Team tab: today's scheduled workouts, and the next test or race with a
// countdown. Hidden when there's neither.
export function ComingUp({ team, accent }: { team: MyTeam; accent: string }) {
  const styles = useThemedStyles(makeStyles);
  const today = todayInTimeZone(team.timeZone);
  const range = useEventsBetween(team.id, today, addDays(today, DAYS_AHEAD));
  const events = range.data?.events ?? [];

  const todays = events.filter((event) => event.event_date === today && event.kind === 'workout');
  const next = events.find((event) => event.kind === 'test' || event.kind === 'race');
  if (todays.length === 0 && !next) return null;

  return (
    <View style={styles.card}>
      <Label>Coming up</Label>
      {next ? (
        <View style={styles.countdown}>
          <Text style={[styles.when, { color: accent }]}>{daysAway(next.event_date, today)}</Text>
          <EventRow event={next} accent={accent} showDay />
        </View>
      ) : null}
      {todays.length ? (
        <>
          <Muted style={styles.small}>Today’s workout{todays.length > 1 ? 's' : ''}</Muted>
          {todays.map((event) => (
            <EventRow key={event.id} event={event} accent={accent} />
          ))}
        </>
      ) : null}
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    card: {
      gap: spacing.sm,
      marginHorizontal: spacing.xl,
      padding: spacing.xl,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    countdown: {
      gap: 2,
    },
    when: {
      fontSize: fontSize.xl,
      fontWeight: fontWeight.heavy,
      textTransform: 'capitalize',
    },
    small: {
      fontSize: fontSize.sm,
    },
  });
