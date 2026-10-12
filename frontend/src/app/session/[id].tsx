import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, TextButton } from '@/components/Button';
import { SessionCard } from '@/components/feed/SessionCard';
import { FixFields, fixFrom, readFix } from '@/components/review/FixFields';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { ErrorText, Label, Muted, Title } from '@/components/Typography';
import { fontSize, fontWeight, radius, spacing, type Palette } from '@/constants/theme';
import { visibleAccent } from '@/lib/color';
import {
  timeAgo,
  useAddComment,
  useComments,
  useDeleteComment,
  useDeleteSession,
  useEditComment,
  useFeedSession,
  useUpdateSession,
  type Comment,
  type FeedSession,
} from '@/lib/feed';
import { dayLabel, daysBefore, todayInTimeZone } from '@/lib/logging';
import { addDays } from '@/lib/progress';
import { useSession } from '@/lib/session';
import { useTeams, type MyTeam } from '@/lib/teams';
import { useTheme, useThemedStyles } from '@/lib/theme';
import { describeWindow, earliestAllowed, isInWindow } from '@/lib/windows';

// Back to wherever this was opened from. Opened straight from a link there's
// nothing to go back to, so go to the Feed.
function close() {
  if (router.canGoBack()) router.back();
  else router.replace('/feed');
}

// One workout, opened from the Feed: the full card, comments, and (for its
// athlete or an admin) editing and deleting.
export default function SessionScreen() {
  const styles = useThemedStyles(makeStyles);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { currentTeam } = useTeams();
  const session = useFeedSession(id);

  if (!currentTeam) return null;

  return (
    <Screen>
      <View style={styles.header}>
        <Title style={styles.title}>Workout</Title>
        <TextButton title="Done" onPress={() => close()} />
      </View>
      {session.isLoading ? (
        <Muted>Loading…</Muted>
      ) : session.isError ? (
        <ErrorText>Couldn’t load this workout. Check your connection and try again.</ErrorText>
      ) : !session.data ? (
        <Muted>This workout isn’t there any more.</Muted>
      ) : (
        <SessionDetail key={session.data.id} session={session.data} team={currentTeam} />
      )}
    </Screen>
  );
}

function SessionDetail({ session, team }: { session: FeedSession; team: MyTeam }) {
  const styles = useThemedStyles(makeStyles);
  const { scheme } = useTheme();
  const { session: auth } = useSession();
  const userId = auth?.user.id;
  const accent = visibleAccent(team.accentPrimary, scheme);
  const today = todayInTimeZone(team.timeZone);

  const isMine = session.athlete_id === userId;
  // Admins always can. Athletes can while the workout is inside the team's
  // edit window.
  const tooOld = !team.isAdmin && !isInWindow(team.editWindow, today, session.session_date);
  const canChange = team.isAdmin || (isMine && !tooOld);
  const [editing, setEditing] = useState(false);

  return (
    <View style={styles.sections}>
      {editing ? (
        <EditForm session={session} team={team} accent={accent} today={today} onDone={() => setEditing(false)} />
      ) : (
        <>
          <SessionCard
            session={session}
            accent={accent}
            today={today}
            showVerification={isMine || team.isAdmin}
            detail
          />
          {canChange ? <ChangeButtons session={session} onEdit={() => setEditing(true)} /> : null}
          {isMine && tooOld ? (
            <Muted style={styles.small}>
              This workout can’t be changed any more (your team allows changes{' '}
              {describeWindow(team.editWindow)}). Ask a coach if something’s wrong.
            </Muted>
          ) : null}
          <Comments session={session} team={team} accent={accent} />
        </>
      )}
    </View>
  );
}

// Edit, and a delete that asks twice.
function ChangeButtons({ session, onEdit }: { session: FeedSession; onEdit: () => void }) {
  const styles = useThemedStyles(makeStyles);
  const remove = useDeleteSession();
  const [confirming, setConfirming] = useState(false);

  return (
    <View style={styles.field}>
      {remove.isError ? <ErrorText>Couldn’t delete: {remove.error.message}.</ErrorText> : null}
      {confirming ? (
        <>
          <Muted style={styles.small}>
            Delete this workout? Its credits, photos, comments and reactions go with it. This can’t
            be undone.
          </Muted>
          <View style={styles.buttons}>
            <View style={styles.button}>
              <Button title="Keep it" variant="secondary" disabled={remove.isPending} onPress={() => setConfirming(false)} />
            </View>
            <View style={styles.button}>
              <Button
                title="Delete"
                loading={remove.isPending}
                onPress={() => remove.mutate(session.id, { onSuccess: () => close() })}
              />
            </View>
          </View>
        </>
      ) : (
        <View style={styles.buttons}>
          <View style={styles.button}>
            <Button title="Delete" variant="secondary" onPress={() => setConfirming(true)} />
          </View>
          <View style={styles.button}>
            <Button title="Edit" variant="secondary" onPress={onEdit} />
          </View>
        </View>
      )}
    </View>
  );
}

function EditForm({
  session,
  team,
  accent,
  today,
  onDone,
}: {
  session: FeedSession;
  team: MyTeam;
  accent: string;
  today: string;
  onDone: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const update = useUpdateSession();
  const [fix, setFix] = useState(() => fixFrom(session));
  const [daysAgo, setDaysAgo] = useState(() => Math.max(0, daysBefore(session.session_date, today)));
  const [notes, setNotes] = useState(session.notes ?? '');
  const { durationSeconds, distanceMeters, valid } = readFix(fix);
  const date = addDays(today, -daysAgo);
  // Athletes can't move a workout to a day they couldn't log.
  const earliest = team.isAdmin ? null : earliestAllowed(team.logWindow, today);
  const maxDaysAgo = earliest === null ? null : daysBefore(earliest, today);
  const wasVerified =
    !team.isAdmin &&
    session.verification_status !== null &&
    session.verification_status !== 'not_needed';

  return (
    <View style={styles.sections}>
      {wasVerified ? (
        <Muted style={styles.small}>
          This workout has been checked. If you change the activity, time, distance or day, a coach
          will be asked to look at it again.
        </Muted>
      ) : null}
      <FixFields teamId={team.id} accent={accent} fix={fix} onChange={setFix} />

      <View style={styles.field}>
        <Label>When</Label>
        <View style={styles.dateRow}>
          <DayButton
            label="‹"
            accessibilityLabel="Previous day"
            disabled={maxDaysAgo !== null && daysAgo >= maxDaysAgo}
            onPress={() => setDaysAgo(daysAgo + 1)}
          />
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

      {update.isError ? <ErrorText>Couldn’t save: {update.error.message}.</ErrorText> : null}
      <View style={styles.buttons}>
        <View style={styles.button}>
          <Button title="Cancel" variant="secondary" disabled={update.isPending} onPress={onDone} />
        </View>
        <View style={styles.button}>
          <Button
            title="Save"
            loading={update.isPending}
            disabled={!valid}
            onPress={() =>
              durationSeconds !== null &&
              update.mutate(
                {
                  sessionId: session.id,
                  activityTypeId: fix.typeId,
                  intensityId: fix.intensityId,
                  durationSeconds,
                  distanceMeters,
                  date,
                  notes: notes.trim() || null,
                },
                { onSuccess: onDone },
              )
            }
          />
        </View>
      </View>
    </View>
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

function Comments({ session, team, accent }: { session: FeedSession; team: MyTeam; accent: string }) {
  const styles = useThemedStyles(makeStyles);
  const { session: auth } = useSession();
  const userId = auth?.user.id;
  const comments = useComments(session.id);
  const add = useAddComment();
  const [body, setBody] = useState('');

  function send() {
    if (!body.trim()) return;
    add.mutate({ session, body }, { onSuccess: () => setBody('') });
  }

  return (
    <View style={styles.field}>
      <Label>Comments</Label>
      {comments.data?.length === 0 ? <Muted style={styles.small}>No comments yet.</Muted> : null}
      {comments.data?.map((comment) => (
        <CommentRow
          key={comment.id}
          comment={comment}
          isAuthor={comment.author_id === userId}
          canDelete={comment.author_id === userId || team.isAdmin}
          highlight={comment.author_id === session.athlete_id ? accent : null}
        />
      ))}

      <TextField
        placeholder="Write a comment"
        value={body}
        onChangeText={setBody}
        multiline
        maxLength={2000}
      />
      {add.isError ? <ErrorText>Couldn’t post: {add.error.message}.</ErrorText> : null}
      <Button title="Post comment" onPress={send} loading={add.isPending} disabled={!body.trim()} />
    </View>
  );
}

// One comment. Its author can edit it; its author or an admin can delete it.
function CommentRow({
  comment,
  isAuthor,
  canDelete,
  highlight,
}: {
  comment: Comment;
  isAuthor: boolean;
  canDelete: boolean;
  // The team color, for comments by the workout's own athlete.
  highlight: string | null;
}) {
  const styles = useThemedStyles(makeStyles);
  const edit = useEditComment();
  const remove = useDeleteComment();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(comment.body);

  return (
    <View style={styles.comment}>
      <View style={styles.commentHeader}>
        <Text style={[styles.commentAuthor, highlight ? { color: highlight } : null]}>
          {comment.author?.name || 'Unnamed'}
        </Text>
        <Muted style={styles.small}>
          {timeAgo(comment.created_at)}
          {comment.edited_at ? ' · edited' : ''}
        </Muted>
        {editing ? null : (
          <View style={styles.commentActions}>
            {isAuthor ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Edit comment"
                onPress={() => {
                  setText(comment.body);
                  setEditing(true);
                }}
                hitSlop={8}
              >
                <Muted style={styles.small}>Edit</Muted>
              </Pressable>
            ) : null}
            {canDelete ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Delete comment"
                onPress={() => remove.mutate(comment.id)}
                hitSlop={8}
              >
                <Muted style={styles.small}>Delete</Muted>
              </Pressable>
            ) : null}
          </View>
        )}
      </View>

      {editing ? (
        <View style={styles.field}>
          <TextField value={text} onChangeText={setText} multiline maxLength={2000} autoFocus />
          {edit.isError ? <ErrorText>Couldn’t save: {edit.error.message}.</ErrorText> : null}
          <View style={styles.buttons}>
            <View style={styles.button}>
              <Button title="Cancel" variant="secondary" disabled={edit.isPending} onPress={() => setEditing(false)} />
            </View>
            <View style={styles.button}>
              <Button
                title="Save"
                loading={edit.isPending}
                disabled={!text.trim() || text.trim() === comment.body}
                onPress={() =>
                  edit.mutate(
                    { commentId: comment.id, body: text },
                    { onSuccess: () => setEditing(false) },
                  )
                }
              />
            </View>
          </View>
        </View>
      ) : (
        <Text style={styles.commentBody}>{comment.body}</Text>
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
    sections: {
      gap: spacing.xl,
    },
    field: {
      gap: spacing.sm,
    },
    small: {
      fontSize: fontSize.sm,
    },
    buttons: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    button: {
      flex: 1,
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
    notes: {
      minHeight: 88,
      textAlignVertical: 'top',
    },
    comment: {
      gap: 2,
      paddingVertical: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    commentHeader: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: spacing.sm,
    },
    commentAuthor: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
      color: colors.text,
    },
    commentActions: {
      flexDirection: 'row',
      gap: spacing.md,
      marginLeft: 'auto',
    },
    commentBody: {
      fontSize: fontSize.md,
      color: colors.text,
    },
  });
