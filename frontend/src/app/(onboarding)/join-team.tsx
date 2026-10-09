import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, TextButton } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { Body, ErrorText, Muted, Title } from '@/components/Typography';
import { colors, radius, spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useTeams, type MemberRole } from '@/lib/teams';

type Preview = {
  teamName: string;
  role: MemberRole;
  requiresEmailDomain: boolean;
  allowedDomains: string[];
};

// Accepts a short code ("3F9A1C0B") or a pasted invite link (the token is the
// last part of the link).
function inviteFrom(input: string): string {
  const trimmed = input.trim();
  return trimmed.includes('/') ? (trimmed.split('/').filter(Boolean).pop() ?? '') : trimmed;
}

export default function JoinTeam() {
  const { refresh, selectTeam } = useTeams();
  const [input, setInput] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Step 1: look the code up and show which team it is.
  async function handleFind() {
    const invite = inviteFrom(input);
    if (!invite) return setError('Enter the code from your coach or captain.');

    setError(null);
    setLoading(true);
    const { data, error } = await supabase.rpc('invite_preview', { token_or_code: invite });
    setLoading(false);

    if (error) return setError(error.message);
    const found = data?.[0];
    if (!found) return setError('That code doesn’t match any team. Check it and try again.');

    setPreview({
      teamName: found.team_name,
      role: found.role,
      requiresEmailDomain: found.requires_email_domain,
      allowedDomains: found.allowed_domains,
    });
  }

  // Step 2: join it.
  async function handleJoin() {
    setError(null);
    setLoading(true);
    const { data: teamId, error } = await supabase.rpc('join_team', {
      token_or_code: inviteFrom(input),
    });

    if (error || !teamId) {
      setLoading(false);
      return setError(error?.message ?? 'Something went wrong. Try again.');
    }

    // Show the new team; the gate then opens the app.
    selectTeam(teamId);
    await refresh();
  }

  if (preview) {
    return (
      <Screen centered>
        <Title>Join {preview.teamName}?</Title>

        <View style={styles.card}>
          <Body>Team: {preview.teamName}</Body>
          <Body>You’ll join as: {preview.role === 'coach' ? 'Coach' : 'Athlete'}</Body>
          {preview.requiresEmailDomain ? (
            <Muted>
              This team requires a verified school email ending in{' '}
              {preview.allowedDomains.join(' or ')}.
            </Muted>
          ) : null}
        </View>

        {error ? <ErrorText>{error}</ErrorText> : null}

        <Button title={`Join ${preview.teamName}`} onPress={handleJoin} loading={loading} />
        <TextButton
          title="Use a different code"
          onPress={() => {
            setPreview(null);
            setError(null);
          }}
        />
      </Screen>
    );
  }

  return (
    <Screen centered>
      <Title>Join a team</Title>
      <Muted>Enter the code your coach or captain shared, or paste the invite link.</Muted>

      <TextField
        label="Team code"
        placeholder="e.g. 3F9A1C0B"
        value={input}
        onChangeText={setInput}
        autoCapitalize="characters"
        autoCorrect={false}
        onSubmitEditing={handleFind}
      />

      {error ? <ErrorText>{error}</ErrorText> : null}

      <Button title="Find team" onPress={handleFind} loading={loading} />
      <TextButton title="Back" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
});
