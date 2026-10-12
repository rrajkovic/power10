import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { Chips } from '@/components/Chips';
import { TextField } from '@/components/TextField';
import { ErrorText, Muted } from '@/components/Typography';
import { fontSize, fontWeight, spacing, type Palette } from '@/constants/theme';
import { visibleAccent } from '@/lib/color';
import { periodLabel } from '@/lib/progress';
import {
  overrideWrites,
  parseCredits,
  useUpcomingPeriods,
  type TargetOverride,
} from '@/lib/settings';
import type { MyTeam } from '@/lib/teams';
import { useTheme, useThemedStyles } from '@/lib/theme';
import { Card, SmallButton } from './parts';
import type { Save, Setup } from './types';

// How many periods ahead can be planned.
const PERIODS_AHEAD = 12;

const KINDS = [
  { value: 'Taper', label: 'Taper' },
  { value: 'Race', label: 'Race' },
  { value: 'Test', label: 'Test' },
  { value: 'Other', label: 'Other' },
];

const PERIOD_WORDS = { week: 'Weeks', two_weeks: 'Two-week blocks', month: 'Months' } as const;

// Taper, race and test weeks: a different target for one period, set as far
// ahead as you like. Every other period keeps the usual target.
export function SpecialWeeks({ team, setup, save }: { team: MyTeam; setup: Setup; save: Save }) {
  const styles = useThemedStyles(makeStyles);
  const periods = useUpcomingPeriods(team, PERIODS_AHEAD);
  // The start date of the period being edited.
  const [open, setOpen] = useState<string | null>(null);

  const season = setup.season;
  if (!season) return null;
  const usual = setup.targets.find((target) => target.activity_type_id === null) ?? null;

  return (
    <Card
      title="Taper, race and test weeks"
      hint={`${PERIOD_WORDS[team.targetPeriod]} with their own target. Set them ahead of time; everything else keeps the usual target.`}
    >
      {periods.isLoading ? (
        <Muted style={styles.small}>Loading…</Muted>
      ) : periods.isError ? (
        <ErrorText>Couldn’t load the coming weeks.</ErrorText>
      ) : (
        periods.data
          // A special target belongs to a season, so stop at its last day.
          ?.filter((period) => period.start <= season.end_date)
          .map((period) => {
            const special =
              setup.overrides.find(
                (o) => o.period_start === period.start && o.activity_type_id === null,
              ) ?? null;
            return (
              <View key={period.start} style={styles.row}>
                <View style={styles.rowHeader}>
                  <View style={styles.grow}>
                    <Text style={styles.dates}>
                      {periodLabel(team.targetPeriod, period.start, period.end)}
                      {period.isCurrent ? ' · now' : ''}
                    </Text>
                    {special ? (
                      <Text style={styles.special}>
                        {special.label || 'Special'} · {describe(special.min_credits, special.max_credits)}
                      </Text>
                    ) : (
                      <Muted style={styles.small}>
                        Usual · {describe(usual?.min_credits ?? 0, usual?.max_credits ?? null)}
                      </Muted>
                    )}
                  </View>
                  <SmallButton
                    title={open === period.start ? 'Close' : 'Change'}
                    onPress={() => setOpen(open === period.start ? null : period.start)}
                  />
                </View>
                {open === period.start ? (
                  <Editor
                    special={special}
                    usualMin={usual?.min_credits ?? 0}
                    accentHex={team.accentPrimary}
                    onSave={(values) => {
                      save(overrideWrites.save(team.id, season.id, period.start, special, values));
                      setOpen(null);
                    }}
                    onRemove={() => {
                      if (special) save(overrideWrites.remove(special.id));
                      setOpen(null);
                    }}
                  />
                ) : null}
              </View>
            );
          })
      )}
    </Card>
  );
}

// "6 credits", "6 credits, max 15".
function describe(min: number, max: number | null): string {
  const credits = `${min} ${min === 1 ? 'credit' : 'credits'}`;
  return max === null ? credits : `${credits}, max ${max}`;
}

function Editor({
  special,
  usualMin,
  accentHex,
  onSave,
  onRemove,
}: {
  special: TargetOverride | null;
  usualMin: number;
  accentHex: string;
  onSave: (values: { label: string | null; minCredits: number; maxCredits: number | null }) => void;
  onRemove: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const { scheme } = useTheme();
  const known = KINDS.some((kind) => kind.value === special?.label && kind.value !== 'Other');
  const [kind, setKind] = useState(special ? (known ? special.label! : 'Other') : 'Taper');
  const [name, setName] = useState(special && !known ? (special.label ?? '') : '');
  // A taper is usually about half; a sensible place to start.
  const [min, setMin] = useState(String(special?.min_credits ?? Math.floor(usualMin / 2)));
  const [max, setMax] = useState(special?.max_credits == null ? '' : String(special.max_credits));

  const minValue = parseCredits(min);
  const maxValue = max.trim() ? parseCredits(max) : null;
  const maxProblem =
    max.trim() && maxValue === null
      ? 'A number, or leave it empty'
      : maxValue !== null && minValue !== null && maxValue < minValue
        ? 'Can’t be less than the required credits'
        : null;
  const label = kind === 'Other' ? name.trim() || null : kind;

  return (
    <View style={styles.editor}>
      <Chips
        options={KINDS}
        value={kind}
        onChange={(value) => value && setKind(value)}
        accent={visibleAccent(accentHex, scheme)}
      />
      {kind === 'Other' ? (
        <TextField placeholder="What is it? (e.g. Training camp)" value={name} onChangeText={setName} maxLength={60} />
      ) : null}
      <View style={styles.numbers}>
        <View style={styles.grow}>
          <TextField
            label="Required credits"
            value={min}
            onChangeText={setMin}
            keyboardType="decimal-pad"
            error={minValue === null ? 'A number' : null}
          />
        </View>
        <View style={styles.grow}>
          <TextField
            label="Maximum (optional)"
            value={max}
            onChangeText={setMax}
            placeholder="None"
            keyboardType="decimal-pad"
            error={maxProblem}
          />
        </View>
      </View>
      <Button
        title="Save"
        disabled={minValue === null || !!maxProblem}
        onPress={() => minValue !== null && onSave({ label, minCredits: minValue, maxCredits: maxValue })}
      />
      {special ? (
        <View style={styles.center}>
          <SmallButton title="Back to the usual target" quiet onPress={onRemove} />
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    small: {
      fontSize: fontSize.sm,
    },
    grow: {
      flex: 1,
    },
    row: {
      gap: spacing.sm,
      paddingTop: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    rowHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    dates: {
      fontSize: fontSize.md,
      fontWeight: fontWeight.semibold,
      color: colors.text,
    },
    special: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.semibold,
      color: colors.caution,
    },
    editor: {
      gap: spacing.md,
    },
    numbers: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    center: {
      alignItems: 'center',
    },
  });
