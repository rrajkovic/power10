import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Chips } from '@/components/Chips';
import { TextField } from '@/components/TextField';
import { ErrorText, Label, Muted } from '@/components/Typography';
import { fontSize, radius, spacing, type Palette } from '@/constants/theme';
import { visibleAccent } from '@/lib/color';
import { supabase } from '@/lib/supabase';
import { useTeams, type MyTeam } from '@/lib/teams';
import { useTheme, useThemedStyles } from '@/lib/theme';
import { describeWindow, type TimeWindow, type WindowSetting } from '@/lib/windows';

const OPTIONS: { value: TimeWindow; label: string }[] = [
  { value: 'forever', label: 'Any time' },
  { value: 'days', label: 'A few days' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
];

// Used when "A few days" is picked before a number is typed.
const DEFAULT_DAYS = 3;

// Team settings, admins only: how far back athletes can log a workout, and how
// long they can change or delete one. Coaches and admins are never limited.
export function AthleteRules({ team }: { team: MyTeam }) {
  const styles = useThemedStyles(makeStyles);
  const { refresh } = useTeams();

  const save = useMutation({
    mutationFn: async (change: { log?: WindowSetting; edit?: WindowSetting }) => {
      const { error } = await supabase
        .from('teams')
        .update({
          ...(change.log ? { log_window: change.log.window, log_window_days: change.log.days } : {}),
          ...(change.edit
            ? { edit_window: change.edit.window, edit_window_days: change.edit.days }
            : {}),
        })
        .eq('id', team.id);
      if (error) throw error;
      // Reload the team so every screen uses the new rule.
      await refresh();
    },
  });

  return (
    <View style={styles.card}>
      <Label>Rules for athletes</Label>
      <Muted style={styles.small}>Coaches and admins can always log and change any workout.</Muted>

      <WindowPicker
        title="Athletes can log workouts from"
        setting={team.logWindow}
        accentHex={team.accentPrimary}
        onChange={(log) => save.mutate({ log })}
      />
      <WindowPicker
        title="Athletes can change or delete workouts from"
        setting={team.editWindow}
        accentHex={team.accentPrimary}
        onChange={(edit) => save.mutate({ edit })}
      />

      {save.isError ? <ErrorText>Couldn’t save: {save.error.message}.</ErrorText> : null}
    </View>
  );
}

function WindowPicker({
  title,
  setting,
  accentHex,
  onChange,
}: {
  title: string;
  setting: WindowSetting;
  accentHex: string;
  onChange: (setting: WindowSetting) => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const { scheme } = useTheme();
  // What's typed in the days box (saved once it's a sensible number).
  const [daysText, setDaysText] = useState(String(setting.days ?? DEFAULT_DAYS));

  function pick(window: TimeWindow) {
    if (window === setting.window) return;
    const typed = Number(daysText);
    const days = Number.isInteger(typed) && typed >= 0 && typed <= 365 ? typed : DEFAULT_DAYS;
    onChange({ window, days: window === 'days' ? days : null });
  }

  function typeDays(text: string) {
    setDaysText(text);
    const days = Number(text);
    if (text.trim() && Number.isInteger(days) && days >= 0 && days <= 365) {
      onChange({ window: 'days', days });
    }
  }

  return (
    <View style={styles.picker}>
      <Muted style={styles.title}>{title}</Muted>
      <Chips
        options={OPTIONS}
        value={setting.window}
        onChange={(value) => value && pick(value)}
        accent={visibleAccent(accentHex, scheme)}
      />
      {setting.window === 'days' ? (
        <View style={styles.daysRow}>
          <View style={styles.daysInput}>
            <TextField
              value={daysText}
              onChangeText={typeDays}
              keyboardType="number-pad"
              maxLength={3}
              accessibilityLabel="Number of days"
            />
          </View>
          <Muted style={styles.small}>days back (0 = the same day only)</Muted>
        </View>
      ) : null}
      <Muted style={styles.small}>Now: {describeWindow(setting)}.</Muted>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    card: {
      gap: spacing.lg,
      padding: spacing.lg,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    picker: {
      gap: spacing.sm,
    },
    title: {
      fontSize: fontSize.md,
      color: colors.text,
    },
    small: {
      fontSize: fontSize.sm,
    },
    daysRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    daysInput: {
      width: 80,
    },
  });
