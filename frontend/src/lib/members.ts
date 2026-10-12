import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { progressKey } from './progress';
import { supabase } from './supabase';
import { useTeams, type MemberRole } from './teams';

// The team's roster and invite codes.
//
// Changes go through database functions that enforce who may do what (see
// "Roles" in docs/DECISIONS.md). The app works out the same rules only to
// decide which buttons to show.

export type Member = {
  id: string;
  name: string;
  role: MemberRole;
  isAdmin: boolean;
  joinedAt: string;
};

const membersKey = ['members'] as const;

export function useMembers(teamId: string | undefined) {
  return useQuery({
    queryKey: [...membersKey, teamId],
    enabled: !!teamId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('memberships')
        .select('user_id, role, is_admin, joined_at, profiles(name)')
        .eq('team_id', teamId!)
        .order('joined_at');
      if (error) throw error;
      return data.map(
        (row): Member => ({
          id: row.user_id,
          name: row.profiles?.name || 'Unnamed',
          role: row.role,
          isAdmin: row.is_admin,
          joinedAt: row.joined_at,
        }),
      );
    },
  });
}

// "Coach rights": granting admin, making coaches, removing coaches. Coaches
// have them. While a team has no coach at all, athlete admins have them too.
export function hasCoachRights(me: Member | undefined, members: Member[]): boolean {
  if (!me) return false;
  if (me.role === 'coach') return true;
  return me.isAdmin && !members.some((member) => member.role === 'coach');
}

// The active invite codes: one for athletes, one for coaches. Admins only.
export function useInvites(teamId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: [...membersKey, 'invites', teamId],
    enabled: !!teamId && enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invites')
        .select('id, role, code')
        .eq('team_id', teamId!)
        .is('revoked_at', null);
      if (error) throw error;
      return data;
    },
  });
}

// After any change: reload the roster and invites, the lists other screens
// keep (who can be logged for, the Feed's people filter), the totals (an
// athlete becoming a coach changes the team goal), and your own teams (your
// own role may have changed, or you may have left).
function useAfterChange() {
  const queryClient = useQueryClient();
  const { refresh } = useTeams();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: membersKey }),
      queryClient.invalidateQueries({ queryKey: ['team_athletes'] }),
      queryClient.invalidateQueries({ queryKey: ['team_members'] }),
      queryClient.invalidateQueries({ queryKey: progressKey }),
      refresh(),
    ]);
}

export type MemberChange =
  | { kind: 'role'; teamId: string; memberId: string; role: MemberRole }
  | { kind: 'admin'; teamId: string; memberId: string; makeAdmin: boolean }
  | { kind: 'remove'; teamId: string; memberId: string }
  | { kind: 'leave'; teamId: string }
  | { kind: 'reset_invite'; teamId: string; role: MemberRole };

export function useMemberChange() {
  const afterChange = useAfterChange();
  return useMutation({
    mutationFn: async (change: MemberChange) => {
      const { error } =
        change.kind === 'role'
          ? await supabase.rpc('set_member_role', {
              team: change.teamId,
              member: change.memberId,
              new_role: change.role,
            })
          : change.kind === 'admin'
            ? await supabase.rpc('set_member_admin', {
                team: change.teamId,
                member: change.memberId,
                make_admin: change.makeAdmin,
              })
            : change.kind === 'remove'
              ? await supabase.rpc('remove_member', { team: change.teamId, member: change.memberId })
              : change.kind === 'leave'
                ? await supabase.rpc('leave_team', { team: change.teamId })
                : await supabase.rpc('reset_invite', { team: change.teamId, invite_role: change.role });
      if (error) throw error;
    },
    onSuccess: afterChange,
  });
}
