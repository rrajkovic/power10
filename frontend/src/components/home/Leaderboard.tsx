import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '@/components/Avatar';
import { TextButton } from '@/components/Button';
import { OptionMenu, type MenuOption } from '@/components/OptionMenu';
import { Label, Muted } from '@/components/Typography';
import { fontSize, fontWeight, monoFont, spacing, type Palette } from '@/constants/theme';
import {
  addDays,
  formatMetric,
  metricValue,
  periodLabel,
  useLeaderboard,
  useTeamPeriod,
  type LeaderboardRow,
  type Metric,
  type PeriodKind,
} from '@/lib/progress';
import { useSession } from '@/lib/session';
import type { MyTeam } from '@/lib/teams';
import { useTheme, useThemedStyles } from '@/lib/theme';

// Home shows the top 10 plus your own row; "See all" shows everyone.
const TOP = 10;

const METRICS: MenuOption<Metric>[] = [
  { value: 'credits', label: 'Credits' },
  { value: 'minutes', label: 'Minutes' },
  { value: 'distance', label: 'Distance' },
];

const CURRENT_LABELS: Record<PeriodKind, string> = {
  week: 'This week',
  two_weeks: 'These 2 weeks',
  month: 'This month',
  season: 'This season',
};

export function Leaderboard({ team, accent }: { team: MyTeam; accent: string }) {
  const styles = useThemedStyles(makeStyles);
  const { session } = useSession();
  const myId = session?.user.id;

  const [kind, setKind] = useState<PeriodKind>(team.targetPeriod);
  const [metric, setMetric] = useState<Metric>('credits');
  // null = the current period; otherwise any day inside the period shown.
  const [day, setDay] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const period = useTeamPeriod(team.id, kind, day);
  const board = useLeaderboard(team.id, kind, day);

  const periods: MenuOption<PeriodKind>[] = [
    { value: 'week', label: 'Week' },
    ...(team.targetPeriod === 'two_weeks' ? [{ value: 'two_weeks' as const, label: '2 weeks' }] : []),
    { value: 'month', label: 'Month' },
    { value: 'season', label: 'Season' },
  ];

  const rows = [...(board.data ?? [])].sort(
    (a, b) => metricValue(b, metric) - metricValue(a, metric) || a.name.localeCompare(b.name),
  );

  // Targets only exist for credits, in the team's own target period.
  const target = metric === 'credits' ? (period.data?.target ?? null) : null;
  const max = metric === 'credits' ? (period.data?.max_credits ?? null) : null;
  // Full bar width: the max; without one, target + 50%; without a target,
  // the leader.
  const leader = rows.length ? metricValue(rows[0], metric) : 0;
  const fullScale = target !== null ? (max ?? target * 1.5) : Math.max(leader, 1);

  const myIndex = rows.findIndex((row) => row.user_id === myId);
  const shown = expanded ? rows : rows.slice(0, TOP);
  const pinnedMe = !expanded && myIndex >= TOP ? rows[myIndex] : null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Label>Leaderboard</Label>
        <View style={styles.menus}>
          <OptionMenu
            options={periods}
            value={kind}
            onChange={(next) => {
              setKind(next);
              setDay(null);
            }}
            accessibilityLabel="Leaderboard period"
          />
          <OptionMenu options={METRICS} value={metric} onChange={setMetric} accessibilityLabel="Leaderboard metric" />
        </View>
      </View>

      <PeriodNavigator
        kind={kind}
        start={period.data?.period_start}
        end={period.data?.period_end}
        isCurrent={period.data?.is_current ?? true}
        noPeriod={period.isSuccess && !period.data}
        onPrevious={() => period.data && setDay(addDays(period.data.period_start, -1))}
        onNext={() => period.data && setDay(addDays(period.data.period_end, 1))}
      />

      {board.isPending ? (
        <ActivityIndicator style={styles.loading} />
      ) : board.isError ? (
        <Muted>Couldn’t load the leaderboard. Pull down to try again.</Muted>
      ) : rows.length === 0 ? (
        <Muted>Nobody’s here yet.</Muted>
      ) : (
        <>
          {shown.map((row, index) => (
            <LeaderRow
              key={row.user_id}
              rank={index + 1}
              row={row}
              metric={metric}
              target={target}
              max={max}
              fullScale={fullScale}
              accent={accent}
              isMe={row.user_id === myId}
              canSeeStatus={team.isAdmin || row.user_id === myId}
              isCurrent={period.data?.is_current ?? true}
            />
          ))}
          {pinnedMe ? (
            <>
              <Text style={styles.gap}>⋯</Text>
              <LeaderRow
                rank={myIndex + 1}
                row={pinnedMe}
                metric={metric}
                target={target}
                max={max}
                fullScale={fullScale}
                accent={accent}
                isMe
                canSeeStatus
                isCurrent={period.data?.is_current ?? true}
              />
            </>
          ) : null}
          {rows.length > TOP ? (
            <TextButton
              title={expanded ? 'Show top 10' : `See all ${rows.length}`}
              onPress={() => setExpanded((open) => !open)}
            />
          ) : null}
        </>
      )}
    </View>
  );
}

export function PeriodNavigator({
  kind,
  start,
  end,
  isCurrent,
  noPeriod,
  onPrevious,
  onNext,
}: {
  kind: PeriodKind;
  start: string | undefined;
  end: string | undefined;
  isCurrent: boolean;
  noPeriod: boolean;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.navigator}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Previous period"
        onPress={onPrevious}
        disabled={!start}
        hitSlop={12}
      >
        <Text style={[styles.arrow, !start && styles.arrowDisabled]}>‹</Text>
      </Pressable>
      <View style={styles.periodText}>
        <Text style={styles.periodLabel}>
          {noPeriod ? 'No season covers this date' : start && end ? periodLabel(kind, start, end) : ' '}
        </Text>
        {isCurrent && !noPeriod ? <Muted style={styles.small}>{CURRENT_LABELS[kind]}</Muted> : null}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Next period"
        onPress={onNext}
        disabled={isCurrent || !end}
        hitSlop={12}
      >
        <Text style={[styles.arrow, (isCurrent || !end) && styles.arrowDisabled]}>›</Text>
      </Pressable>
    </View>
  );
}

function LeaderRow({
  rank,
  row,
  metric,
  target,
  max,
  fullScale,
  accent,
  isMe,
  canSeeStatus,
  isCurrent,
}: {
  rank: number;
  row: LeaderboardRow;
  metric: Metric;
  target: number | null;
  max: number | null;
  fullScale: number;
  accent: string;
  isMe: boolean;
  // Admins see everyone's status; athletes only their own.
  canSeeStatus: boolean;
  isCurrent: boolean;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const value = metricValue(row, metric);
  const isAthlete = row.role === 'athlete';
  const hasTarget = target !== null && isAthlete;
  const behind = hasTarget && value < target;
  const overMax = hasTarget && max !== null && value > max;
  const overflow = value > fullScale;

  // Bar color: team color by default. Where you're allowed to see status:
  // grey while short of the target, muted orange over the max.
  const barColor =
    hasTarget && canSeeStatus ? (overMax ? colors.caution : behind ? colors.textMuted : accent) : accent;

  return (
    <View style={[styles.row, isMe && styles.rowMe]}>
      <Text style={styles.rank}>{String(rank).padStart(2, '0')}</Text>
      <Avatar name={row.name} color={accent} size={32} />
      <View style={styles.middle}>
        <View style={styles.nameLine}>
          <Text style={styles.name} numberOfLines={1}>
            {isMe ? 'You' : row.name || 'Unnamed'}
          </Text>
          <Text style={styles.value}>{formatMetric(metric, value)}</Text>
        </View>
        <View style={styles.barLine}>
          <View style={[styles.track, { backgroundColor: colors.track }]}>
            <View
              style={[
                styles.fill,
                { width: `${Math.min(1, value / fullScale) * 100}%`, backgroundColor: barColor },
              ]}
            />
            {target !== null ? (
              <View style={[styles.targetLine, { left: `${Math.min(1, target / fullScale) * 100}%` }]} />
            ) : null}
          </View>
          {overflow ? <Text style={[styles.overflow, { color: barColor }]}>»</Text> : null}
        </View>
        {behind && canSeeStatus ? (
          <Muted style={styles.small}>
            {formatMetric('credits', target! - value)} {isCurrent ? 'to go' : 'short'}
          </Muted>
        ) : null}
      </View>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    container: {
      gap: spacing.md,
      paddingHorizontal: spacing.xl,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    menus: {
      flexDirection: 'row',
      gap: spacing.lg,
    },
    navigator: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    arrow: {
      fontSize: fontSize.xl,
      color: colors.text,
      paddingHorizontal: spacing.sm,
    },
    arrowDisabled: {
      opacity: 0.25,
    },
    periodText: {
      alignItems: 'center',
    },
    periodLabel: {
      fontSize: fontSize.md,
      fontWeight: fontWeight.semibold,
      color: colors.text,
    },
    loading: {
      paddingVertical: spacing.xl,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    rowMe: {
      backgroundColor: colors.surface,
      marginHorizontal: -spacing.sm,
      paddingHorizontal: spacing.sm,
      borderRadius: 10,
    },
    rank: {
      width: 22,
      fontFamily: monoFont,
      fontSize: fontSize.sm,
      color: colors.textMuted,
    },
    middle: {
      flex: 1,
      gap: 6,
    },
    nameLine: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      gap: spacing.sm,
    },
    name: {
      flex: 1,
      fontSize: fontSize.md,
      fontWeight: fontWeight.semibold,
      color: colors.text,
    },
    value: {
      fontFamily: monoFont,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.semibold,
      color: colors.text,
    },
    barLine: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    track: {
      flex: 1,
      height: 6,
      borderRadius: 3,
    },
    fill: {
      height: '100%',
      borderRadius: 3,
    },
    targetLine: {
      position: 'absolute',
      top: -4,
      width: 2,
      height: 14,
      marginLeft: -1,
      borderRadius: 1,
      backgroundColor: colors.text,
      opacity: 0.6,
    },
    overflow: {
      fontSize: fontSize.md,
      fontWeight: fontWeight.bold,
      lineHeight: fontSize.md,
    },
    gap: {
      textAlign: 'center',
      color: colors.textMuted,
    },
    small: {
      fontSize: fontSize.sm,
    },
  });
