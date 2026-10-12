import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { EventRow, useKindColor } from '@/components/calendar/EventRow';
import { HomeHeader } from '@/components/home/HomeHeader';
import { TeamGlow } from '@/components/home/TeamGlow';
import { TabScrollView } from '@/components/TabScrollView';
import { ErrorText, Headline, Label, Muted } from '@/components/Typography';
import { fontSize, fontWeight, radius, spacing, type Palette } from '@/constants/theme';
import { readableOn, visibleAccent } from '@/lib/color';
import {
  addMonths,
  longDay,
  monthGrid,
  monthOf,
  monthTitle,
  useEventsBetween,
  type CalendarEvent,
} from '@/lib/calendar';
import { todayInTimeZone } from '@/lib/logging';
import { useTeams, type MyTeam } from '@/lib/teams';
import { useTheme, useThemedStyles } from '@/lib/theme';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function Calendar() {
  const { scheme } = useTheme();
  const { currentTeam } = useTeams();

  if (!currentTeam) return null;
  const accent = visibleAccent(currentTeam.accentPrimary, scheme);

  return (
    <TabScrollView
      background={<TeamGlow primary={currentTeam.accentPrimary} secondary={currentTeam.accentSecondary} />}
      header={<HomeHeader accent={accent} />}
    >
      {/* key: back to this month when switching teams. */}
      <Month key={currentTeam.id} team={currentTeam} accent={accent} />
    </TabScrollView>
  );
}

function Month({ team, accent }: { team: MyTeam; accent: string }) {
  const styles = useThemedStyles(makeStyles);
  const kindColor = useKindColor(accent);
  const today = todayInTimeZone(team.timeZone);
  const [month, setMonth] = useState(monthOf(today));
  const [selected, setSelected] = useState(today);

  const days = monthGrid(month);
  // Load the whole grid, including the few days of the months either side.
  const range = useEventsBetween(team.id, days[0], days[days.length - 1]);
  const events = range.data?.events ?? [];
  const special = range.data?.special ?? [];

  const byDay = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    byDay.set(event.event_date, [...(byDay.get(event.event_date) ?? []), event]);
  }
  const selectedEvents = byDay.get(selected) ?? [];
  const inMonth = events.filter((event) => monthOf(event.event_date) === month);

  function go(count: number) {
    const next = addMonths(month, count);
    setMonth(next);
    // Keep "today" selected when coming back to the current month.
    setSelected(next === monthOf(today) ? today : `${next}-01`);
  }

  return (
    <View style={styles.wrapper}>
      <View style={styles.heading}>
        <Label>Calendar</Label>
        <Headline>What’s coming</Headline>
      </View>

      <View style={styles.card}>
        <View style={styles.monthRow}>
          <Arrow label="‹" accessibilityLabel="Previous month" onPress={() => go(-1)} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go to today"
            onPress={() => {
              setMonth(monthOf(today));
              setSelected(today);
            }}
          >
            <Text style={styles.monthTitle}>{monthTitle(month)}</Text>
          </Pressable>
          <Arrow label="›" accessibilityLabel="Next month" onPress={() => go(1)} />
        </View>

        <View style={styles.week}>
          {WEEKDAYS.map((letter, index) => (
            <Text key={index} style={styles.weekday}>
              {letter}
            </Text>
          ))}
        </View>

        {/* One row per week. */}
        {Array.from({ length: days.length / 7 }, (_, row) => (
          <View key={row} style={styles.week}>
            {days.slice(row * 7, row * 7 + 7).map((day) => {
              const dayEvents = byDay.get(day) ?? [];
              const isSelected = day === selected;
              const isToday = day === today;
              const outside = monthOf(day) !== month;
              return (
                <Pressable
                  key={day}
                  accessibilityRole="button"
                  accessibilityLabel={`${longDay(day)}${dayEvents.length ? `, ${dayEvents.length} on the calendar` : ''}`}
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => setSelected(day)}
                  style={styles.day}
                >
                  <View
                    style={[
                      styles.dayCircle,
                      isToday && { borderColor: accent, borderWidth: 1.5 },
                      isSelected && { backgroundColor: accent },
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayNumber,
                        outside && styles.outside,
                        isSelected && { color: readableOn(accent), fontWeight: fontWeight.bold },
                      ]}
                    >
                      {Number(day.slice(8))}
                    </Text>
                  </View>
                  <View style={styles.dots}>
                    {dayEvents.slice(0, 3).map((event) => (
                      <View key={event.id} style={[styles.dot, { backgroundColor: kindColor(event.kind) }]} />
                    ))}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      {range.isError ? <ErrorText>Couldn’t load the calendar. Pull down to try again.</ErrorText> : null}

      <View style={styles.card}>
        <Label>{longDay(selected)}</Label>
        {selectedEvents.length === 0 ? (
          <Muted style={styles.small}>Nothing on this day.</Muted>
        ) : (
          selectedEvents.map((event) => <EventRow key={event.id} event={event} accent={accent} />)
        )}
        {team.isAdmin ? (
          <Button
            title="Add to this day"
            variant="secondary"
            onPress={() => router.push({ pathname: '/event', params: { date: selected } })}
          />
        ) : null}
      </View>

      <View style={styles.card}>
        <Label>{monthTitle(month)}</Label>
        {special.filter((period) => monthOf(period.period_start) === month).map((period) => (
          <View key={period.period_start} style={styles.special}>
            <Text style={styles.specialText}>
              {period.label || 'Special'} week from {longDay(period.period_start)}
            </Text>
            <Muted style={styles.small}>Target: {period.min_credits} credits</Muted>
          </View>
        ))}
        {inMonth.length === 0 ? (
          <Muted style={styles.small}>
            {range.isLoading
              ? 'Loading…'
              : team.isAdmin
                ? 'Nothing planned this month. Pick a day above to add a test, race or workout.'
                : 'Nothing planned this month yet.'}
          </Muted>
        ) : (
          inMonth.map((event) => <EventRow key={event.id} event={event} accent={accent} showDay />)
        )}
      </View>
    </View>
  );
}

function Arrow({ label, accessibilityLabel, onPress }: { label: string; accessibilityLabel: string; onPress: () => void }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      hitSlop={10}
      style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}
    >
      <Text style={styles.arrowText}>{label}</Text>
    </Pressable>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    wrapper: {
      gap: spacing.lg,
      paddingHorizontal: spacing.xl,
    },
    heading: {
      gap: spacing.xs,
    },
    card: {
      gap: spacing.sm,
      padding: spacing.lg,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    small: {
      fontSize: fontSize.sm,
    },
    monthRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    monthTitle: {
      fontSize: fontSize.lg,
      fontWeight: fontWeight.bold,
      color: colors.text,
    },
    arrow: {
      width: 40,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
    arrowText: {
      fontSize: fontSize.xl,
      lineHeight: fontSize.xl + 2,
      color: colors.text,
    },
    pressed: {
      opacity: 0.5,
    },
    week: {
      flexDirection: 'row',
    },
    weekday: {
      flex: 1,
      textAlign: 'center',
      fontSize: fontSize.xs,
      fontWeight: fontWeight.semibold,
      color: colors.textMuted,
      paddingBottom: spacing.xs,
    },
    day: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 3,
      minHeight: 46,
    },
    dayCircle: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayNumber: {
      fontSize: fontSize.md,
      color: colors.text,
    },
    outside: {
      color: colors.textMuted,
      opacity: 0.5,
    },
    dots: {
      flexDirection: 'row',
      gap: 3,
      height: 6,
      marginTop: 2,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    special: {
      gap: 2,
      paddingVertical: spacing.sm,
    },
    specialText: {
      fontSize: fontSize.md,
      fontWeight: fontWeight.semibold,
      color: colors.caution,
    },
  });
