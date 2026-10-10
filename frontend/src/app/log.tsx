import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, TextButton } from '@/components/Button';
import { Chips } from '@/components/Chips';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { ErrorText, Label, Muted, Title } from '@/components/Typography';
import { fontSize, fontWeight, radius, spacing, type Palette } from '@/constants/theme';
import { visibleAccent } from '@/lib/color';
import {
  dayLabel,
  describeRule,
  estimateCredits,
  findCreditRule,
  formatDuration,
  parseDistanceMeters,
  parseDurationSeconds,
  todayInTimeZone,
  useLoggingOptions,
  useLogSession,
  type DistanceUnit,
} from '@/lib/logging';
import { addDays } from '@/lib/progress';
import { useSession } from '@/lib/session';
import { useTeams } from '@/lib/teams';
import { useTheme, useThemedStyles } from '@/lib/theme';

const DISTANCE_UNITS: { value: DistanceUnit; label: string }[] = [
  { value: 'km', label: 'km' },
  { value: 'm', label: 'm' },
  { value: 'mi', label: 'mi' },
];

// The "Log a workout" sheet. It slides up over whichever tab you're on.
export default function LogWorkout() {
  const styles = useThemedStyles(makeStyles);
  const { colors, scheme } = useTheme();
  const { session } = useSession();
  const { currentTeam } = useTeams();
  const options = useLoggingOptions(currentTeam?.id);
  const logSession = useLogSession();

  const [typeId, setTypeId] = useState<string | null>(null);
  const [intensityId, setIntensityId] = useState<string | null>(null);
  const [customLabel, setCustomLabel] = useState('');
  // How many days before today (0 = today).
  const [daysAgo, setDaysAgo] = useState(0);
  const [duration, setDuration] = useState('');
  const [distance, setDistance] = useState('');
  const [unit, setUnit] = useState<DistanceUnit>('km');
  const [notes, setNotes] = useState('');
  // Only show "this is required" messages after the first try at saving.
  const [triedToSave, setTriedToSave] = useState(false);

  if (!currentTeam || !session) return null;
  const accent = visibleAccent(currentTeam.accentPrimary, scheme);

  const types = options.data?.types ?? [];
  const intensities = options.data?.intensities ?? [];
  // Start on the team's first type until you pick one.
  const type = types.find((t) => t.id === typeId) ?? types[0] ?? null;

  const today = todayInTimeZone(currentTeam.timeZone);
  const date = addDays(today, -daysAgo);

  const durationSeconds = parseDurationSeconds(duration);
  const distanceMeters = parseDistanceMeters(distance, unit);
  const distanceInvalid = Number.isNaN(distanceMeters);

  const rule = type ? findCreditRule(options.data?.rules ?? [], type.id, intensityId) : null;
  const credits = estimateCredits(rule, durationSeconds, distanceInvalid ? null : distanceMeters);

  const durationError = !duration.trim()
    ? 'How long was it?'
    : durationSeconds === null
      ? 'Try something like 45, 1h 15m or 39:40'
      : null;
  const labelError = type?.is_custom && !customLabel.trim() ? 'What did you do?' : null;
  const canSave = !!type && !durationError && !labelError && !distanceInvalid;

  function save() {
    setTriedToSave(true);
    if (!canSave || !type || durationSeconds === null) return;
    logSession.mutate(
      {
        teamId: currentTeam!.id,
        athleteId: session!.user.id,
        activityTypeId: type.id,
        intensityId,
        customLabel: type.is_custom ? customLabel.trim() : null,
        date,
        durationSeconds,
        distanceMeters: distanceMeters,
        notes: notes.trim() || null,
      },
      { onSuccess: () => router.back() },
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Title style={styles.title}>Log a workout</Title>
        <TextButton title="Cancel" onPress={() => router.back()} />
      </View>

      {options.isLoading ? (
        <Muted>Loading…</Muted>
      ) : options.isError ? (
        <ErrorText>Couldn’t load your team’s activities. Check your connection and try again.</ErrorText>
      ) : (
        <View style={styles.form}>
          <View style={styles.field}>
            <Label>Activity</Label>
            <Chips
              options={types.map((t) => ({ value: t.id, label: t.name }))}
              value={type?.id ?? null}
              onChange={setTypeId}
              accent={accent}
            />
            {type?.is_custom ? (
              <TextField
                placeholder="What did you do? (e.g. Swim, Hike)"
                value={customLabel}
                onChangeText={setCustomLabel}
                maxLength={60}
                error={triedToSave ? labelError : null}
              />
            ) : null}
          </View>

          {intensities.length ? (
            <View style={styles.field}>
              <Label>Intensity</Label>
              <Chips
                options={intensities.map((i) => ({ value: i.id, label: i.name }))}
                value={intensityId}
                onChange={setIntensityId}
                accent={accent}
                allowNone
              />
            </View>
          ) : null}

          <View style={styles.field}>
            <Label>When</Label>
            <View style={styles.dateRow}>
              <DayButton label="‹" accessibilityLabel="Previous day" onPress={() => setDaysAgo(daysAgo + 1)} />
              <Text style={styles.date}>{dayLabel(date, today)}</Text>
              <DayButton
                label="›"
                accessibilityLabel="Next day"
                disabled={daysAgo === 0}
                onPress={() => setDaysAgo(daysAgo - 1)}
              />
            </View>
          </View>

          <View style={styles.field}>
            <Label>Time</Label>
            <TextField
              placeholder="45, 1h 15m or 39:40"
              value={duration}
              onChangeText={setDuration}
              keyboardType="numbers-and-punctuation"
              autoCapitalize="none"
              autoCorrect={false}
              error={triedToSave ? durationError : null}
            />
            {durationSeconds !== null ? (
              <Muted style={styles.hint}>{formatDuration(durationSeconds)}</Muted>
            ) : null}
          </View>

          <View style={styles.field}>
            <Label>Distance (optional)</Label>
            <View style={styles.distanceRow}>
              <View style={styles.distanceInput}>
                <TextField
                  placeholder="0"
                  value={distance}
                  onChangeText={setDistance}
                  keyboardType="decimal-pad"
                  error={distanceInvalid ? 'Enter a number' : null}
                />
              </View>
              <Chips
                options={DISTANCE_UNITS}
                value={unit}
                onChange={(value) => value && setUnit(value)}
                accent={colors.primary}
              />
            </View>
          </View>

          <View style={styles.field}>
            <Label>Notes (optional)</Label>
            <TextField
              placeholder="How did it go?"
              value={notes}
              onChangeText={setNotes}
              multiline
              maxLength={2000}
              style={styles.notes}
            />
          </View>

          <View style={styles.credits}>
            <View>
              <Label>Credits</Label>
              <Muted style={styles.hint}>{describeRule(rule)}</Muted>
            </View>
            <Text style={[styles.creditsValue, { color: accent }]}>
              {credits === null ? '–' : credits.toFixed(1)}
            </Text>
          </View>

          {logSession.isError ? (
            <ErrorText>
              Couldn’t save: {logSession.error.message || 'check your connection and try again'}.
            </ErrorText>
          ) : null}
          <Button title="Save workout" onPress={save} loading={logSession.isPending} />
        </View>
      )}
    </Screen>
  );
}

function DayButton({
  label,
  accessibilityLabel,
  onPress,
  disabled = false,
}: {
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      style={({ pressed }) => [styles.dayButton, (pressed || disabled) && styles.faded]}
    >
      <Text style={styles.dayButtonText}>{label}</Text>
    </Pressable>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    title: {
      marginBottom: 0,
    },
    form: {
      gap: spacing.xl,
    },
    field: {
      gap: spacing.sm,
    },
    hint: {
      fontSize: fontSize.sm,
    },
    dateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    date: {
      fontSize: fontSize.md,
      fontWeight: fontWeight.semibold,
      color: colors.text,
    },
    dayButton: {
      width: 40,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayButtonText: {
      fontSize: fontSize.xl,
      lineHeight: fontSize.xl + 2,
      color: colors.text,
    },
    faded: {
      opacity: 0.3,
    },
    distanceRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.md,
    },
    distanceInput: {
      flex: 1,
    },
    notes: {
      minHeight: 88,
      textAlignVertical: 'top',
    },
    credits: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: spacing.lg,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    creditsValue: {
      fontSize: fontSize.xxl,
      fontWeight: fontWeight.heavy,
    },
  });
