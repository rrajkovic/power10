import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { Muted, Title } from '@/components/Typography';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useTeams } from '@/lib/teams';

// Placeholder until the real Home screen (goal cards + leaderboard).
export default function Home() {
  const { session } = useSession();
  const { currentTeam } = useTeams();

  return (
    <Screen centered>
      <Title>{currentTeam?.name}</Title>
      <Muted>
        Signed in as {session?.user.email} ·{' '}
        {currentTeam?.role === 'coach' ? 'Coach' : 'Athlete'}
        {currentTeam?.isAdmin ? ' · Admin' : ''}
      </Muted>
      <Button title="Sign out" variant="secondary" onPress={() => supabase.auth.signOut()} />
    </Screen>
  );
}
