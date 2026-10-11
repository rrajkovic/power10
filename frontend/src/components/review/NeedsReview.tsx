import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, TextButton } from '@/components/Button';
import { ErrorText, Label, Muted } from '@/components/Typography';
import { fontSize, fontWeight, radius, spacing, type Palette } from '@/constants/theme';
import { visibleAccent } from '@/lib/color';
import { todayInTimeZone } from '@/lib/logging';
import {
  responseLabel,
  useCorrectAndApprove,
  useFlaggedSessions,
  useReviewSession,
  type FlaggedSession,
} from '@/lib/review';
import type { MyTeam } from '@/lib/teams';
import { useTheme, useThemedStyles } from '@/lib/theme';
import { FixFields, fixFrom, readFix } from './FixFields';
import { SessionSummary } from './SessionSummary';

// Team tab, coaches and admins only: workouts the photo check flagged, with
// the athlete's answer. A coach can approve, reject or fix the numbers at any
// point, without waiting for the athlete.
export function NeedsReview({ team }: { team: MyTeam }) {
  const styles = useThemedStyles(makeStyles);
  const flagged = useFlaggedSessions(team.id, team.isAdmin);
  const today = todayInTimeZone(team.timeZone);

  if (!team.isAdmin || !flagged.data) return null;

  return (
    <View style={styles.card}>
      <Label>Needs review</Label>
      {flagged.data.length === 0 ? (
        <Muted style={styles.small}>Nothing to review. 🎉</Muted>
      ) : (
        flagged.data.map((session) => (
          <Row key={session.id} session={session} team={team} today={today} />
        ))
      )}
    </View>
  );
}

function Row({ session, team, today }: { session: FlaggedSession; team: MyTeam; today: string }) {
  const styles = useThemedStyles(makeStyles);
  const { scheme } = useTheme();
  const accent = visibleAccent(team.accentPrimary, scheme);
  const review = useReviewSession();
  const correct = useCorrectAndApprove();
  const answered = session.athlete_response !== null;

  // A coach can also put the right numbers in themselves.
  const [fixing, setFixing] = useState(false);
  const [fix, setFix] = useState(() => fixFrom(session));
  const { durationSeconds, distanceMeters, valid } = readFix(fix);
  const busy = review.isPending || correct.isPending;
  const error = review.error ?? correct.error;

  return (
    <View style={styles.row}>
      <View style={styles.rowHeader}>
        <Text style={styles.name}>{session.athlete_name || 'Unnamed'}</Text>
        <View style={[styles.badge, answered && styles.badgeAnswered]}>
          <Text style={[styles.badgeText, answered && styles.badgeTextAnswered]}>
            {responseLabel(session.athlete_response)}
          </Text>
        </View>
      </View>
      <SessionSummary session={session} today={today} />
      {session.athlete_response_note ? (
        <Muted style={styles.small}>
          {session.athlete_name?.split(' ')[0] || 'Athlete'}: “{session.athlete_response_note}”
        </Muted>
      ) : null}

      {fixing ? <FixFields teamId={team.id} accent={accent} fix={fix} onChange={setFix} /> : null}
      {error ? <ErrorText>Couldn’t save: {error.message}.</ErrorText> : null}

      {fixing ? (
        <View style={styles.buttons}>
          <View style={styles.button}>
            <Button title="Back" variant="secondary" disabled={busy} onPress={() => setFixing(false)} />
          </View>
          <View style={styles.button}>
            <Button
              title="Save and approve"
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
                  note: '',
                })
              }
            />
          </View>
        </View>
      ) : (
        <>
          <View style={styles.buttons}>
            <View style={styles.button}>
              <Button
                title="Reject"
                variant="secondary"
                disabled={busy}
                onPress={() => review.mutate({ sessionId: session.id, approve: false })}
              />
            </View>
            <View style={styles.button}>
              <Button
                title="Approve"
                loading={review.isPending}
                onPress={() => review.mutate({ sessionId: session.id, approve: true })}
              />
            </View>
          </View>
          <View style={styles.fixLink}>
            <TextButton title="Fix the numbers" disabled={busy} onPress={() => setFixing(true)} />
          </View>
        </>
      )}
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    card: {
      gap: spacing.md,
      marginHorizontal: spacing.xl,
      padding: spacing.xl,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    small: {
      fontSize: fontSize.sm,
    },
    row: {
      gap: spacing.md,
      paddingTop: spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    rowHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    name: {
      flex: 1,
      fontSize: fontSize.md,
      fontWeight: fontWeight.bold,
      color: colors.text,
    },
    badge: {
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm + 2,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
    },
    badgeAnswered: {
      borderColor: colors.text,
    },
    badgeText: {
      fontSize: fontSize.xs,
      fontWeight: fontWeight.semibold,
      color: colors.textMuted,
    },
    badgeTextAnswered: {
      color: colors.text,
    },
    buttons: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    button: {
      flex: 1,
    },
    fixLink: {
      alignItems: 'center',
    },
  });
