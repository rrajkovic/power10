import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, TextButton } from '@/components/Button';
import { FixFields, fixFrom, readFix } from '@/components/review/FixFields';
import { SessionSummary } from '@/components/review/SessionSummary';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { ErrorText, Muted, Title } from '@/components/Typography';
import { fontSize, radius, spacing, type Palette } from '@/constants/theme';
import { visibleAccent } from '@/lib/color';
import { todayInTimeZone } from '@/lib/logging';
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
  const confirm = useConfirmFlagged();
  const correct = useCorrectFlagged();

  const [fixing, setFixing] = useState(false);
  const [note, setNote] = useState('');
  const [fix, setFix] = useState(() => fixFrom(session));
  const { durationSeconds, distanceMeters, valid } = readFix(fix);
  const busy = confirm.isPending || correct.isPending;
  const error = confirm.error ?? correct.error;

  return (
    <View style={styles.card}>
      <SessionSummary session={session} today={todayInTimeZone(team.timeZone)} />
      {session.athlete_response === 'corrected' ? (
        <Muted style={styles.small}>You already fixed this once, and it was flagged again.</Muted>
      ) : null}

      {fixing ? <FixFields teamId={team.id} accent={accent} fix={fix} onChange={setFix} /> : null}

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
              disabled={!valid}
              onPress={() =>
                durationSeconds !== null &&
                correct.mutate({
                  sessionId: session.id,
                  activityTypeId: fix.typeId,
                  intensityId: fix.intensityId,
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
    buttons: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    button: {
      flex: 1,
    },
  });
