import { router } from 'expo-router';
import { useState } from 'react';
import { Button, TextButton } from '@/components/Button';
import { ChoiceCards } from '@/components/ChoiceCards';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { Body, ErrorText, Muted, Title } from '@/components/Typography';
import { supabase } from '@/lib/supabase';
import { useTeams, type MemberRole } from '@/lib/teams';

// The phone's time zone, e.g. "America/New_York". Changeable later in team settings.
function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export default function CreateTeam() {
  const { refresh, selectTeam } = useTeams();
  const [name, setName] = useState('');
  const [role, setRole] = useState<MemberRole>('coach');
  const [timeZone] = useState(deviceTimeZone);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    const teamName = name.trim();
    if (!teamName) return setError('Give your team a name.');
    if (teamName.length > 80) return setError('Keep the name under 80 characters.');

    setError(null);
    setLoading(true);
    let { data: teamId, error } = await supabase.rpc('create_team', {
      team_name: teamName,
      team_time_zone: timeZone,
      creator_role: role,
    });
    // An unusual phone time zone the database doesn't know: start with UTC.
    if (error?.message.startsWith('Unknown time zone')) {
      ({ data: teamId, error } = await supabase.rpc('create_team', {
        team_name: teamName,
        team_time_zone: 'UTC',
        creator_role: role,
      }));
    }

    if (error || !teamId) {
      setLoading(false);
      return setError(error?.message ?? 'Something went wrong. Try again.');
    }

    // Show the new team; the gate then opens the app.
    selectTeam(teamId);
    await refresh();
  }

  return (
    <Screen centered>
      <Title>Create a team</Title>
      <Muted>You can change all of this later in team settings.</Muted>

      <TextField
        label="Team name"
        placeholder="e.g. Penn Lightweight Rowing"
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
        maxLength={80}
      />

      <Body style={{ fontWeight: '600', marginTop: 4 }}>Your role</Body>
      <ChoiceCards<MemberRole>
        value={role}
        onChange={setRole}
        choices={[
          {
            value: 'coach',
            label: 'Coach',
            description: 'Plan the season and manage the team.',
          },
          {
            value: 'athlete',
            label: 'Athlete',
            description: 'Log your training. You’re still the team’s admin.',
          },
        ]}
      />

      <Muted>Time zone: {timeZone}</Muted>

      {error ? <ErrorText>{error}</ErrorText> : null}

      <Button title="Create team" onPress={handleCreate} loading={loading} />
      <TextButton title="Back" onPress={() => router.back()} />
    </Screen>
  );
}
