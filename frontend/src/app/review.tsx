import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, TextButton } from '@/components/Button';
import { Chips } from '@/components/Chips';
import { SessionSummary } from '@/components/review/SessionSummary';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { ErrorText, Label, Muted, Title } from '@/components/Typography';
import { fontSize, radius, spacing, type Palette } from '@/constants/theme';
import { visibleAccent } from '@/lib/color';
import {
  durationInput,
  parseDistanceMeters,
  parseDurationSeconds,
  todayInTimeZone,
  useLoggingOptions,
} from '@/lib/logging';
import {
  useConfirmFlagged,
  useCorrectFlagged,
  useMyFlaggedSessions,
  type MyFlaggedSession,
} from '@/lib/review';
import { useTeams, type MyTeam } from '@/lib/teams';
import { useTheme, useThemedStyles } from '@/lib/theme';

// Your workouts that the photo check flagged. For each one: say it's right,
// or fix it. A coach sees your answer and makes the final call.
export default function ReviewFlagged() {
  const styles = useThemedStyles(makeStyles);
  const { currentTeam } = useTeams();
  const flagged = useMyFlaggedSessions(currentTeam?.id);

  if (!currentTeam) return null;

  return (
    <Screen>
      <View style={styles.header}>
        <Title style={styles.title}>Check your workouts</Title>
        <TextButton title="Done" onPress={() => router.back()} />
      </View>
      <Muted style={styles.small}>
        The photo didn’t quite match what was logged. Have a look: confirm it if it’s right, or fix
        it if it isn’t. These workouts still count while you do.
      </Muted>

      {flagged.isLoading ? (
        <Muted>Loading…</Muted>
      ) : flagged.isError ? (
        <ErrorText>Couldn’t load. Check your connection and try again.</ErrorText>
      ) : flagged.data?.length === 0 ? (
        <Muted>All done. Nothing needs checking. 🎉</Muted>
      ) : (
        flagged.data?.map((session) => (
          <FlaggedCard key={session.id} session={session} team={currentTeam} />
        ))
      )}
    </Screen>
  );
}

function FlaggedCard({ session, team }: { session: MyFlaggedSession; team: MyTeam }) {
  const styles = useThemedStyles(makeStyles);
  const { scheme } = useTheme();
  const accent = visibleAccent(team.accentPrimary, scheme);
  const options = useLoggingOptions(team.id);
  const confirm = useConfirmFlagged();
  const correct = useCorrectFlagged();

  const [fixing, setFixing] = useState(false);
  const [note, setNote] = useState('');
  // The fix starts from what was logged.
  const [typeId, setTypeId] = useState(session.activity_type_id);
  const [intensityId, setIntensityId] = useState<string | null>(session.intensity_id);
  const [duration, setDuration] = useState(durationInput(session.duration_seconds));
  const [distance, setDistance] = useState(
    session.distance_meters ? String(session.distance_meters / 1000) : '',
  );

  const durationSeconds = parseDurationSeconds(duration);
  const distanceMeters = parseDistanceMeters(distance, 'km');
  const distanceInvalid = Number.isNaN(distanceMeters);
  const busy = confirm.isPending || correct.isPending;
  const error = confirm.error ?? correct.error;

  return (
    <View style={styles.card}>
      <SessionSummary session={session} today={todayInTimeZone(team.timeZone)} />
      {session.athlete_response === 'corrected' ? (
        <Muted style={styles.small}>You already fixed this once, and it was flagged again.</Muted>
      ) : null}

      {fixing ? (
        <View style={styles.fields}>
          <View style={styles.field}>
            <Label>Activity</Label>
            <Chips
              options={(options.data?.types ?? []).map((t) => ({ value: t.id, label: t.name }))}
              value={typeId}
              onChange={(value) => value && setTypeId(value)}
              accent={accent}
            />
          </View>
          {options.data?.intensities.length ? (
            <View style={styles.field}>
              <Label>Intensity</Label>
              <Chips
                options={options.data.intensities.map((i) => ({ value: i.id, label: i.name }))}
                value={intensityId}
                onChange={setIntensityId}
                accent={accent}
                allowNone
              />
            </View>
          ) : null}
          <View style={styles.field}>
            <Label>Time</Label>
            <TextField
              placeholder="45, 1h 15m or 39:40"
              value={duration}
              onChangeText={setDuration}
              keyboardType="numbers-and-punctuation"
              autoCapitalize="none"
              autoCorrect={false}
              error={durationSeconds === null ? 'Try something like 45, 1h 15m or 39:40' : null}
            />
          </View>
          <View style={styles.field}>
            <Label>Distance in km (optional)</Label>
            <TextField
              placeholder="0"
              value={distance}
              onChangeText={setDistance}
              keyboardType="decimal-pad"
              error={distanceInvalid ? 'Enter a number' : null}
            />
          </View>
        </View>
      ) : null}

      <TextField
        placeholder="Add a note for your coach (optional)"
        value={note}
        onChangeText={setNote}
        maxLength={500}
      />
      {error ? <ErrorText>Couldn’t save: {error.message}.</ErrorText> : null}

      {fixing ? (
        <View style={styles.buttons}>
          <View style={styles.button}>
            <Button title="Back" variant="secondary" disabled={busy} onPress={() => setFixing(false)} />
          </View>
          <View style={styles.button}>
            <Button
              title="Save fix"
              loading={correct.isPending}
              disabled={durationSeconds === null || distanceInvalid}
              onPress={() =>
                durationSeconds !== null &&
                correct.mutate({
                  sessionId: session.id,
                  activityTypeId: typeId,
                  intensityId,
                  durationSeconds,
                  distanceMeters,
                  note,
                })
              }
            />
          </View>
        </View>
      ) : (
        <View style={styles.buttons}>
          <View style={styles.button}>
            <Button title="Fix it" variant="secondary" disabled={busy} onPress={() => setFixing(true)} />
          </View>
          <View style={styles.button}>
            <Button
              title="It’s correct"
              loading={confirm.isPending}
              onPress={() => confirm.mutate({ sessionId: session.id, note })}
            />
          </View>
        </View>
      )}
    </View>
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
    small: {
      fontSize: fontSize.sm,
    },
    card: {
      gap: spacing.md,
      marginTop: spacing.md,
      padding: spacing.lg,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    fields: {
      gap: spacing.lg,
    },
    field: {
      gap: spacing.sm,
    },
    buttons: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    button: {
      flex: 1,
    },
  });
