import { StyleSheet, View } from 'react-native';
import { Label } from '@/components/Typography';
import { radius, spacing, type Palette } from '@/constants/theme';
import { useEventsBetween } from '@/lib/calendar';
import { todayInTimeZone } from '@/lib/logging';
import { addDays } from '@/lib/progress';
import type { MyTeam } from '@/lib/teams';
import { useThemedStyles } from '@/lib/theme';
import { EventRow } from './EventRow';

// On Home: what's on the calendar today, and a test or race tomorrow, so
// nobody has to open the Calendar tab to find out. Hidden on an empty day.
//
// This is the in-app stand-in for reminders until the app can send
// notifications.
export function TodayNotice({ team, accent }: { team: MyTeam; accent: string }) {
  const styles = useThemedStyles(makeStyles);
  const today = todayInTimeZone(team.timeZone);
  const tomorrow = addDays(today, 1);
  const range = useEventsBetween(team.id, today, tomorrow);

  const todays = (range.data?.events ?? []).filter((event) => event.event_date === today);
  const bigTomorrow = (range.data?.events ?? []).filter(
    (event) => event.event_date === tomorrow && (event.kind === 'test' || event.kind === 'race'),
  );
  if (todays.length === 0 && bigTomorrow.length === 0) return null;

  return (
    <View style={styles.card}>
      {todays.length ? (
        <>
          <Label>Today</Label>
          {todays.map((event) => (
            <EventRow key={event.id} event={event} accent={accent} />
          ))}
        </>
      ) : null}
      {bigTomorrow.length ? (
        <>
          <Label>Tomorrow</Label>
          {bigTomorrow.map((event) => (
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
      gap: spacing.xs,
      marginHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
  });
