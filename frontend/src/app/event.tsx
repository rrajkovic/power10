import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, TextButton } from '@/components/Button';
import { DateField, TimeField } from '@/components/calendar/Pickers';
import { Chips } from '@/components/Chips';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { ErrorText, Label, Muted, Title } from '@/components/Typography';
import { fontSize, fontWeight, radius, spacing, type Palette } from '@/constants/theme';
import { visibleAccent } from '@/lib/color';
import {
  daysAway,
  formatTime,
  KIND_LABELS,
  longDay,
  MAX_REPEATS,
  repeatDates,
  useDeleteEvent,
  useEvent,
  useEventSessions,
  useLinkSession,
  useMyUnlinkedSessions,
  useSaveEvent,
  type CalendarEvent,
  type EventKind,
  type Repeat,
} from '@/lib/calendar';
import { addDays } from '@/lib/progress';
import { formatDuration, todayInTimeZone, useLoggingOptions, useTeamAthletes } from '@/lib/logging';
import { useSession } from '@/lib/session';
import { isDate } from '@/lib/settings';
import { useTeams, type MyTeam } from '@/lib/teams';
import { useTheme, useThemedStyles } from '@/lib/theme';

const KINDS: { value: EventKind; label: string }[] = [
  { value: 'workout', label: 'Workout' },
  { value: 'test', label: 'Test' },
  { value: 'race', label: 'Race' },
  { value: 'other', label: 'Other' },
];

const REPEATS: { value: Repeat['every']; label: string }[] = [
  { value: 'never', label: 'Never' },
  { value: 'day', label: 'Every day' },
  { value: 'week', label: 'Every week' },
  { value: 'two_weeks', label: 'Every 2 weeks' },
];

function close() {
  if (router.canGoBack()) router.back();
  else router.replace('/calendar');
}

// One calendar event. Opened with ?id=… to look at (and, for admins, change)
// an event, or with ?date=… to add a new one on that day.
export default function EventScreen() {
  const styles = useThemedStyles(makeStyles);
  const { id, date } = useLocalSearchParams<{ id?: string; date?: string }>();
  const { currentTeam } = useTeams();
  const event = useEvent(id);

  if (!currentTeam) return null;
  const today = todayInTimeZone(currentTeam.timeZone);

  return (
    <Screen>
      <View style={styles.header}>
        <Title style={styles.title}>{id ? 'On the calendar' : 'Add to calendar'}</Title>
        <TextButton title={id ? 'Done' : 'Cancel'} onPress={close} />
      </View>

      {!id ? (
        currentTeam.isAdmin ? (
          <EventForm team={currentTeam} event={null} startDate={date && isDate(date) ? date : today} onDone={close} />
        ) : (
          <Muted>Only coaches and admins can add to the calendar.</Muted>
        )
      ) : event.isLoading ? (
        <Muted>Loading…</Muted>
      ) : event.isError ? (
        <ErrorText>Couldn’t load this. Check your connection and try again.</ErrorText>
      ) : !event.data ? (
        <Muted>This isn’t on the calendar any more.</Muted>
      ) : (
        <EventDetail key={event.data.id} team={currentTeam} event={event.data} today={today} />
      )}
    </Screen>
  );
}

function EventDetail({ team, event, today }: { team: MyTeam; event: CalendarEvent; today: string }) {
  const styles = useThemedStyles(makeStyles);
  const { scheme } = useTheme();
  const accent = visibleAccent(team.accentPrimary, scheme);
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const remove = useDeleteEvent();

  if (editing) {
    return <EventForm team={team} event={event} startDate={event.event_date} onDone={() => setEditing(false)} />;
  }

  // You can log a scheduled workout on its day or afterwards, not before.
  const canLog = event.kind === 'workout' && event.event_date <= today;

  return (
    <View style={styles.sections}>
      <View style={styles.card}>
        <Label style={{ color: accent }}>{KIND_LABELS[event.kind]}</Label>
        <Text style={styles.eventTitle}>{event.title}</Text>
        <Muted>
          {longDay(event.event_date)}
          {event.start_time ? ` · ${formatTime(event.start_time)}` : ''} · {daysAway(event.event_date, today)}
        </Muted>
        {event.activity ? (
          <Muted>
            {event.activity.name}
            {event.intensity ? ` · ${event.intensity.name}` : ''}
          </Muted>
        ) : null}
        {event.series_id ? <Muted style={styles.small}>Repeats</Muted> : null}
        {event.description ? <Text style={styles.description}>{event.description}</Text> : null}
      </View>

      {event.kind === 'workout' ? (
        <>
          {canLog ? (
            <Button
              title="Log this workout"
              onPress={() => router.push({ pathname: '/log', params: { event: event.id } })}
            />
          ) : (
            <Muted style={styles.small}>You can log this on the day.</Muted>
          )}
          {canLog ? <LinkExisting team={team} event={event} /> : null}
          <WhoDidIt team={team} eventId={event.id} />
        </>
      ) : null}

      {team.isAdmin ? (
        <View style={styles.field}>
          {remove.isError ? <ErrorText>Couldn’t delete: {remove.error.message}.</ErrorText> : null}
          {confirmingDelete ? (
            <>
              <Muted style={styles.small}>
                Take this off the calendar? Workouts already logged for it are kept.
                {event.series_id ? ' This one repeats: you can remove just this day, or this and every later one.' : ''}
              </Muted>
              <Button
                title={event.series_id ? 'Delete only this one' : 'Delete'}
                loading={remove.isPending}
                onPress={() => remove.mutate({ event, andLater: false }, { onSuccess: close })}
              />
              {event.series_id ? (
                <Button
                  title="Delete this and later ones"
                  variant="secondary"
                  disabled={remove.isPending}
                  onPress={() => remove.mutate({ event, andLater: true }, { onSuccess: close })}
                />
              ) : null}
              <Button title="Keep it" variant="secondary" disabled={remove.isPending} onPress={() => setConfirmingDelete(false)} />
            </>
          ) : (
            <View style={styles.buttons}>
              <View style={styles.button}>
                <Button title="Delete" variant="secondary" onPress={() => setConfirmingDelete(true)} />
              </View>
              <View style={styles.button}>
                <Button title="Edit" variant="secondary" onPress={() => setEditing(true)} />
              </View>
            </View>
          )}
        </View>
      ) : null}
    </View>
  );
}

// Everyone sees who has done a scheduled workout; coaches and admins also see
// how many athletes that is out of.
// "I already logged that": your own workouts from the same day that aren't
// linked to anything yet, each with a button to say this was the one.
function LinkExisting({ team, event }: { team: MyTeam; event: CalendarEvent }) {
  const styles = useThemedStyles(makeStyles);
  const { session } = useSession();
  const mine = useMyUnlinkedSessions(team.id, session?.user.id, event.event_date, true);
  const link = useLinkSession();
  if (!mine.data?.length) return null;

  return (
    <View style={styles.card}>
      <Label>Already logged it?</Label>
      <Muted style={styles.small}>
        You logged {mine.data.length === 1 ? 'a workout' : 'workouts'} on this day. If one of them
        was this workout, link it.
      </Muted>
      {link.isError ? <ErrorText>Couldn’t link it: {link.error.message}.</ErrorText> : null}
      {mine.data.map((workout) => (
        <View key={workout.id} style={styles.doneRow}>
          <Text style={styles.doneName}>
            {workout.activity?.name ?? 'Workout'} · {formatDuration(workout.duration_seconds)}
          </Text>
          <TextButton
            title="Link"
            disabled={link.isPending}
            onPress={() => link.mutate({ sessionId: workout.id, eventId: event.id })}
          />
        </View>
      ))}
    </View>
  );
}

function WhoDidIt({ team, eventId }: { team: MyTeam; eventId: string }) {
  const styles = useThemedStyles(makeStyles);
  const { session: auth } = useSession();
  const unlink = useLinkSession();
  const sessions = useEventSessions(eventId);
  const athletes = useTeamAthletes(team.id, team.isAdmin);
  const done = sessions.data ?? [];
  // "3 of 13 athletes": count people, not workouts (someone may log it
  // twice), and only athletes (a coach who did it isn't one of the 13).
  const athleteIds = new Set((athletes.data ?? []).map((athlete) => athlete.id));
  const people = new Set(
    done.map((session) => session.athlete_id).filter((id) => athleteIds.has(id)),
  ).size;

  return (
    <View style={styles.card}>
      <Label>Done by</Label>
      {sessions.isLoading ? (
        <Muted style={styles.small}>Loading…</Muted>
      ) : done.length === 0 ? (
        <Muted style={styles.small}>Nobody yet.</Muted>
      ) : (
        <>
          {team.isAdmin && athletes.data ? (
            <Muted style={styles.small}>
              {people} of {athletes.data.length} athletes
            </Muted>
          ) : null}
          {done.map((session) => (
            <View key={session.id} style={styles.doneRow}>
              <Text style={styles.doneName}>{session.athlete?.name || 'Unnamed'}</Text>
              <Muted style={styles.small}>{formatDuration(session.duration_seconds)}</Muted>
              {/* Linked the wrong one? Your own can be taken off again. */}
              {session.athlete_id === auth?.user.id ? (
                <TextButton
                  title="Unlink"
                  disabled={unlink.isPending}
                  onPress={() => unlink.mutate({ sessionId: session.id, eventId: null })}
                />
              ) : null}
            </View>
          ))}
        </>
      )}
    </View>
  );
}

function EventForm({
  team,
  event,
  startDate,
  onDone,
}: {
  team: MyTeam;
  event: CalendarEvent | null;
  startDate: string;
  onDone: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const { scheme } = useTheme();
  const { session } = useSession();
  const accent = visibleAccent(team.accentPrimary, scheme);
  const options = useLoggingOptions(team.id);
  const save = useSaveEvent();

  const [kind, setKind] = useState<EventKind>(event?.kind ?? 'workout');
  const [title, setTitle] = useState(event?.title ?? '');
  const [date, setDate] = useState(startDate);
  const [time, setTime] = useState<string | null>(event?.start_time ? event.start_time.slice(0, 5) : null);
  // Repeating is chosen when adding; afterwards each event is its own.
  const [every, setEvery] = useState<Repeat['every']>('never');
  const [until, setUntil] = useState(addDays(startDate, 28));
  const [description, setDescription] = useState(event?.description ?? '');
  const [activityTypeId, setActivityTypeId] = useState<string | null>(event?.activity_type_id ?? null);
  const [intensityId, setIntensityId] = useState<string | null>(event?.intensity_id ?? null);
  const [tried, setTried] = useState(false);

  const titleError = !title.trim() ? 'Give it a name' : null;
  const repeat: Repeat = every === 'never' ? { every } : { every, until };
  const dates = repeatDates(date, repeat);
  const untilError = every !== 'never' && until < date ? 'On or after the first day' : null;

  function submit() {
    setTried(true);
    if (titleError || untilError || !session) return;
    const values = {
      kind,
      title,
      description: description.trim() || null,
      date,
      startTime: time,
      activityTypeId,
      intensityId,
    };
    save.mutate(
      event
        ? { eventId: event.id, values }
        : { eventId: null, teamId: team.id, userId: session.user.id, values, repeat },
      { onSuccess: onDone },
    );
  }

  return (
    <View style={styles.sections}>
      <View style={styles.field}>
        <Label>What is it</Label>
        <Chips options={KINDS} value={kind} onChange={(value) => value && setKind(value)} accent={accent} />
      </View>

      <TextField
        label="Name"
        placeholder={kind === 'race' ? 'Head of the Charles' : kind === 'test' ? '2k test' : kind === 'workout' ? '3 × 20 min steady state' : 'Team meeting'}
        value={title}
        onChangeText={setTitle}
        maxLength={120}
        error={tried ? titleError : null}
      />

      <DateField label="Date" value={date} onChange={setDate} accent={accent} />
      <TimeField label="Time (optional)" value={time} onChange={setTime} accent={accent} />

      {event ? null : (
        <View style={styles.field}>
          <Label>Repeat</Label>
          <Chips
            options={REPEATS}
            value={every}
            onChange={(value) => value && setEvery(value)}
            accent={accent}
          />
          {every !== 'never' ? (
            <>
              <DateField
                label="Until"
                value={until}
                onChange={setUntil}
                accent={accent}
                earliest={date}
                error={untilError}
              />
              <Muted style={styles.small}>
                Adds {dates.length} {dates.length === 1 ? 'event' : 'events'}
                {dates.length >= MAX_REPEATS ? ` (the most one series can have)` : ''}. Each can be
                changed or removed on its own afterwards.
              </Muted>
            </>
          ) : null}
        </View>
      )}

      {kind === 'workout' ? (
        <>
          <View style={styles.field}>
            <Label>Log it as (optional)</Label>
            <Muted style={styles.small}>
              Athletes who tap “Log this workout” start with this filled in.
            </Muted>
            <Chips
              options={(options.data?.types ?? []).map((type) => ({ value: type.id, label: type.name }))}
              value={activityTypeId}
              onChange={setActivityTypeId}
              accent={accent}
              allowNone
            />
          </View>
          {options.data?.intensities.length ? (
            <View style={styles.field}>
              <Label>Intensity (optional)</Label>
              <Chips
                options={options.data.intensities.map((i) => ({ value: i.id, label: i.name }))}
                value={intensityId}
                onChange={setIntensityId}
                accent={accent}
                allowNone
              />
            </View>
          ) : null}
        </>
      ) : null}

      <TextField
        label="Details (optional)"
        placeholder="Where, what to bring, the plan…"
        value={description}
        onChangeText={setDescription}
        multiline
        maxLength={4000}
        style={styles.notes}
      />

      {save.isError ? <ErrorText>Couldn’t save: {save.error.message}.</ErrorText> : null}
      <View style={styles.buttons}>
        {event ? (
          <View style={styles.button}>
            <Button title="Cancel" variant="secondary" disabled={save.isPending} onPress={onDone} />
          </View>
        ) : null}
        <View style={styles.button}>
          <Button
            title={event ? 'Save' : dates.length > 1 ? `Add ${dates.length} to calendar` : 'Add to calendar'}
            loading={save.isPending}
            onPress={submit}
          />
        </View>
      </View>
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
      gap: spacing.lg,
    },
    field: {
      gap: spacing.sm,
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
    eventTitle: {
      fontSize: fontSize.xl,
      fontWeight: fontWeight.bold,
      color: colors.text,
    },
    description: {
      fontSize: fontSize.md,
      color: colors.text,
      marginTop: spacing.sm,
    },
    buttons: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    button: {
      flex: 1,
    },
    notes: {
      minHeight: 88,
      textAlignVertical: 'top',
    },
    doneRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: spacing.md,
      paddingVertical: spacing.xs,
    },
    doneName: {
      fontSize: fontSize.md,
      color: colors.text,
    },
  });
