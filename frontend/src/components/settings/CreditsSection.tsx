import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { Chips } from '@/components/Chips';
import { TextField } from '@/components/TextField';
import { Muted } from '@/components/Typography';
import { fontSize, fontWeight, spacing, type Palette } from '@/constants/theme';
import { visibleAccent } from '@/lib/color';
import { describeRule } from '@/lib/logging';
import { parseCredits, ruleWrites, type CreditRule, type RuleKind } from '@/lib/settings';
import type { MyTeam } from '@/lib/teams';
import { useTheme, useThemedStyles } from '@/lib/theme';
import { Card, SmallButton } from './parts';
import type { Save, Setup } from './types';

const KINDS: { value: RuleKind; label: string }[] = [
  { value: 'per_time', label: 'Per time' },
  { value: 'per_session', label: 'Per session' },
  { value: 'per_distance', label: 'Per distance' },
];

// How many credits each activity is worth. Every activity has one usual
// rule, and can have a different rule for an intensity.
export function CreditsSection({ team, setup, save }: { team: MyTeam; setup: Setup; save: Save }) {
  const styles = useThemedStyles(makeStyles);
  // Which rule is open for editing: "activityId|intensityId" ("" for the usual rule).
  const [open, setOpen] = useState<string | null>(null);
  const { scheme } = useTheme();
  const accent = visibleAccent(team.accentPrimary, scheme);

  // A rule for one intensity starts as a copy of the usual rule, then opens
  // for editing.
  function addFor(activityTypeId: string, intensityId: string, usual: CreditRule | null) {
    save(
      ruleWrites.save(team.id, activityTypeId, intensityId, null, {
        kind: usual?.kind ?? 'per_time',
        credits: usual?.credits ?? 1,
        perMinutes: usual?.per_minutes ?? 10,
        perMeters: usual?.per_meters ?? null,
      }),
    );
    setOpen(`${activityTypeId}|${intensityId}`);
  }

  return (
    <>
      <Muted style={styles.small}>
        A change only affects workouts logged from now on. Workouts already logged keep the credits
        they were given.
      </Muted>
      {setup.types.map((type) => {
        const rules = setup.rules.filter((rule) => rule.activity_type_id === type.id);
        const usual = rules.find((rule) => rule.intensity_id === null) ?? null;
        // Intensities that don't have their own rule yet.
        const free = setup.intensities.filter(
          (intensity) => !rules.some((rule) => rule.intensity_id === intensity.id),
        );
        const lines: { key: string; label: string; intensityId: string | null; rule: CreditRule | null }[] = [
          { key: `${type.id}|`, label: 'Usually', intensityId: null, rule: usual },
          ...setup.intensities.flatMap((intensity) => {
            const rule = rules.find((r) => r.intensity_id === intensity.id);
            return rule
              ? [{ key: `${type.id}|${intensity.id}`, label: intensity.name, intensityId: intensity.id, rule }]
              : [];
          }),
        ];

        return (
          <Card key={type.id} title={type.name}>
            {lines.map((line) => (
              <View key={line.key} style={styles.line}>
                <View style={styles.lineHeader}>
                  <View style={styles.grow}>
                    <Text style={styles.lineLabel}>{line.label}</Text>
                    <Muted style={styles.small}>{describeRule(line.rule)}</Muted>
                  </View>
                  <SmallButton
                    title={open === line.key ? 'Close' : 'Change'}
                    onPress={() => setOpen(open === line.key ? null : line.key)}
                  />
                </View>
                {open === line.key ? (
                  <RuleEditor
                    rule={line.rule}
                    accentHex={team.accentPrimary}
                    canRemove={line.intensityId !== null && line.rule !== null}
                    onSave={(values) => {
                      save(ruleWrites.save(team.id, type.id, line.intensityId, line.rule, values));
                      setOpen(null);
                    }}
                    onRemove={() => {
                      if (line.rule) save(ruleWrites.remove(line.rule.id));
                      setOpen(null);
                    }}
                  />
                ) : null}
              </View>
            ))}

            {free.length ? (
              <View style={styles.line}>
                <Muted style={styles.small}>Add a different rule for:</Muted>
                <Chips
                  options={free.map((intensity) => ({ value: intensity.id, label: intensity.name }))}
                  value={null}
                  onChange={(intensityId) => intensityId && addFor(type.id, intensityId, usual)}
                  accent={accent}
                />
              </View>
            ) : null}
          </Card>
        );
      })}
    </>
  );
}

function RuleEditor({
  rule,
  accentHex,
  canRemove,
  onSave,
  onRemove,
}: {
  rule: CreditRule | null;
  accentHex: string;
  canRemove: boolean;
  onSave: (values: { kind: RuleKind; credits: number; perMinutes: number | null; perMeters: number | null }) => void;
  onRemove: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const { scheme } = useTheme();
  const [kind, setKind] = useState<RuleKind>(rule?.kind ?? 'per_time');
  const [credits, setCredits] = useState(String(rule?.credits ?? 1));
  const [minutes, setMinutes] = useState(String(rule?.per_minutes ?? 10));
  const [km, setKm] = useState(String((rule?.per_meters ?? 2000) / 1000));

  const creditsValue = parseCredits(credits);
  const minutesValue = Number(minutes.replace(',', '.'));
  const kmValue = Number(km.replace(',', '.'));
  const minutesOk = Number.isFinite(minutesValue) && minutesValue > 0 && minutesValue <= 1440;
  const kmOk = Number.isFinite(kmValue) && kmValue > 0 && kmValue <= 1000;
  const valid =
    creditsValue !== null && (kind !== 'per_time' || minutesOk) && (kind !== 'per_distance' || kmOk);

  return (
    <View style={styles.editor}>
      <Chips
        options={KINDS}
        value={kind}
        onChange={(value) => value && setKind(value)}
        accent={visibleAccent(accentHex, scheme)}
      />
      <View style={styles.numbers}>
        <View style={styles.number}>
          <TextField
            label="Credits"
            value={credits}
            onChangeText={setCredits}
            keyboardType="decimal-pad"
            error={creditsValue === null ? 'A number' : null}
          />
        </View>
        {kind === 'per_time' ? (
          <View style={styles.number}>
            <TextField
              label="for every (minutes)"
              value={minutes}
              onChangeText={setMinutes}
              keyboardType="decimal-pad"
              error={minutesOk ? null : 'More than 0'}
            />
          </View>
        ) : null}
        {kind === 'per_distance' ? (
          <View style={styles.number}>
            <TextField
              label="for every (km)"
              value={km}
              onChangeText={setKm}
              keyboardType="decimal-pad"
              error={kmOk ? null : 'More than 0'}
            />
          </View>
        ) : null}
      </View>
      <Muted style={styles.small}>
        {kind === 'per_session'
          ? 'The same credits for every workout, however long.'
          : kind === 'per_time'
            ? 'Longer workouts earn more.'
            : 'Rewards covering more distance. A workout logged without a distance earns nothing.'}
      </Muted>
      <Button
        title="Save rule"
        disabled={!valid}
        onPress={() =>
          creditsValue !== null &&
          onSave({
            kind,
            credits: creditsValue,
            perMinutes: kind === 'per_time' ? minutesValue : null,
            perMeters: kind === 'per_distance' ? Math.round(kmValue * 1000) : null,
          })
        }
      />
      {canRemove ? (
        <View style={styles.center}>
          <SmallButton title="Remove this rule (use the usual one)" quiet onPress={onRemove} />
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
    line: {
      gap: spacing.sm,
      paddingTop: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    lineHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    lineLabel: {
      fontSize: fontSize.md,
      fontWeight: fontWeight.semibold,
      color: colors.text,
    },
    editor: {
      gap: spacing.md,
    },
    numbers: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    number: {
      flex: 1,
    },
    center: {
      alignItems: 'center',
    },
  });
