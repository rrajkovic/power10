import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, TextButton } from '@/components/Button';
import { Chips } from '@/components/Chips';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { ErrorText, Label, Muted, Title } from '@/components/Typography';
import { fontSize, fontWeight, radius, spacing, type Palette } from '@/constants/theme';
import { readableOn, visibleAccent } from '@/lib/color';
import {
  dayLabel,
  daysBefore,
  describeRule,
  durationInput,
  estimateCredits,
  findCreditRule,
  formatDuration,
  parseDistanceMeters,
  parseDurationSeconds,
  todayInTimeZone,
  useLoggingOptions,
  useLogSession,
  useTeamAthletes,
  type DistanceUnit,
} from '@/lib/logging';
import { MAX_PHOTOS, pickPhotos, readWorkoutPhotos, type WorkoutPhoto } from '@/lib/photos';
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
  // Coaches and admins can log for athletes instead of themselves.
  const canLogForOthers = !!currentTeam?.isAdmin;
  const athletes = useTeamAthletes(currentTeam?.id, canLogForOthers);
  const [forOthers, setForOthers] = useState(false);
  const [athleteIds, setAthleteIds] = useState<string[]>([]);

  const [typeId, setTypeId] = useState<string | null>(null);
  const [intensityId, setIntensityId] = useState<string | null>(null);
  const [customLabel, setCustomLabel] = useState('');
  // How many days before today (0 = today).
  const [daysAgo, setDaysAgo] = useState(0);
  const [duration, setDuration] = useState('');
  const [distance, setDistance] = useState('');
  const [unit, setUnit] = useState<DistanceUnit>('km');
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<WorkoutPhoto[]>([]);
  // What the AI is doing with the photos, and what it said.
  const [reading, setReading] = useState(false);
  const [photoNote, setPhotoNote] = useState<{ text: string; isError: boolean } | null>(null);
  // Counts photo reads, so a slow old answer can't overwrite a newer one.
  const latestRead = useRef(0);
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
  // Sessions a coach logs for athletes are verified already, so no photo.
  const photoError =
    !forOthers && type?.requires_photo && photos.length === 0
      ? `${type.name} needs a photo of your screen.`
      : null;
  const athletesError = forOthers && athleteIds.length === 0 ? 'Pick at least one athlete.' : null;
  const canSave =
    !!type && !durationError && !labelError && !photoError && !athletesError && !distanceInvalid;

  const allAthletes = athletes.data ?? [];
  const everyoneSelected = allAthletes.length > 0 && athleteIds.length === allAthletes.length;

  function toggleAthlete(id: string) {
    setAthleteIds(athleteIds.includes(id) ? athleteIds.filter((a) => a !== id) : [...athleteIds, id]);
  }

  // Has the AI read the photos and fills in whatever it could. The athlete
  // can still change anything before saving.
  async function readPhotos(current: WorkoutPhoto[]) {
    const thisRead = ++latestRead.current;
    setPhotoNote(null);
    if (current.length === 0) {
      setReading(false);
      return;
    }
    setReading(true);
    try {
      const read = await readWorkoutPhotos(currentTeam!.id, current);
      if (thisRead !== latestRead.current) return;
      if (read.seconds !== null) setDuration(durationInput(read.seconds));
      if (read.distance_meters !== null) {
        const km = read.distance_meters >= 1000;
        setUnit(km ? 'km' : 'm');
        setDistance(String(km ? read.distance_meters / 1000 : read.distance_meters));
      }
      if (read.activity_type_id) setTypeId(read.activity_type_id);
      if (read.intensity_id) setIntensityId(read.intensity_id);
      if (read.date) {
        const before = daysBefore(read.date, today);
        // Ignore dates in the future or absurdly old (a monitor with a wrong clock).
        if (before >= 0 && before <= 60) setDaysAgo(before);
      }
      setPhotoNote({
        text: read.note || (read.readable ? 'Filled in from your photo.' : 'Couldn’t read that photo.'),
        isError: !read.readable,
      });
    } catch (error) {
      if (thisRead !== latestRead.current) return;
      setPhotoNote({ text: (error as Error).message, isError: true });
    } finally {
      if (thisRead === latestRead.current) setReading(false);
    }
  }

  async function addPhotos(from: WorkoutPhoto['source']) {
    try {
      const added = await pickPhotos(from, MAX_PHOTOS - photos.length);
      if (added.length === 0) return;
      const next = [...photos, ...added].slice(0, MAX_PHOTOS);
      setPhotos(next);
      readPhotos(next);
    } catch (error) {
      setPhotoNote({ text: (error as Error).message, isError: true });
    }
  }

  function removePhoto(index: number) {
    const next = photos.filter((_, i) => i !== index);
    setPhotos(next);
    readPhotos(next);
  }

  function save() {
    setTriedToSave(true);
    if (!canSave || !type || durationSeconds === null) return;
    logSession.mutate(
      {
        teamId: currentTeam!.id,
        athleteIds: forOthers ? athleteIds : [session!.user.id],
        activityTypeId: type.id,
        intensityId,
        customLabel: type.is_custom ? customLabel.trim() : null,
        date,
        durationSeconds,
        distanceMeters: distanceMeters,
        notes: notes.trim() || null,
        photos: forOthers ? [] : photos,
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
          {canLogForOthers ? (
            <View style={styles.field}>
              <Label>Who</Label>
              <Chips
                options={[
                  { value: 'me', label: 'Me' },
                  { value: 'athletes', label: 'Athletes' },
                ]}
                value={forOthers ? 'athletes' : 'me'}
                onChange={(value) => setForOthers(value === 'athletes')}
                accent={accent}
              />
              {!forOthers ? null : athletes.isLoading ? (
                <Muted style={styles.hint}>Loading athletes…</Muted>
              ) : allAthletes.length === 0 ? (
                <Muted style={styles.hint}>No athletes on this team yet.</Muted>
              ) : (
                <View style={styles.athleteList}>
                  <AthleteRow
                    name={`Everyone (${allAthletes.length})`}
                    selected={everyoneSelected}
                    accent={accent}
                    bold
                    onPress={() => setAthleteIds(everyoneSelected ? [] : allAthletes.map((a) => a.id))}
                  />
                  {allAthletes.map((athlete) => (
                    <AthleteRow
                      key={athlete.id}
                      name={athlete.name}
                      selected={athleteIds.includes(athlete.id)}
                      accent={accent}
                      onPress={() => toggleAthlete(athlete.id)}
                    />
                  ))}
                </View>
              )}
              {forOthers ? (
                <Muted style={styles.hint}>
                  Each athlete gets this workout. Workouts you log for athletes count as verified.
                </Muted>
              ) : null}
              {triedToSave && athletesError ? <ErrorText>{athletesError}</ErrorText> : null}
            </View>
          ) : null}

          {forOthers ? null : (
            <View style={styles.field}>
              <Label>Photo{type?.requires_photo ? '' : ' (optional)'}</Label>
              <Muted style={styles.hint}>
                Add a photo of your erg, watch or app screen and we’ll fill in the rest.
              </Muted>
              {photos.length ? (
                <View style={styles.photoRow}>
                  {photos.map((photo, index) => (
                    <View key={photo.uri}>
                      <Image source={{ uri: photo.uri }} style={styles.photo} />
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Remove photo ${index + 1}`}
                        onPress={() => removePhoto(index)}
                        hitSlop={8}
                        style={styles.removePhoto}
                      >
                        <Text style={styles.removePhotoText}>✕</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : null}
              {photos.length < MAX_PHOTOS ? (
                <View style={styles.photoButtons}>
                  {/* Browsers can't open the camera this way; phones can. */}
                  {Platform.OS !== 'web' ? (
                    <View style={styles.photoButton}>
                      <Button title="Take photo" variant="secondary" onPress={() => addPhotos('camera')} />
                    </View>
                  ) : null}
                  <View style={styles.photoButton}>
                    <Button title="Choose photo" variant="secondary" onPress={() => addPhotos('gallery')} />
                  </View>
                </View>
              ) : null}
              {reading ? (
                <View style={styles.readingRow}>
                  <ActivityIndicator color={colors.textMuted} />
                  <Muted style={styles.hint}>Reading your photo…</Muted>
                </View>
              ) : photoNote ? (
                photoNote.isError ? (
                  <ErrorText>{photoNote.text}</ErrorText>
                ) : (
                  <Muted style={styles.hint}>{photoNote.text} Check it before saving.</Muted>
                )
              ) : null}
              {triedToSave && photoError ? <ErrorText>{photoError}</ErrorText> : null}
            </View>
          )}

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
              <Label>{forOthers && athleteIds.length > 1 ? 'Credits each' : 'Credits'}</Label>
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
          <Button
            title={
              forOthers && athleteIds.length > 0
                ? `Save for ${athleteIds.length} ${athleteIds.length === 1 ? 'athlete' : 'athletes'}`
                : 'Save workout'
            }
            onPress={save}
            loading={logSession.isPending}
          />
        </View>
      )}
    </Screen>
  );
}

// One line in the "who is this for" list, with a checkbox.
function AthleteRow({
  name,
  selected,
  accent,
  onPress,
  bold = false,
}: {
  name: string;
  selected: boolean;
  accent: string;
  onPress: () => void;
  bold?: boolean;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={name}
      onPress={onPress}
      style={({ pressed }) => [styles.athleteRow, pressed && styles.faded]}
    >
      <View style={[styles.checkbox, selected && { backgroundColor: accent, borderColor: accent }]}>
        {selected ? <Text style={[styles.check, { color: readableOn(accent) }]}>✓</Text> : null}
      </View>
      <Text style={[styles.athleteName, bold && styles.athleteNameBold]} numberOfLines={1}>
        {name}
      </Text>
    </Pressable>
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
    athleteList: {
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingVertical: spacing.xs,
    },
    athleteRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.lg,
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 1.5,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    check: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
    },
    athleteName: {
      flex: 1,
      fontSize: fontSize.md,
      color: colors.text,
    },
    athleteNameBold: {
      fontWeight: fontWeight.semibold,
    },
    photoRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
      paddingTop: spacing.sm,
    },
    photo: {
      width: 72,
      height: 72,
      borderRadius: radius.md,
      backgroundColor: colors.track,
    },
    removePhoto: {
      position: 'absolute',
      top: -8,
      right: -8,
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceRaised,
      borderWidth: 1,
      borderColor: colors.border,
    },
    removePhotoText: {
      fontSize: fontSize.xs,
      fontWeight: fontWeight.bold,
      color: colors.text,
    },
    photoButtons: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    photoButton: {
      flex: 1,
    },
    readingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
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
