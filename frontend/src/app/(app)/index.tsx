import { StyleSheet } from 'react-native';
import { GoalCards } from '@/components/home/GoalCards';
import { HomeHeader } from '@/components/home/HomeHeader';
import { Leaderboard } from '@/components/home/Leaderboard';
import { TeamGlow } from '@/components/home/TeamGlow';
import { FlaggedNotice } from '@/components/review/FlaggedNotice';
import { TabScrollView } from '@/components/TabScrollView';
import { Headline } from '@/components/Typography';
import { spacing } from '@/constants/theme';
import { visibleAccent } from '@/lib/color';
import { useTeams } from '@/lib/teams';
import { useTheme } from '@/lib/theme';

export default function Home() {
  const { scheme } = useTheme();
  const { currentTeam } = useTeams();

  if (!currentTeam) return null;
  // The team color, nudged so it stays visible in light and dark mode.
  const accent = visibleAccent(currentTeam.accentPrimary, scheme);

  return (
    <TabScrollView
      background={<TeamGlow primary={currentTeam.accentPrimary} secondary={currentTeam.accentSecondary} />}
      header={<HomeHeader accent={accent} />}
    >
      <FlaggedNotice teamId={currentTeam.id} />
      <GoalCards key={currentTeam.id} team={currentTeam} accent={accent} />
      <Headline style={styles.headline}>Who’s putting{'\n'}in the work?</Headline>
      {/* key: reset the leaderboard's period and metric when switching teams. */}
      <Leaderboard key={`board-${currentTeam.id}`} team={currentTeam} accent={accent} />
    </TabScrollView>
  );
}

const styles = StyleSheet.create({
  headline: {
    paddingHorizontal: spacing.xl,
    marginTop: spacing.md,
  },
});
