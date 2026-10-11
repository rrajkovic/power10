import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from '@/components/Button';
import { CheckList, CheckRow } from '@/components/CheckRow';
import { Chips } from '@/components/Chips';
import { SessionCard } from '@/components/feed/SessionCard';
import { HomeHeader } from '@/components/home/HomeHeader';
import { TeamGlow } from '@/components/home/TeamGlow';
import { TabScrollView } from '@/components/TabScrollView';
import { ErrorText, Headline, Label, Muted } from '@/components/Typography';
import { fontSize, spacing } from '@/constants/theme';
import { visibleAccent } from '@/lib/color';
import { useFeed, useTeamMembers, type FeedFilter } from '@/lib/feed';
import { todayInTimeZone } from '@/lib/logging';
import { useSession } from '@/lib/session';
import { useTeams, type MyTeam } from '@/lib/teams';
import { useTheme } from '@/lib/theme';

type FilterKind = FeedFilter['kind'];

const FILTERS: { value: FilterKind; label: string }[] = [
  { value: 'everyone', label: 'Everyone' },
  { value: 'mine', label: 'My workouts' },
  { value: 'people', label: 'People' },
];

export default function Feed() {
  const { scheme } = useTheme();
  const { currentTeam } = useTeams();

  if (!currentTeam) return null;
  const accent = visibleAccent(currentTeam.accentPrimary, scheme);

  return (
    <TabScrollView
      background={<TeamGlow primary={currentTeam.accentPrimary} secondary={currentTeam.accentSecondary} />}
      header={<HomeHeader accent={accent} />}
    >
      {/* key: start again on "Everyone" when switching teams. */}
      <FeedList key={currentTeam.id} team={currentTeam} accent={accent} />
    </TabScrollView>
  );
}

function FeedList({ team, accent }: { team: MyTeam; accent: string }) {
  const { session } = useSession();
  const userId = session?.user.id;
  const [kind, setKind] = useState<FilterKind>('everyone');
  // Who's ticked under "People".
  const [people, setPeople] = useState<string[]>([]);
  const members = useTeamMembers(team.id, kind === 'people');

  const filter: FeedFilter =
    kind === 'people' ? { kind, ids: people } : kind === 'mine' ? { kind } : { kind: 'everyone' };
  const feed = useFeed({ teamId: team.id, userId, isAdmin: team.isAdmin, filter });
  const sessions = feed.data?.pages.flat() ?? [];
  const today = todayInTimeZone(team.timeZone);
  const nobodyPicked = kind === 'people' && people.length === 0;

  return (
    <View style={styles.wrapper}>
      <View style={styles.heading}>
        <Label>Feed</Label>
        <Headline>What the team’s{'\n'}been up to</Headline>
      </View>

      <Chips
        options={FILTERS}
        value={kind}
        onChange={(value) => value && setKind(value)}
        accent={accent}
      />

      {kind === 'people' ? (
        members.isLoading ? (
          <Muted style={styles.small}>Loading…</Muted>
        ) : (
          <CheckList>
            {(members.data ?? []).map((member) => (
              <CheckRow
                key={member.id}
                name={member.name}
                selected={people.includes(member.id)}
                accent={accent}
                onPress={() =>
                  setPeople(
                    people.includes(member.id)
                      ? people.filter((id) => id !== member.id)
                      : [...people, member.id],
                  )
                }
              />
            ))}
          </CheckList>
        )
      ) : null}

      {nobodyPicked ? (
        <Muted>Tick one or more people to see their workouts.</Muted>
      ) : feed.isLoading ? (
        <Muted>Loading…</Muted>
      ) : feed.isError ? (
        <ErrorText>Couldn’t load the feed. Pull down to try again.</ErrorText>
      ) : sessions.length === 0 ? (
        <Muted>
          {kind === 'mine'
            ? 'You haven’t logged a workout yet. Tap “Log a workout” to add your first.'
            : 'No workouts yet.'}
        </Muted>
      ) : (
        sessions.map((item) => (
          <SessionCard
            key={item.id}
            session={item}
            accent={accent}
            today={today}
            showVerification={team.isAdmin || item.athlete_id === userId}
          />
        ))
      )}

      {!nobodyPicked && feed.hasNextPage ? (
        <Button
          title="Load more"
          variant="secondary"
          loading={feed.isFetchingNextPage}
          onPress={() => feed.fetchNextPage()}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  heading: {
    gap: spacing.xs,
  },
  small: {
    fontSize: fontSize.sm,
  },
});
