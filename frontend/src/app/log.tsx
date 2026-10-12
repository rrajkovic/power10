import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, TextButton } from '@/components/Button';
import { CheckList, CheckRow } from '@/components/CheckRow';
import { Chips } from '@/components/Chips';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { ErrorText, Label, Muted, Title } from '@/components/Typography';
import { fontSize, fontWeight, radius, spacing, type Palette } from '@/constants/theme';
import { visibleAccent } from '@/lib/color';
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
  useLogSessions,
  useTeamAthletes,
  type DistanceUnit,
} from '@/lib/logging';
import { MAX_PHOTOS, pickPhotos, readWorkoutPhotos, type WorkoutPhoto } from '@/lib/photos';
import { addDays } from '@/lib/progress';
import { useSession } from '@/lib/session';
import { useTeams } from '@/lib/teams';
import { useTheme, useThemedStyles } from '@/lib/theme';
import { describeWindow, earliestAllowed } from '@/lib/windows';

const DISTANCE_UNITS: { value: DistanceUnit; label: string }[] = [
  { value: 'km', label: 'km' },
  { value: 'm', label: 'm' },
  { value: 'mi', label: 'mi' },
];

// One workout being filled in. Usually there's just one; photos of different
// activities (say three erg screens and a bike ride) give several, and they
// are all saved together.
type Draft = {
  typeId: string | null;
  intensityId: string | null;
  customLabel: string;
  // How many days before today (0 = today).
  daysAgo: number;
  duration: string;
  distance: string;
  unit: DistanceUnit;
  notes: string;
  // Which of the picked photos belong to this workout.
  photoIndexes: number[];
  // How sure the AI was when it read them (1 to 10); null if typed by hand.
  confidence: number | null;
  lowConfidence: boolean;
};

const EMPTY_DRAFT: Draft = {
  typeId: null,
  intensityId: null,
  customLabel: '',
  daysAgo: 0,
  duration: '',
  distance: '',
  unit: 'km',
  notes: '',
  photoIndexes: [],
  confidence: null,
  lowConfidence: false,
};

// The "Log a workout" sheet. It slides up over whichever tab you're on.
export default function LogWorkout() {
  const styles = useThemedStyles(makeStyles);
  const { colors, scheme } = useTheme();
  const { session } = useSession();
  const { currentTeam } = useTeams();
  const options = useLoggingOptions(currentTeam?.id);
  const logSessions = useLogSessions();
  // Coaches and admins can log for athletes instead of themselves.
  const canLogForOthers = !!currentTeam?.isAdmin;
  const athletes = useTeamAthletes(currentTeam?.id, canLogForOthers);
  const [forOthers, setForOthers] = useState(false);
  const [athleteIds, setAthleteIds] = useState<string[]>([]);

  const [drafts, setDrafts] = useState<Draft[]>([EMPTY_DRAFT]);
  // Which workout the form is showing.
  const [current, setCurrent] = useState(0);
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
  const today = todayInTimeZone(currentTeam.timeZone);
  // How many days back this person may log. Admins have no limit.
  const earliest = currentTeam.isAdmin ? null : earliestAllowed(currentTeam.logWindow, today);
  const maxDaysAgo = earliest === null ? null : daysBefore(earliest, today);

  // Everything worked out from what's typed into one workout.
  function check(draft: Draft) {
    // Start on the team's first type until you pick one.
    const type = types.find((t) => t.id === draft.typeId) ?? types[0] ?? null;
    const durationSeconds = parseDurationSeconds(draft.duration);
    const distanceMeters = parseDistanceMeters(draft.distance, draft.unit);
    const distanceInvalid = Number.isNaN(distanceMeters);
    const durationError = !draft.duration.trim()
      ? 'How long was it?'
      : durationSeconds === null
        ? 'Try something like 45, 1h 15m or 39:40'
        : null;
    const labelError = type?.is_custom && !draft.customLabel.trim() ? 'What did you do?' : null;
    // Sessions a coach logs for athletes are verified already, so no photo.
    const photoError =
      !forOthers && type?.requires_photo && draft.photoIndexes.length === 0
        ? `${type.name} needs a photo of your screen.`
        : null;
    return {
      type,
      date: addDays(today, -draft.daysAgo),
      durationSeconds,
      distanceMeters,
      distanceInvalid,
      durationError,
      labelError,
      photoError,
      valid: !!type && !durationError && !labelError && !photoError && !distanceInvalid,
    };
  }

  const draft = drafts[Math.min(current, drafts.length - 1)];
  const { type, date, durationSeconds, distanceMeters, distanceInvalid, durationError, labelError, photoError } =
    check(draft);

  // Changes the workout the form is showing.
  function update(changes: Partial<Draft>) {
    setDrafts(drafts.map((d, index) => (index === current ? { ...d, ...changes } : d)));
  }

  const rule = type ? findCreditRule(options.data?.rules ?? [], type.id, draft.intensityId) : null;
  const credits = estimateCredits(rule, durationSeconds, distanceInvalid ? null : distanceMeters);

  const athletesError = forOthers && athleteIds.length === 0 ? 'Pick at least one athlete.' : null;
  // Logging for athletes saves only the workout on screen (there are no photos).
  const toSave = forOthers ? [draft] : drafts;

  const allAthletes = athletes.data ?? [];
  const everyoneSelected = allAthletes.length > 0 && athleteIds.length === allAthletes.length;

  function toggleAthlete(id: string) {
    setAthleteIds(athleteIds.includes(id) ? athleteIds.filter((a) => a !== id) : [...athleteIds, id]);
  }

  // Has the AI read the photos and turns what it found into workouts: one per
  // activity. The athlete can still change anything before saving.
  async function readPhotos(currentPhotos: WorkoutPhoto[]) {
    const thisRead = ++latestRead.current;
    setPhotoNote(null);
    const everyPhoto = currentPhotos.map((_, index) => index);
    // Until (or unless) the photos are read, they all go with one workout.
    const keepTyped = (): Draft[] => [
      { ...drafts[0], photoIndexes: everyPhoto, confidence: null, lowConfidence: false },
    ];
    if (currentPhotos.length === 0) {
      setReading(false);
      setDrafts(keepTyped());
      setCurrent(0);
      return;
    }
    setReading(true);
    try {
      const read = await readWorkoutPhotos(currentTeam!.id, currentPhotos);
      if (thisRead !== latestRead.current) return;
      setCurrent(0);
      if (read.sessions.length === 0) {
        setDrafts(keepTyped());
        setPhotoNote({
          text: 'Couldn’t read that. You can type it in; a coach will be asked to check the photo.',
          isError: true,
        });
        return;
      }
      setDrafts(
        read.sessions.map((found) => {
          const km = found.distance_meters !== null && found.distance_meters >= 1000;
          const before = found.date ? daysBefore(found.date, today) : 0;
          return {
            ...EMPTY_DRAFT,
            typeId: found.activity_type_id,
            intensityId: found.intensity_id,
            // Ignore dates in the future or absurdly old (a monitor with a wrong
            // clock). A day the team no longer lets you log is kept, so saving
            // explains why instead of silently logging it as today.
            daysAgo: before >= 0 && before <= 60 ? before : 0,
            duration: durationInput(found.seconds),
            distance:
              found.distance_meters === null
                ? ''
                : String(km ? found.distance_meters / 1000 : found.distance_meters),
            unit: km || found.distance_meters === null ? 'km' : 'm',
            photoIndexes: found.photos,
            confidence: found.confidence,
            lowConfidence: found.low_confidence,
          };
        }),
      );
      const found =
        read.sessions.length === 1 ? 'Filled in from your photos.' : `Found ${read.sessions.length} workouts.`;
      const unread = read.unread.length
        ? ` Couldn’t read photo ${read.unread.map((index) => index + 1).join(', ')}, so it won’t be attached.`
        : '';
      setPhotoNote({ text: `${found}${unread} Check before saving.`, isError: false });
    } catch (error) {
      if (thisRead !== latestRead.current) return;
      setDrafts(keepTyped());
      setCurrent(0);
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
    if (athletesError || reading) return;
    const checked = toSave.map(check);
    // Show the first workout that still needs something.
    const firstInvalid = checked.findIndex((c) => !c.valid);
    if (firstInvalid !== -1) {
      if (!forOthers) setCurrent(firstInvalid);
      return;
    }
    logSessions.mutate(
      toSave.map((d, index) => ({
        teamId: currentTeam!.id,
        athleteIds: forOthers ? athleteIds : [session!.user.id],
        activityTypeId: checked[index].type!.id,
        intensityId: d.intensityId,
        customLabel: checked[index].type!.is_custom ? d.customLabel.trim() : null,
        date: checked[index].date,
        durationSeconds: checked[index].durationSeconds!,
        distanceMeters: checked[index].distanceMeters,
        notes: d.notes.trim() || null,
        photos: forOthers ? [] : d.photoIndexes.map((i) => photos[i]).filter(Boolean),
      })),
      { onSuccess: () => router.back() },
    );
  }

  // "Erg · 1 h", for the list of workouts found in the photos.
  function draftLabel(d: Draft) {
    const c = check(d);
    const time = c.durationSeconds !== null ? formatDuration(c.durationSeconds) : 'no time yet';
    return `${c.type?.name ?? 'Workout'} · ${time}`;
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
                <CheckList>
                  <CheckRow
                    name={`Everyone (${allAthletes.length})`}
                    selected={everyoneSelected}
                    accent={accent}
                    bold
                    onPress={() => setAthleteIds(everyoneSelected ? [] : allAthletes.map((a) => a.id))}
                  />
                  {allAthletes.map((athlete) => (
                    <CheckRow
                      key={athlete.id}
                      name={athlete.name}
                      selected={athleteIds.includes(athlete.id)}
                      accent={accent}
                      onPress={() => toggleAthlete(athlete.id)}
                    />
                  ))}
                </CheckList>
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
              <Label>Photos{type?.requires_photo ? '' : ' (optional)'}</Label>
              <Muted style={styles.hint}>
                Add photos of your erg, watch or app screens and we’ll fill in the rest. Different
                activities are logged as separate workouts.
              </Muted>
              {photos.length ? (
                <View style={styles.photoRow}>
                  {photos.map((photo, index) => (
                    <View key={photo.uri}>
                      <Image source={{ uri: photo.uri }} style={styles.photo} />
                      {/* With several workouts, show which one each photo went to. */}
                      {drafts.length > 1 && drafts.some((d) => d.photoIndexes.includes(index)) ? (
                        <View style={styles.photoBadge}>
                          <Text style={styles.photoBadgeText}>
                            {drafts.findIndex((d) => d.photoIndexes.includes(index)) + 1}
                          </Text>
                        </View>
                      ) : null}
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
                  <Muted style={styles.hint}>
                    {photos.length === 1 ? 'Reading your photo…' : 'Reading your photos…'}
                  </Muted>
                </View>
              ) : photoNote ? (
                photoNote.isError ? (
                  <ErrorText>{photoNote.text}</ErrorText>
                ) : (
                  <Muted style={styles.hint}>{photoNote.text}</Muted>
                )
              ) : null}
              {triedToSave && photoError ? <ErrorText>{photoError}</ErrorText> : null}
            </View>
          )}

          {!forOthers && drafts.length > 1 ? (
            <View style={styles.field}>
              <Label>Workouts found</Label>
              <Chips
                options={drafts.map((d, index) => ({
                  value: String(index),
                  label: `${index + 1} · ${draftLabel(d)}`,
                }))}
                value={String(current)}
                onChange={(value) => value !== null && setCurrent(Number(value))}
                accent={accent}
              />
              <Muted style={styles.hint}>Tap one to check or change it. They’re all saved together.</Muted>
            </View>
          ) : null}

          {!forOthers && draft.lowConfidence ? (
            <View style={styles.warning}>
              <Text style={styles.warningText}>
                Hard to read (confidence {draft.confidence}/10). Check the numbers below. A coach will
                be asked to take a look at this one.
              </Text>
            </View>
          ) : null}

          <View style={styles.field}>
            <Label>Activity</Label>
            <Chips
              options={types.map((t) => ({ value: t.id, label: t.name }))}
              value={type?.id ?? null}
              onChange={(typeId) => update({ typeId })}
              accent={accent}
            />
            {type?.is_custom ? (
              <TextField
                placeholder="What did you do? (e.g. Swim, Hike)"
                value={draft.customLabel}
                onChangeText={(customLabel) => update({ customLabel })}
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
                value={draft.intensityId}
                onChange={(intensityId) => update({ intensityId })}
                accent={accent}
                allowNone
              />
            </View>
          ) : null}

          <View style={styles.field}>
            <Label>When</Label>
            <View style={styles.dateRow}>
              <DayButton
                label="‹"
                accessibilityLabel="Previous day"
                disabled={maxDaysAgo !== null && draft.daysAgo >= maxDaysAgo}
                onPress={() => update({ daysAgo: draft.daysAgo + 1 })}
              />
              <Text style={styles.date}>{dayLabel(date, today)}</Text>
              <DayButton
                label="›"
                accessibilityLabel="Next day"
                disabled={draft.daysAgo === 0}
                onPress={() => update({ daysAgo: draft.daysAgo - 1 })}
              />
            </View>
            {maxDaysAgo !== null ? (
              draft.daysAgo > maxDaysAgo ? (
                <ErrorText>
                  That day is too far back to log ({describeWindow(currentTeam.logWindow)}). Pick a
                  later day or ask a coach to add it.
                </ErrorText>
              ) : (
                <Muted style={styles.hint}>
                  Your team lets you log {describeWindow(currentTeam.logWindow)}.
                </Muted>
              )
            ) : null}
          </View>

          <View style={styles.field}>
            <Label>Time</Label>
            <TextField
              placeholder="45, 1h 15m or 39:40"
              value={draft.duration}
              onChangeText={(duration) => update({ duration })}
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
                  value={draft.distance}
                  onChangeText={(distance) => update({ distance })}
                  keyboardType="decimal-pad"
                  error={distanceInvalid ? 'Enter a number' : null}
                />
              </View>
              <Chips
                options={DISTANCE_UNITS}
                value={draft.unit}
                onChange={(unit) => unit && update({ unit })}
                accent={colors.primary}
              />
            </View>
          </View>

          <View style={styles.field}>
            <Label>Notes (optional)</Label>
            <TextField
              placeholder="How did it go?"
              value={draft.notes}
              onChangeText={(notes) => update({ notes })}
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

          {logSessions.isError ? (
            <ErrorText>
              Couldn’t save: {logSessions.error.message || 'check your connection and try again'}.
            </ErrorText>
          ) : null}
          <Button
            title={
              forOthers && athleteIds.length > 0
                ? `Save for ${athleteIds.length} ${athleteIds.length === 1 ? 'athlete' : 'athletes'}`
                : toSave.length > 1
                  ? `Save ${toSave.length} workouts`
                  : 'Save workout'
            }
            onPress={save}
            loading={logSessions.isPending}
            disabled={reading}
          />
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
    photoBadge: {
      position: 'absolute',
      left: 4,
      bottom: 4,
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
    },
    photoBadgeText: {
      fontSize: fontSize.xs,
      fontWeight: fontWeight.bold,
      color: colors.onPrimary,
    },
    warning: {
      padding: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.caution,
    },
    warningText: {
      fontSize: fontSize.sm,
      color: colors.caution,
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
