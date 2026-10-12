import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { TextButton } from '@/components/Button';
import { Chips } from '@/components/Chips';
import { Screen } from '@/components/Screen';
import { ActivitiesSection } from '@/components/settings/ActivitiesSection';
import { CreditsSection } from '@/components/settings/CreditsSection';
import { TargetsSection } from '@/components/settings/TargetsSection';
import { TeamSection } from '@/components/settings/TeamSection';
import { AthleteRules } from '@/components/team/AthleteRules';
import { ErrorText, Muted, Title } from '@/components/Typography';
import { spacing } from '@/constants/theme';
import { visibleAccent } from '@/lib/color';
import { useSettingsChange, useTeamSetup } from '@/lib/settings';
import { useTeams } from '@/lib/teams';
import { useTheme } from '@/lib/theme';

type Section = 'team' | 'activities' | 'credits' | 'targets' | 'rules';

const SECTIONS: { value: Section; label: string }[] = [
  { value: 'team', label: 'Team' },
  { value: 'activities', label: 'Activities' },
  { value: 'credits', label: 'Credits' },
  { value: 'targets', label: 'Targets' },
  { value: 'rules', label: 'Rules' },
];

// Everything an admin can change about how the team works. Opened from the
// Team tab. Each change is saved on its own, straight away.
export default function TeamSettings() {
  const { scheme } = useTheme();
  const { currentTeam } = useTeams();
  const setup = useTeamSetup(currentTeam);
  const change = useSettingsChange();
  const [section, setSection] = useState<Section>('team');

  if (!currentTeam) return null;

  return (
    <Screen>
      <View style={styles.header}>
        <Title style={styles.title}>Team settings</Title>
        <TextButton title="Done" onPress={() => router.back()} />
      </View>

      {!currentTeam.isAdmin ? (
        <Muted>Only coaches and admins can change team settings.</Muted>
      ) : (
        <View style={styles.sections}>
          <Chips
            options={SECTIONS}
            value={section}
            onChange={(value) => value && setSection(value)}
            accent={visibleAccent(currentTeam.accentPrimary, scheme)}
          />
          {change.isError ? <ErrorText>Couldn’t save: {change.error.message}.</ErrorText> : null}

          {section === 'team' ? <TeamSection team={currentTeam} save={change.mutate} /> : null}
          {section === 'rules' ? <AthleteRules team={currentTeam} /> : null}

          {section === 'activities' || section === 'credits' || section === 'targets' ? (
            setup.isLoading ? (
              <Muted>Loading…</Muted>
            ) : setup.isError || !setup.data ? (
              <ErrorText>Couldn’t load the settings. Check your connection and try again.</ErrorText>
            ) : section === 'activities' ? (
              <ActivitiesSection team={currentTeam} setup={setup.data} save={change.mutate} />
            ) : section === 'credits' ? (
              <CreditsSection team={currentTeam} setup={setup.data} save={change.mutate} />
            ) : (
              <TargetsSection team={currentTeam} setup={setup.data} save={change.mutate} />
            )
          ) : null}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    marginBottom: 0,
  },
  sections: {
    gap: spacing.lg,
  },
});
