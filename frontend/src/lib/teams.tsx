import {
  createContext,
  use,
  useCallback,
  useEffect,
  useState,
  type PropsWithChildren,
} from 'react';
import type { Database } from './database.types';
import { currentTeamId, rememberCurrentTeam } from './deviceMemory';
import { useSession } from './session';
import { supabase } from './supabase';

export type MemberRole = Database['public']['Enums']['member_role'];
export type TargetPeriod = Database['public']['Enums']['target_period'];

export type MyTeam = {
  id: string;
  name: string;
  role: MemberRole;
  isAdmin: boolean;
  accentPrimary: string;
  accentSecondary: string | null;
  timeZone: string;
  // How often targets reset: week, two_weeks or month.
  targetPeriod: TargetPeriod;
};

type TeamsState = {
  // Teams you're an active member of, oldest membership first.
  teams: MyTeam[];
  // The team the app is showing.
  currentTeam: MyTeam | null;
  // True while your teams are being loaded after signing in.
  isLoading: boolean;
  selectTeam: (teamId: string) => void;
  // Reload after creating or joining a team.
  refresh: () => Promise<void>;
};

const TeamsContext = createContext<TeamsState | null>(null);

async function loadTeams(userId: string): Promise<MyTeam[]> {
  const { data, error } = await supabase
    .from('memberships')
    .select('role, is_admin, teams(id, name, accent_primary, accent_secondary, time_zone, target_period)')
    .eq('user_id', userId)
    .order('joined_at');

  if (error) {
    console.warn('Could not load teams', error);
    return [];
  }

  // A locked-out membership (email grace period over) comes back without its
  // team, because the team is hidden from you. Those don't count.
  return data.flatMap((membership) =>
    membership.teams
      ? [
          {
            id: membership.teams.id,
            name: membership.teams.name,
            role: membership.role,
            isAdmin: membership.is_admin,
            accentPrimary: membership.teams.accent_primary,
            accentSecondary: membership.teams.accent_secondary,
            timeZone: membership.teams.time_zone,
            targetPeriod: membership.teams.target_period,
          },
        ]
      : [],
  );
}

type Loaded = { userId: string; teams: MyTeam[] };

export function TeamsProvider({ children }: PropsWithChildren) {
  const { session } = useSession();
  const userId = session?.user.id;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [selectedId, setSelectedId] = useState(currentTeamId);

  const refresh = useCallback(async () => {
    if (!userId) return;
    const teams = await loadTeams(userId);
    setLoaded({ userId, teams });
  }, [userId]);

  // Load whenever a different account signs in.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    loadTeams(userId).then((teams) => {
      if (!cancelled) setLoaded({ userId, teams });
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const isCurrent = loaded !== null && loaded.userId === userId;
  const teams = isCurrent ? loaded.teams : [];
  const currentTeam = teams.find((team) => team.id === selectedId) ?? teams[0] ?? null;

  function selectTeam(teamId: string) {
    setSelectedId(teamId);
    rememberCurrentTeam(teamId);
  }

  return (
    <TeamsContext
      value={{ teams, currentTeam, isLoading: !!userId && !isCurrent, selectTeam, refresh }}
    >
      {children}
    </TeamsContext>
  );
}

export function useTeams() {
  const value = use(TeamsContext);
  if (!value) {
    throw new Error('useTeams must be used inside <TeamsProvider>');
  }
  return value;
}
