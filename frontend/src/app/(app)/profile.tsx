import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Chips } from '@/components/Chips';
import { HomeHeader } from '@/components/home/HomeHeader';
import { TeamGlow } from '@/components/home/TeamGlow';
import { Card, SavedField } from '@/components/settings/parts';
import { TabScrollView } from '@/components/TabScrollView';
import { TextField } from '@/components/TextField';
import { ErrorText, Headline, Label, Muted } from '@/components/Typography';
import { fontSize, fontWeight, spacing, type Palette } from '@/constants/theme';
import { visibleAccent } from '@/lib/color';
import type { ThemePreference } from '@/lib/deviceMemory';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useTeams } from '@/lib/teams';
import { setThemePreference, useTheme, useThemedStyles, useThemePreference } from '@/lib/theme';

const THEMES: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'Same as phone' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const MIN_PASSWORD_LENGTH = 8;

// Your account: name, appearance, teams, password, signing out.
export default function Profile() {
  const styles = useThemedStyles(makeStyles);
  const { scheme } = useTheme();
  const { session } = useSession();
  const { teams, currentTeam, selectTeam } = useTeams();
  const themePreference = useThemePreference();

  const user = session?.user;
  // The name lives in two places: the sign-in record (what this device has
  // at hand) and the profile teammates see. Both are updated together.
  const [name, setName] = useState<string>(user?.user_metadata?.name ?? '');
  const rename = useMutation({
    mutationFn: async (newName: string) => {
      const profile = await supabase.from('profiles').update({ name: newName }).eq('id', user!.id);
      if (profile.error) throw profile.error;
      const account = await supabase.auth.updateUser({ data: { name: newName } });
      if (account.error) throw account.error;
    },
    onSuccess: (_, newName) => setName(newName),
  });

  if (!user || !currentTeam) return null;
  const accent = visibleAccent(currentTeam.accentPrimary, scheme);

  return (
    <TabScrollView
      background={<TeamGlow primary={currentTeam.accentPrimary} secondary={currentTeam.accentSecondary} />}
      header={<HomeHeader accent={accent} />}
    >
      <View style={styles.wrapper}>
        <View style={styles.heading}>
          <Avatar name={name} color={accent} size={64} />
          <View style={styles.headingText}>
            <Label>Profile</Label>
            <Headline numberOfLines={2}>{name || 'You'}</Headline>
          </View>
        </View>

        <Card title="Name" hint="What teammates see on the leaderboard and the feed.">
          <SavedField
            saved={name}
            onSave={(text) => rename.mutate(text)}
            check={(text) =>
              text.trim().length < 1 || text.trim().length > 80 ? 'Between 1 and 80 letters' : null
            }
          />
          {rename.isError ? <ErrorText>Couldn’t save: {rename.error.message}.</ErrorText> : null}
        </Card>

        <Card title="Email">
          <Text selectable style={styles.value}>
            {user.email}
          </Text>
          <Muted style={styles.small}>
            You sign in with this. Changing it, and adding a school email, comes later.
          </Muted>
        </Card>

        <Card title="Appearance" hint="Remembered on this device.">
          <Chips
            options={THEMES}
            value={themePreference}
            onChange={(value) => value && setThemePreference(value)}
            accent={accent}
          />
        </Card>

        <Card
          title={teams.length > 1 ? 'Your teams' : 'Your team'}
          hint={teams.length > 1 ? 'Tap a team to switch to it.' : undefined}
        >
          {teams.map((team) => {
            const isCurrent = team.id === currentTeam.id;
            return (
              <Pressable
                key={team.id}
                accessibilityRole="button"
                accessibilityState={{ selected: isCurrent }}
                accessibilityLabel={`${team.name}${isCurrent ? ', current team' : ''}`}
                disabled={isCurrent}
                onPress={() => selectTeam(team.id)}
                style={({ pressed }) => [styles.team, pressed && styles.pressed]}
              >
                <View style={[styles.dot, { backgroundColor: team.accentPrimary }]} />
                <View style={styles.grow}>
                  <Text style={styles.value}>{team.name}</Text>
                  <Muted style={styles.small}>
                    {team.role === 'coach' ? 'Coach' : team.isAdmin ? 'Athlete · admin' : 'Athlete'}
                  </Muted>
                </View>
                {isCurrent ? <Muted style={styles.small}>Current</Muted> : null}
              </Pressable>
            );
          })}
          <Muted style={styles.small}>
            To leave a team, open Members on the Team tab. Joining another team from here comes
            later.
          </Muted>
        </Card>

        <ChangePassword />

        <Card title="Notifications">
          <Muted style={styles.small}>
            Not available yet. You’ll be able to choose what you’re told about (comments, reactions,
            flags, reminders) here.
          </Muted>
        </Card>

        <Button title="Sign out" variant="secondary" onPress={() => supabase.auth.signOut()} />
      </View>
    </TabScrollView>
  );
}

function ChangePassword() {
  const styles = useThemedStyles(makeStyles);
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [done, setDone] = useState(false);

  const change = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
    },
    onSuccess: () => {
      setPassword('');
      setAgain('');
      setOpen(false);
      setDone(true);
    },
  });

  const tooShort = password.length > 0 && password.length < MIN_PASSWORD_LENGTH;
  const mismatch = again.length > 0 && again !== password;
  const ready = password.length >= MIN_PASSWORD_LENGTH && again === password;

  return (
    <Card title="Password">
      {open ? (
        <>
          <TextField
            label="New password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            textContentType="newPassword"
            placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
            error={tooShort ? `At least ${MIN_PASSWORD_LENGTH} characters` : null}
          />
          <TextField
            label="New password again"
            value={again}
            onChangeText={setAgain}
            secureTextEntry
            autoCapitalize="none"
            textContentType="newPassword"
            error={mismatch ? 'The two don’t match' : null}
          />
          {change.isError ? <ErrorText>Couldn’t change it: {change.error.message}.</ErrorText> : null}
          <View style={styles.buttons}>
            <View style={styles.grow}>
              <Button
                title="Cancel"
                variant="secondary"
                disabled={change.isPending}
                onPress={() => {
                  setOpen(false);
                  setPassword('');
                  setAgain('');
                }}
              />
            </View>
            <View style={styles.grow}>
              <Button title="Change" disabled={!ready} loading={change.isPending} onPress={() => change.mutate()} />
            </View>
          </View>
        </>
      ) : (
        <>
          {done ? <Muted style={styles.small}>Password changed. ✓</Muted> : null}
          <Button
            title="Change password"
            variant="secondary"
            onPress={() => {
              setDone(false);
              setOpen(true);
            }}
          />
        </>
      )}
    </Card>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    wrapper: {
      gap: spacing.lg,
      paddingHorizontal: spacing.xl,
    },
    heading: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.lg,
    },
    headingText: {
      flex: 1,
      gap: spacing.xs,
    },
    value: {
      fontSize: fontSize.md,
      fontWeight: fontWeight.semibold,
      color: colors.text,
    },
    small: {
      fontSize: fontSize.sm,
    },
    grow: {
      flex: 1,
    },
    team: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    pressed: {
      opacity: 0.6,
    },
    dot: {
      width: 14,
      height: 14,
      borderRadius: 7,
    },
    buttons: {
      flexDirection: 'row',
      gap: spacing.md,
    },
  });
