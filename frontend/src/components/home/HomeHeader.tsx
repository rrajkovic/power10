import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '@/components/Avatar';
import { OptionMenu } from '@/components/OptionMenu';
import { fontSize, fontWeight, radius, spacing, type Palette } from '@/constants/theme';
import { useSession } from '@/lib/session';
import { useTeams } from '@/lib/teams';
import { useThemedStyles } from '@/lib/theme';

// Your initials (opens Profile) on the left, the team on the right. People on
// several teams can switch here.
export function HomeHeader({ accent }: { accent: string }) {
  const styles = useThemedStyles(makeStyles);
  const { session } = useSession();
  const { teams, currentTeam, selectTeam } = useTeams();

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Profile"
        onPress={() => router.navigate('/profile')}
        hitSlop={8}
      >
        <Avatar name={session?.user.user_metadata?.name} color={accent} size={40} />
      </Pressable>

      {teams.length > 1 ? (
        <OptionMenu
          appearance="pill"
          accessibilityLabel="Switch team"
          options={teams.map((team) => ({ value: team.id, label: team.name }))}
          value={currentTeam?.id ?? ''}
          onChange={selectTeam}
        />
      ) : (
        <View style={styles.pill}>
          <Text style={styles.pillText} numberOfLines={1}>
            {currentTeam?.name}
          </Text>
        </View>
      )}
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: spacing.xl,
    },
    pill: {
      maxWidth: '70%',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.lg * 2,
      borderWidth: 1,
      borderColor: colors.border,
    },
    pillText: {
      fontSize: fontSize.md,
      fontWeight: fontWeight.semibold,
      color: colors.text,
    },
  });
