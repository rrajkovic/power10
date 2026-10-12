import { StyleSheet, View } from 'react-native';
import { Chips } from '@/components/Chips';
import { Muted } from '@/components/Typography';
import { fontSize, spacing } from '@/constants/theme';
import { visibleAccent } from '@/lib/color';
import { isDate, parseCredits, seasonWrites, targetWrites, teamWrites } from '@/lib/settings';
import type { MyTeam, TargetPeriod } from '@/lib/teams';
import { useTheme } from '@/lib/theme';
import { Card, SavedField } from './parts';
import { SpecialWeeks } from './SpecialWeeks';
import type { Save, Setup } from './types';

const PERIODS: { value: TargetPeriod; label: string }[] = [
  { value: 'week', label: 'Every week' },
  { value: 'two_weeks', label: 'Every 2 weeks' },
  { value: 'month', label: 'Every month' },
];

const PERIOD_WORDS = { week: 'week', two_weeks: 'two weeks', month: 'month' } as const;

// What athletes have to do each period, and the season it applies to.
export function TargetsSection({ team, setup, save }: { team: MyTeam; setup: Setup; save: Save }) {
  const { scheme } = useTheme();
  const season = setup.season;
  const total = setup.targets.find((target) => target.activity_type_id === null) ?? null;
  const per = PERIOD_WORDS[team.targetPeriod];

  if (!season) {
    return (
      <Card title="Season">
        <Muted>This team has no season yet.</Muted>
      </Card>
    );
  }

  // Empty box = "none". Returns undefined for something that isn't a number.
  const read = (text: string): number | null | undefined => {
    if (!text.trim()) return null;
    return parseCredits(text) ?? undefined;
  };
  const checkCredits = (text: string) => (read(text) === undefined ? 'A number, or leave it empty' : null);

  return (
    <>
      <Card title="How often" hint="Targets start again at the beginning of each period. Weeks run Monday to Sunday.">
        <Chips
          options={PERIODS}
          value={team.targetPeriod}
          onChange={(value) => value && save(teamWrites.update(team.id, { target_period: value }))}
          accent={visibleAccent(team.accentPrimary, scheme)}
        />
      </Card>

      <Card title="Target" hint={`Credits each athlete should reach every ${per}. Coaches don't have a target.`}>
        <SavedField
          label={`Required credits per ${per}`}
          saved={String(total?.min_credits ?? 0)}
          keyboardType="decimal-pad"
          check={(text) => (parseCredits(text) === null ? 'A number' : null)}
          onSave={(text) =>
            save(
              targetWrites.save(team.id, season.id, null, total, parseCredits(text) ?? 0, total?.max_credits ?? null),
            )
          }
        />
        <SavedField
          label={`Maximum credits per ${per} (optional)`}
          saved={total?.max_credits == null ? '' : String(total.max_credits)}
          placeholder="No maximum"
          keyboardType="decimal-pad"
          hint="Going over shows a gentle warning to coaches. Leave empty for no maximum."
          check={(text) => {
            const value = read(text);
            if (value === undefined) return 'A number, or leave it empty';
            return value !== null && value < (total?.min_credits ?? 0) ? 'Can’t be less than the required credits' : null;
          }}
          onSave={(text) =>
            save(targetWrites.save(team.id, season.id, null, total, total?.min_credits ?? 0, read(text) ?? null))
          }
        />
      </Card>

      <Card
        title="Required from one activity"
        hint={`Part of the target that has to come from a specific activity, for example at least 3 credits of Lift every ${per}. Leave empty for none.`}
      >
        {setup.types.map((type) => {
          const target = setup.targets.find((t) => t.activity_type_id === type.id) ?? null;
          return (
            <SavedField
              key={type.id}
              label={type.name}
              saved={target && target.min_credits > 0 ? String(target.min_credits) : ''}
              placeholder="None"
              keyboardType="decimal-pad"
              check={checkCredits}
              onSave={(text) =>
                save(
                  targetWrites.save(team.id, season.id, type.id, target, read(text) ?? 0, target?.max_credits ?? null),
                )
              }
            />
          );
        })}
      </Card>

      <SpecialWeeks team={team} setup={setup} save={save} />

      <Card title="Season" hint="The season sets the range for season totals. Two-week periods count from the Monday of its first week.">
        <SavedField
          label="Name"
          saved={season.name}
          check={(text) => (text.trim().length < 1 || text.trim().length > 60 ? 'Between 1 and 60 letters' : null)}
          onSave={(name) => save(seasonWrites.update(season.id, { name }))}
        />
        <View style={styles.dates}>
          <View style={styles.date}>
            <SavedField
              label="First day"
              saved={season.start_date}
              placeholder="YYYY-MM-DD"
              keyboardType="numbers-and-punctuation"
              check={(text) =>
                !isDate(text) ? 'Like 2026-09-01' : text > season.end_date ? 'After the last day' : null
              }
              onSave={(start_date) => save(seasonWrites.update(season.id, { start_date }))}
            />
          </View>
          <View style={styles.date}>
            <SavedField
              label="Last day"
              saved={season.end_date}
              placeholder="YYYY-MM-DD"
              keyboardType="numbers-and-punctuation"
              check={(text) =>
                !isDate(text) ? 'Like 2027-06-01' : text < season.start_date ? 'Before the first day' : null
              }
              onSave={(end_date) => save(seasonWrites.update(season.id, { end_date }))}
            />
          </View>
        </View>
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  dates: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  date: {
    flex: 1,
  },
  small: {
    fontSize: fontSize.sm,
  },
});
