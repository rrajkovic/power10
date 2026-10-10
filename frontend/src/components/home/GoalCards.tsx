import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SegmentedBar } from '@/components/home/SegmentedBar';
import { Label, Muted } from '@/components/Typography';
import { fontSize, fontWeight, radius, spacing, type Palette } from '@/constants/theme';
import {
  formatMetric,
  useLeaderboard,
  useMyTypeProgress,
  useTargetSummary,
  useTeamPeriod,
} from '@/lib/progress';
import { useSession } from '@/lib/session';
import type { MyTeam } from '@/lib/teams';
import { useThemedStyles } from '@/lib/theme';

const PERIOD_NAMES = { week: 'week', two_weeks: '2 weeks', month: 'month' } as const;

// The cards at the top of Home: your own period, then what the team did.
// Home is meant to motivate, so it shows progress; who's behind lives on the
// Team tab.
export function GoalCards({ team, accent }: { team: MyTeam; accent: string }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.stack}>
      <YourPeriodCard team={team} accent={accent} />
      <TeamPeriodCard team={team} accent={accent} />
    </View>
  );
}

function YourPeriodCard({ team, accent }: { team: MyTeam; accent: string }) {
  const styles = useThemedStyles(makeStyles);
  const { session } = useSession();
  const period = useTeamPeriod(team.id, team.targetPeriod, null);
  const board = useLeaderboard(team.id, team.targetPeriod, null);
  const types = useMyTypeProgress(team.id);

  const mine = board.data?.find((row) => row.user_id === session?.user.id);
  const credits = mine?.credits ?? 0;
  const target = period.data?.target ?? null;
  const toGo = target !== null ? Math.max(0, target - credits) : null;

  // Coaches have no target: just show what they've logged.
  if (team.role === 'coach') {
    const sessions = mine?.sessions ?? 0;
    return (
      <View style={styles.card}>
        <Label>Your {PERIOD_NAMES[team.targetPeriod]}</Label>
        <Text style={styles.big}>
          {formatMetric('credits', credits)}
          <Text style={styles.of}> credits</Text>
        </Text>
        <Muted>
          {sessions} {sessions === 1 ? 'session' : 'sessions'} ·{' '}
          {formatMetric('minutes', mine?.minutes ?? 0)}
          {mine?.distance_meters ? ` · ${formatMetric('distance', mine.distance_meters)}` : ''}
        </Muted>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Label>Your {PERIOD_NAMES[team.targetPeriod]}</Label>
      <SegmentedBar progress={target ? credits / target : 0} color={accent} />
      <Text style={styles.big}>
        {formatMetric('credits', credits)}
        {target !== null ? <Text style={styles.of}> / {formatMetric('credits', target)} credits</Text> : null}
      </Text>
      {toGo === null ? (
        <Muted>No target this {PERIOD_NAMES[team.targetPeriod]}</Muted>
      ) : toGo > 0 ? (
        <Muted>{formatMetric('credits', toGo)} to go</Muted>
      ) : (
        <Text style={[styles.done, { color: accent }]}>Target hit ✓</Text>
      )}
      {types.data?.map((type) => (
        <Muted key={type.activity_type_id} style={styles.small}>
          {type.name} {formatMetric('credits', type.credits)}
          {type.min_credits ? ` / ${formatMetric('credits', type.min_credits)}` : ''}
          {type.max_credits ? ` (max ${formatMetric('credits', type.max_credits)})` : ''}
        </Muted>
      ))}
    </View>
  );
}

// What the whole team has done this period. Athletes only: coaches' sessions
// don't count toward team totals or the team goal.
function TeamPeriodCard({ team, accent }: { team: MyTeam; accent: string }) {
  const styles = useThemedStyles(makeStyles);
  const period = useTeamPeriod(team.id, team.targetPeriod, null);
  const board = useLeaderboard(team.id, team.targetPeriod, null);

  const athletes = (board.data ?? []).filter((row) => row.role === 'athlete');
  const minutes = athletes.reduce((sum, row) => sum + row.minutes, 0);
  const credits = athletes.reduce((sum, row) => sum + row.credits, 0);
  const sessions = athletes.reduce((sum, row) => sum + row.sessions, 0);
  const meters = athletes.reduce((sum, row) => sum + row.distance_meters, 0);
  const average = athletes.length ? minutes / athletes.length : 0;

  // The team goal: everyone's target added up.
  const target = period.data?.target ?? null;
  const goal = target !== null ? target * athletes.length : null;
  const percent = goal ? Math.round((credits / goal) * 100) : null;

  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.navigate('/team')}
        hitSlop={8}
        style={({ pressed }) => pressed && { opacity: 0.6 }}
      >
        <Label>Team this {PERIOD_NAMES[team.targetPeriod]} ›</Label>
      </Pressable>

      <View style={styles.totalRow}>
        <Text style={styles.huge}>
          {Math.round(minutes).toLocaleString('en-US')}
          <Text style={styles.unit}> min</Text>
        </Text>
        <View style={styles.hours}>
          <Text style={styles.hoursValue}>{(minutes / 60).toFixed(1)}</Text>
          <Label>Hours</Label>
        </View>
      </View>

      {goal !== null ? (
        <View style={styles.goal}>
          <View style={styles.goalText}>
            <Muted style={styles.small}>Team goal</Muted>
            <Text style={styles.goalNumbers}>
              {formatMetric('credits', credits)} / {formatMetric('credits', goal)} credits · {percent}%
            </Text>
          </View>
          <SegmentedBar progress={credits / goal} color={accent} segments={1} />
        </View>
      ) : null}

      <View style={styles.tiles}>
        <Tile value={String(sessions)} label="Sessions" />
        <Tile value={(meters / 1000).toFixed(1)} label="Km" />
        <Tile value={String(Math.round(average))} label="Min / athlete" />
      </View>

      {team.isAdmin ? <StillToGo team={team} /> : null}
    </View>
  );
}

// Coaches and admins only: how many athletes haven't hit the target yet,
// linking to the list on the Team tab. Athletes never see this on Home.
function StillToGo({ team }: { team: MyTeam }) {
  const styles = useThemedStyles(makeStyles);
  const summary = useTargetSummary(team.id);
  const athletes = summary.data?.athletes ?? 0;
  const onTarget = summary.data?.on_target;
  if (onTarget === null || onTarget === undefined) return null;
  const behind = athletes - onTarget;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.navigate('/team')}
      style={({ pressed }) => [styles.stillToGo, pressed && { opacity: 0.6 }]}
    >
      <Text style={styles.stillToGoText}>
        {onTarget} / {athletes} on target
        {behind > 0 ? <Text style={styles.of}> · {behind} still to go</Text> : null}
      </Text>
      <Text style={styles.of}>See who ›</Text>
    </Pressable>
  );
}

function Tile({ value, label }: { value: string; label: string }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.tile}>
      <Text style={styles.tileValue}>{value}</Text>
      <Label>{label}</Label>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    stack: {
      gap: spacing.md,
      paddingHorizontal: spacing.xl,
    },
    card: {
      gap: spacing.md,
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
    done: {
      fontSize: fontSize.md,
      fontWeight: fontWeight.semibold,
    },
    small: {
      fontSize: fontSize.sm,
    },
    totalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
    },
    huge: {
      fontSize: 48,
      lineHeight: 52,
      fontWeight: fontWeight.heavy,
      letterSpacing: -1,
      color: colors.text,
    },
    unit: {
      fontSize: fontSize.lg,
      fontWeight: fontWeight.medium,
      letterSpacing: 0,
      color: colors.textMuted,
    },
    hours: {
      alignItems: 'flex-end',
      gap: 2,
    },
    hoursValue: {
      fontSize: fontSize.lg,
      fontWeight: fontWeight.semibold,
      color: colors.textMuted,
    },
    goal: {
      gap: spacing.sm,
    },
    goalText: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      gap: spacing.sm,
    },
    goalNumbers: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.semibold,
      color: colors.text,
    },
    tiles: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    tile: {
      flex: 1,
      gap: 4,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.background,
    },
    stillToGo: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    stillToGoText: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.semibold,
      color: colors.text,
    },
    tileValue: {
      fontSize: fontSize.lg,
      fontWeight: fontWeight.bold,
      color: colors.text,
    },
  });
