import { Screen } from '@/components/Screen';
import { Muted, Title } from '@/components/Typography';
import { useTeams } from '@/lib/teams';

// Placeholder until the real Home screen (goal cards + leaderboard).
export default function Home() {
  const { currentTeam } = useTeams();

  return (
    <Screen centered>
      <Title>{currentTeam?.name}</Title>
      <Muted>
        {currentTeam?.role === 'coach' ? 'Coach' : 'Athlete'}
        {currentTeam?.isAdmin ? ' · Admin' : ''}
      </Muted>
      <Muted>Goal cards and the leaderboard go here.</Muted>
    </Screen>
  );
}
