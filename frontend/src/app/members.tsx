import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '@/components/Avatar';
import { Button, TextButton } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { ErrorText, Label, Muted, Title } from '@/components/Typography';
import { fontSize, fontWeight, monoFont, radius, spacing, type Palette } from '@/constants/theme';
import { visibleAccent } from '@/lib/color';
import {
  hasCoachRights,
  useInvites,
  useMemberChange,
  useMembers,
  type Member,
  type MemberChange,
} from '@/lib/members';
import { useSession } from '@/lib/session';
import { useTeams, type MyTeam } from '@/lib/teams';
import { useTheme, useThemedStyles } from '@/lib/theme';

// The team's roster. Everyone can see it; admins can invite and remove
// people, and coaches can change roles. Opened from the Team tab.
export default function Members() {
  const styles = useThemedStyles(makeStyles);
  const { scheme } = useTheme();
  const { session } = useSession();
  const { currentTeam } = useTeams();
  const members = useMembers(currentTeam?.id);
  const change = useMemberChange();

  if (!currentTeam) return null;
  const accent = visibleAccent(currentTeam.accentPrimary, scheme);
  const all = members.data ?? [];
  const me = all.find((member) => member.id === session?.user.id);
  const coachRights = hasCoachRights(me, all);
  const coaches = all.filter((member) => member.role === 'coach');
  const athletes = all.filter((member) => member.role === 'athlete');

  const list = (title: string, people: Member[]) =>
    people.length ? (
      <View style={styles.card}>
        <Label>
          {title} ({people.length})
        </Label>
        {people.map((member) => (
          <MemberRow
            key={member.id}
            member={member}
            team={currentTeam}
            accent={accent}
            isMe={member.id === me?.id}
            iAmAdmin={currentTeam.isAdmin}
            coachRights={coachRights}
            busy={change.isPending}
            onChange={change.mutate}
          />
        ))}
      </View>
    ) : null;

  return (
    <Screen>
      <View style={styles.header}>
        <Title style={styles.title}>Members</Title>
        <TextButton title="Done" onPress={() => router.back()} />
      </View>

      {change.isError ? <ErrorText>Couldn’t do that: {change.error.message}.</ErrorText> : null}

      {currentTeam.isAdmin ? (
        <Invites team={currentTeam} busy={change.isPending} onChange={change.mutate} />
      ) : null}

      {members.isLoading ? (
        <Muted>Loading…</Muted>
      ) : members.isError ? (
        <ErrorText>Couldn’t load the team. Check your connection and try again.</ErrorText>
      ) : (
        <>
          {list('Coaches', coaches)}
          {list('Athletes', athletes)}
        </>
      )}

      <LeaveTeam team={currentTeam} busy={change.isPending} onChange={change.mutate} />
    </Screen>
  );
}

function MemberRow({
  member,
  team,
  accent,
  isMe,
  iAmAdmin,
  coachRights,
  busy,
  onChange,
}: {
  member: Member;
  team: MyTeam;
  accent: string;
  isMe: boolean;
  iAmAdmin: boolean;
  coachRights: boolean;
  busy: boolean;
  onChange: (change: MemberChange) => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const [open, setOpen] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const isCoach = member.role === 'coach';

  // The same rules the database enforces, to decide which buttons to show.
  const canMakeCoach = coachRights && !isCoach;
  // A coach can be turned back into an athlete by a coach, or by themselves.
  const canMakeAthlete = isCoach && (coachRights || isMe);
  // Coaches are always admins, so this is only about athletes.
  const canChangeAdmin = coachRights && !isCoach;
  // Yourself you "leave"; coaches can only be removed with coach rights.
  const canRemove = !isMe && (isCoach ? coachRights : iAmAdmin);
  const hasActions = canMakeCoach || canMakeAthlete || canChangeAdmin || canRemove;

  const base = { teamId: team.id, memberId: member.id };

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole={hasActions ? 'button' : undefined}
        accessibilityLabel={hasActions ? `${member.name}. Manage` : member.name}
        disabled={!hasActions}
        onPress={() => {
          setOpen(!open);
          setConfirmingRemove(false);
        }}
        style={({ pressed }) => [styles.rowHeader, pressed && styles.pressed]}
      >
        <Avatar name={member.name} color={accent} size={36} />
        <Text style={styles.name} numberOfLines={1}>
          {member.name}
          {isMe ? ' (you)' : ''}
        </Text>
        {member.isAdmin && !isCoach ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Admin</Text>
          </View>
        ) : null}
        {hasActions ? <Muted style={styles.chevron}>{open ? '⌃' : '⌄'}</Muted> : null}
      </Pressable>

      {open ? (
        <View style={styles.actions}>
          {canMakeCoach ? (
            <Button
              title="Make coach"
              variant="secondary"
              disabled={busy}
              onPress={() => onChange({ kind: 'role', ...base, role: 'coach' })}
            />
          ) : null}
          {canMakeAthlete ? (
            <Button
              title={isMe ? 'Become an athlete' : 'Make athlete'}
              variant="secondary"
              disabled={busy}
              onPress={() => onChange({ kind: 'role', ...base, role: 'athlete' })}
            />
          ) : null}
          {canChangeAdmin ? (
            <Button
              title={member.isAdmin ? 'Remove admin' : 'Make admin'}
              variant="secondary"
              disabled={busy}
              onPress={() => onChange({ kind: 'admin', ...base, makeAdmin: !member.isAdmin })}
            />
          ) : null}
          {canRemove ? (
            confirmingRemove ? (
              <>
                <Muted style={styles.small}>
                  Remove {member.name} from {team.name}? Their workouts stay in the team’s history.
                  They can join again with an invite code.
                </Muted>
                <View style={styles.buttons}>
                  <View style={styles.button}>
                    <Button title="Keep" variant="secondary" disabled={busy} onPress={() => setConfirmingRemove(false)} />
                  </View>
                  <View style={styles.button}>
                    <Button title="Remove" disabled={busy} onPress={() => onChange({ kind: 'remove', ...base })} />
                  </View>
                </View>
              </>
            ) : (
              <Button title="Remove from team" variant="secondary" disabled={busy} onPress={() => setConfirmingRemove(true)} />
            )
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

// Invite codes, one for athletes and one for coaches.
function Invites({
  team,
  busy,
  onChange,
}: {
  team: MyTeam;
  busy: boolean;
  onChange: (change: MemberChange) => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const invites = useInvites(team.id, team.isAdmin);
  // The role whose code was just copied, and the one being reset.
  const [copied, setCopied] = useState<string | null>(null);
  const [resetting, setResetting] = useState<string | null>(null);

  async function share(role: 'athlete' | 'coach', code: string) {
    const message = `Join ${team.name} on Power10${role === 'coach' ? ' as a coach' : ''}. Open the app, choose “Join a team” and enter the code ${code}`;
    if (Platform.OS === 'web') {
      // Browsers copy; phones open the share sheet.
      await navigator.clipboard?.writeText(message).catch(() => {});
      setCopied(role);
    } else {
      await Share.share({ message }).catch(() => {});
    }
  }

  return (
    <View style={styles.card}>
      <Label>Invite codes</Label>
      <Muted style={styles.small}>
        Anyone with a code can join straight away. The coach code makes someone a coach, so share
        it carefully.
      </Muted>
      {invites.isLoading ? <Muted style={styles.small}>Loading…</Muted> : null}
      {(['athlete', 'coach'] as const).map((role) => {
        const invite = invites.data?.find((item) => item.role === role);
        if (!invite) return null;
        return (
          <View key={role} style={styles.invite}>
            <View style={styles.inviteHeader}>
              <Text style={styles.name}>{role === 'coach' ? 'For coaches' : 'For athletes'}</Text>
              <Text selectable style={styles.code}>
                {invite.code}
              </Text>
            </View>
            {resetting === role ? (
              <>
                <Muted style={styles.small}>
                  Make a new code? The current one stops working straight away. People already on
                  the team aren’t affected.
                </Muted>
                <View style={styles.buttons}>
                  <View style={styles.button}>
                    <Button title="Keep it" variant="secondary" disabled={busy} onPress={() => setResetting(null)} />
                  </View>
                  <View style={styles.button}>
                    <Button
                      title="New code"
                      disabled={busy}
                      onPress={() => {
                        onChange({ kind: 'reset_invite', teamId: team.id, role });
                        setResetting(null);
                        setCopied(null);
                      }}
                    />
                  </View>
                </View>
              </>
            ) : (
              <View style={styles.buttons}>
                <View style={styles.button}>
                  <Button title="Reset" variant="secondary" disabled={busy} onPress={() => setResetting(role)} />
                </View>
                <View style={styles.button}>
                  <Button
                    title={Platform.OS === 'web' ? (copied === role ? 'Copied ✓' : 'Copy invite') : 'Share'}
                    onPress={() => share(role, invite.code)}
                  />
                </View>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

function LeaveTeam({
  team,
  busy,
  onChange,
}: {
  team: MyTeam;
  busy: boolean;
  onChange: (change: MemberChange) => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const [confirming, setConfirming] = useState(false);

  return (
    <View style={styles.leave}>
      {confirming ? (
        <>
          <Muted style={styles.small}>
            Leave {team.name}? You’ll lose access to the team. Your workouts stay in its history.
            If you’re the last member, the team is deleted.
          </Muted>
          <View style={styles.buttons}>
            <View style={styles.button}>
              <Button title="Stay" variant="secondary" disabled={busy} onPress={() => setConfirming(false)} />
            </View>
            <View style={styles.button}>
              <Button
                title="Leave"
                disabled={busy}
                // After leaving, the app moves on by itself: to another of
                // your teams, or to "join or create a team".
                onPress={() => onChange({ kind: 'leave', teamId: team.id })}
              />
            </View>
          </View>
        </>
      ) : (
        <View style={styles.center}>
          <TextButton title="Leave this team" onPress={() => setConfirming(true)} />
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
    card: {
      gap: spacing.md,
      padding: spacing.lg,
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
      gap: spacing.md,
    },
    pressed: {
      opacity: 0.6,
    },
    name: {
      flex: 1,
      fontSize: fontSize.md,
      fontWeight: fontWeight.semibold,
      color: colors.text,
    },
    badge: {
      paddingVertical: 2,
      paddingHorizontal: spacing.sm,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
    },
    badgeText: {
      fontSize: fontSize.xs,
      fontWeight: fontWeight.semibold,
      color: colors.textMuted,
    },
    chevron: {
      fontSize: fontSize.md,
    },
    actions: {
      gap: spacing.sm,
    },
    buttons: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    button: {
      flex: 1,
    },
    invite: {
      gap: spacing.md,
      paddingTop: spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    inviteHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    code: {
      fontFamily: monoFont,
      fontSize: fontSize.lg,
      fontWeight: fontWeight.bold,
      letterSpacing: 2,
      color: colors.text,
    },
    leave: {
      gap: spacing.md,
      marginTop: spacing.lg,
    },
    center: {
      alignItems: 'center',
    },
  });
