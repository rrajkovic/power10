import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { ErrorText, Muted } from '@/components/Typography';
import { fontSize, spacing } from '@/constants/theme';
import { hasCoachRights, useMembers } from '@/lib/members';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useTeams, type MyTeam } from '@/lib/teams';
import { Card } from './parts';

// Deleting the whole team. Only for people with coach rights (coaches; or
// athlete admins while the team has no coach). To make it hard to do by
// accident, the team's name has to be typed in first.
export function DeleteTeam({ team }: { team: MyTeam }) {
  const { session } = useSession();
  const { refresh } = useTeams();
  const queryClient = useQueryClient();
  const members = useMembers(team.id);
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState('');

  const remove = useMutation({
    mutationFn: async () => {
      // A server function, so the team's photo files are removed too.
      const { error } = await supabase.functions.invoke('delete-team', { body: { team_id: team.id } });
      if (error) {
        const body = await (error as { context?: Response }).context?.json?.().catch(() => null);
        throw new Error(typeof body?.error === 'string' ? body.error : 'Couldn’t delete the team');
      }
    },
    onSuccess: async () => {
      // Close this screen first; the app then moves to your next team, or to
      // "join or create a team" if this was your only one.
      if (router.canGoBack()) router.back();
      queryClient.clear();
      await refresh();
    },
  });

  const all = members.data ?? [];
  const me = all.find((member) => member.id === session?.user.id);
  if (!hasCoachRights(me, all)) return null;

  const matches = typed.trim().toLowerCase() === team.name.trim().toLowerCase();

  return (
    <Card title="Delete team">
      {confirming ? (
        <>
          <Muted style={styles.small}>
            This deletes {team.name} for everyone: all {all.length} members lose access, and every
            workout, photo, comment, target and setting is removed. It can’t be undone.
          </Muted>
          <TextField
            label={`Type the team’s name (${team.name}) to confirm`}
            value={typed}
            onChangeText={setTyped}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {remove.isError ? <ErrorText>{remove.error.message}.</ErrorText> : null}
          <View style={styles.buttons}>
            <View style={styles.button}>
              <Button
                title="Keep the team"
                variant="secondary"
                disabled={remove.isPending}
                onPress={() => {
                  setConfirming(false);
                  setTyped('');
                }}
              />
            </View>
            <View style={styles.button}>
              <Button
                title="Delete forever"
                disabled={!matches}
                loading={remove.isPending}
                onPress={() => remove.mutate()}
              />
            </View>
          </View>
        </>
      ) : (
        <>
          <Muted style={styles.small}>
            Removes the team and everything in it, for everyone. To step away yourself and leave the
            team running, use “Leave this team” under Members.
          </Muted>
          <Button title="Delete this team…" variant="secondary" onPress={() => setConfirming(true)} />
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
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
});
