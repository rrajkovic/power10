import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Avatar } from '@/components/Avatar';
import { HomeHeader } from '@/components/home/HomeHeader';
import { PeriodNavigator } from '@/components/home/Leaderboard';
import { SegmentedBar } from '@/components/home/SegmentedBar';
import { TeamGlow } from '@/components/home/TeamGlow';
import { NeedsReview } from '@/components/review/NeedsReview';
import { TabScrollView } from '@/components/TabScrollView';
import { Headline, Label, Muted } from '@/components/Typography';
import { fontSize, fontWeight, radius, spacing, type Palette } from '@/constants/theme';
import { visibleAccent } from '@/lib/color';
import {
  addDays,
  formatMetric,
  useMissedTarget,
  useTargetSummary,
  useTeamPeriod,
} from '@/lib/progress';
import { useTeams, type MyTeam } from '@/lib/teams';
import { useTheme, useThemedStyles } from '@/lib/theme';

const PERIOD_ADJECTIVES = { week: 'weekly', two_weeks: 'two-week', month: 'monthly' } as const;

export default function Team() {
  const styles = useThemedStyles(makeStyles);
  const { scheme } = useTheme();
  const { currentTeam } = useTeams();

  if (!currentTeam) return null;
  const accent = visibleAccent(currentTeam.accentPrimary, scheme);

  return (
    <TabScrollView
      background={<TeamGlow primary={currentTeam.accentPrimary} secondary={currentTeam.accentSecondary} />}
      header={<HomeHeader accent={accent} />}
    >
      <View style={styles.header}>
        <Label>Team</Label>
        <Headline>{currentTeam.name}</Headline>
      </View>
      <OnTarget key={currentTeam.id} team={currentTeam} accent={accent} />
      <NeedsReview team={currentTeam} />
      <Muted style={styles.comingSoon}>
        Coming next here: upcoming tests and races, the season’s hit rate, streaks, and members
        and invites.
      </Muted>
    </TabScrollView>
  );
}

// How many athletes hit the target, for any period. Coaches and admins also
// see who didn't, and by how much.
function OnTarget({ team, accent }: { team: MyTeam; accent: string }) {
  const styles = useThemedStyles(makeStyles);
  // null = the current period.
  const [day, setDay] = useState<string | null>(null);
  const period = useTeamPeriod(team.id, team.targetPeriod, day);
  const summary = useTargetSummary(team.id, day);
  const missed = useMissedTarget(team.id, day, team.isAdmin);

  const isCurrent = period.data?.is_current ?? true;
  const athletes = summary.data?.athletes ?? 0;
  const onTarget = summary.data?.on_target ?? null;

  return (
    <View style={styles.card}>
      <Label>On target</Label>
      <PeriodNavigator
        kind={team.targetPeriod}
        start={period.data?.period_start}
        end={period.data?.period_end}
        isCurrent={isCurrent}
        noPeriod={false}
        onPrevious={() => period.data && setDay(addDays(period.data.period_start, -1))}
        onNext={() => period.data && setDay(addDays(period.data.period_end, 1))}
      />

      {onTarget === null ? (
        <Muted>
          No target set for this period.
          {team.isAdmin ? ' Add one in the season settings.' : ''}
        </Muted>
      ) : (
        <>
          <Text style={styles.big}>
            {onTarget}
            <Text style={styles.of}> / {athletes} athletes</Text>
          </Text>
          <SegmentedBar progress={athletes ? onTarget / athletes : 0} color={accent} segments={1} />
          <Muted style={styles.small}>
            {isCurrent ? 'have hit' : 'hit'} the {PERIOD_ADJECTIVES[team.targetPeriod]} target
          </Muted>
        </>
      )}

      {team.isAdmin && onTarget !== null ? (
        <View style={styles.list}>
          <Label style={styles.listLabel}>{isCurrent ? 'Still to go' : 'Missed the target'}</Label>
          {missed.data?.length === 0 ? (
            <Muted>Everyone hit the target. 🎉</Muted>
          ) : (
            missed.data?.map((row) => (
              <View key={row.user_id} style={styles.row}>
                <Avatar name={row.name} color={accent} size={32} />
                <View style={styles.rowText}>
                  <Text style={styles.name}>{row.name || 'Unnamed'}</Text>
                  {row.missing_types.length ? (
                    <Muted style={styles.small}>Missing: {row.missing_types.join(', ')}</Muted>
                  ) : null}
                </View>
                <Text style={styles.short}>
                  {row.sessions === 0
                    ? 'No sessions'
                    : `${formatMetric('credits', row.short_by)} ${isCurrent ? 'to go' : 'short'}`}
                </Text>
              </View>
            ))
          )}
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    header: {
      gap: spacing.xs,
      paddingHorizontal: spacing.xl,
    },
    card: {
      gap: spacing.md,
      marginHorizontal: spacing.xl,
      padding: spacing.xl,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    big: {
      fontSize: fontSize.xl,
      fontWeight: fontWeight.bold,
      color: colors.text,
    },
    of: {
      fontSize: fontSize.md,
      fontWeight: fontWeight.regular,
      color: colors.textMuted,
    },
    small: {
      fontSize: fontSize.sm,
    },
    list: {
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    listLabel: {
      marginBottom: spacing.xs,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    rowText: {
      flex: 1,
      gap: 2,
    },
    name: {
      fontSize: fontSize.md,
      fontWeight: fontWeight.semibold,
      color: colors.text,
    },
    short: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.semibold,
      color: colors.textMuted,
    },
    comingSoon: {
      paddingHorizontal: spacing.xl,
      fontSize: fontSize.sm,
    },
  });
