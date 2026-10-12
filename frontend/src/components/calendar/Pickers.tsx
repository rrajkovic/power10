import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Chips } from '@/components/Chips';
import { TextField } from '@/components/TextField';
import { ErrorText, Label } from '@/components/Typography';
import { fontSize, fontWeight, radius, spacing, type Palette } from '@/constants/theme';
import { readableOn } from '@/lib/color';
import { addMonths, formatTime, longDay, monthGrid, monthOf, monthTitle } from '@/lib/calendar';
import { useThemedStyles } from '@/lib/theme';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

// A date you pick by tapping a small month, not by typing. Shows the chosen
// day; tapping it opens the month.
export function DateField({
  label,
  value,
  onChange,
  accent,
  // Days before this can't be picked (for "repeat until").
  earliest,
  error,
}: {
  label: string;
  value: string;
  onChange: (day: string) => void;
  accent: string;
  earliest?: string;
  error?: string | null;
}) {
  const styles = useThemedStyles(makeStyles);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(monthOf(value));
  const days = monthGrid(month);

  return (
    <View style={styles.field}>
      <Label>{label}</Label>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${longDay(value)}. Change`}
        onPress={() => {
          setMonth(monthOf(value));
          setOpen(!open);
        }}
        style={({ pressed }) => [styles.value, open && styles.valueOpen, pressed && styles.pressed]}
      >
        <Text style={styles.valueText}>{longDay(value)}</Text>
        <Text style={styles.chevron}>{open ? '⌃' : '⌄'}</Text>
      </Pressable>
      {error ? <ErrorText>{error}</ErrorText> : null}

      {open ? (
        <View style={styles.panel}>
          <View style={styles.monthRow}>
            <Arrow label="‹" accessibilityLabel="Previous month" onPress={() => setMonth(addMonths(month, -1))} />
            <Text style={styles.monthTitle}>{monthTitle(month)}</Text>
            <Arrow label="›" accessibilityLabel="Next month" onPress={() => setMonth(addMonths(month, 1))} />
          </View>
          <View style={styles.week}>
            {WEEKDAYS.map((letter, index) => (
              <Text key={index} style={styles.weekday}>
                {letter}
              </Text>
            ))}
          </View>
          {Array.from({ length: days.length / 7 }, (_, row) => (
            <View key={row} style={styles.week}>
              {days.slice(row * 7, row * 7 + 7).map((day) => {
                const selected = day === value;
                const disabled = earliest !== undefined && day < earliest;
                return (
                  <Pressable
                    key={day}
                    accessibilityRole="button"
                    accessibilityLabel={longDay(day)}
                    accessibilityState={{ selected, disabled }}
                    disabled={disabled}
                    onPress={() => {
                      onChange(day);
                      setOpen(false);
                    }}
                    style={styles.day}
                  >
                    <View style={[styles.dayCircle, selected && { backgroundColor: accent }]}>
                      <Text
                        style={[
                          styles.dayNumber,
                          (monthOf(day) !== month || disabled) && styles.faded,
                          selected && { color: readableOn(accent), fontWeight: fontWeight.bold },
                        ]}
                      >
                        {Number(day.slice(8))}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const HOURS = Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }));
// One tap for the common ones; any other minute can be typed.
const MINUTES = ['00', '15', '30', '45'].map((m) => ({ value: m, label: `:${m}` }));
const HALVES = [
  { value: 'am', label: 'AM' },
  { value: 'pm', label: 'PM' },
];

// A time you pick by tapping the hour and AM or PM, and tapping or typing the
// minutes (any minute from 0 to 59). `value` is 'HH:MM' on a 24-hour clock,
// or null for "no particular time".
export function TimeField({
  label,
  value,
  onChange,
  accent,
}: {
  label: string;
  value: string | null;
  onChange: (time: string | null) => void;
  accent: string;
}) {
  const styles = useThemedStyles(makeStyles);
  const [open, setOpen] = useState(false);
  // What's in the minutes box while it's being typed in.
  const [typedMinute, setTypedMinute] = useState<string | null>(null);

  const hour24 = value ? Number(value.slice(0, 2)) : null;
  const minute = value ? value.slice(3, 5) : null;
  const half = hour24 === null ? null : hour24 < 12 ? 'am' : 'pm';
  const hour12 = hour24 === null ? null : hour24 % 12 === 0 ? 12 : hour24 % 12;

  // Any one choice sets a full time; the others start from sensible defaults.
  function set(next: { hour?: number; minute?: string; half?: string }) {
    const h = next.hour ?? hour12 ?? 7;
    const m = next.minute ?? minute ?? '00';
    const ampm = next.half ?? half ?? 'am';
    const as24 = (h % 12) + (ampm === 'pm' ? 12 : 0);
    onChange(`${String(as24).padStart(2, '0')}:${m}`);
  }

  function typeMinute(text: string) {
    const digits = text.replace(/[^0-9]/g, '').slice(0, 2);
    setTypedMinute(digits);
    // Saved as soon as it's a real minute; an empty box leaves the time alone.
    if (digits !== '' && Number(digits) <= 59) set({ minute: digits.padStart(2, '0') });
  }
  const minuteText = typedMinute ?? minute ?? '';
  const minuteInvalid = typedMinute !== null && typedMinute !== '' && Number(typedMinute) > 59;

  return (
    <View style={styles.field}>
      <Label>{label}</Label>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value ? formatTime(value) : 'none'}. Change`}
        onPress={() => setOpen(!open)}
        style={({ pressed }) => [styles.value, open && styles.valueOpen, pressed && styles.pressed]}
      >
        <Text style={[styles.valueText, !value && styles.placeholder]}>
          {value ? formatTime(value) : 'No time'}
        </Text>
        <Text style={styles.chevron}>{open ? '⌃' : '⌄'}</Text>
      </Pressable>

      {open ? (
        <View style={[styles.panel, styles.timePanel]}>
          <Chips
            options={HOURS}
            value={hour12 === null ? null : String(hour12)}
            onChange={(v) => v && set({ hour: Number(v) })}
            accent={accent}
          />
          <View style={styles.minutes}>
            <Chips
              options={MINUTES}
              value={minute}
              onChange={(v) => {
                if (!v) return;
                setTypedMinute(null);
                set({ minute: v });
              }}
              accent={accent}
            />
            <View style={styles.minuteBox}>
              <TextField
                value={minuteText}
                onChangeText={typeMinute}
                onBlur={() => setTypedMinute(null)}
                placeholder="min"
                keyboardType="number-pad"
                maxLength={2}
                accessibilityLabel="Minutes"
                error={minuteInvalid ? '0 to 59' : null}
              />
            </View>
          </View>
          <Chips options={HALVES} value={half} onChange={(v) => v && set({ half: v })} accent={accent} />
          <View style={styles.timeActions}>
            {value ? (
              <Pressable accessibilityRole="button" onPress={() => onChange(null)} hitSlop={8}>
                <Text style={styles.link}>No time</Text>
              </Pressable>
            ) : (
              <View />
            )}
            <Pressable accessibilityRole="button" onPress={() => setOpen(false)} hitSlop={8}>
              <Text style={styles.link}>Done</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function Arrow({ label, accessibilityLabel, onPress }: { label: string; accessibilityLabel: string; onPress: () => void }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      hitSlop={10}
      style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}
    >
      <Text style={styles.arrowText}>{label}</Text>
    </Pressable>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    field: {
      gap: spacing.xs,
    },
    value: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingVertical: spacing.md + 2,
      paddingHorizontal: spacing.lg,
    },
    valueOpen: {
      borderColor: colors.primary,
    },
    valueText: {
      fontSize: fontSize.md,
      color: colors.text,
    },
    placeholder: {
      color: colors.textMuted,
    },
    chevron: {
      fontSize: fontSize.md,
      color: colors.textMuted,
    },
    pressed: {
      opacity: 0.6,
    },
    panel: {
      padding: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    timePanel: {
      gap: spacing.md,
    },
    minutes: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    minuteBox: {
      width: 76,
    },
    timeActions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    link: {
      fontSize: fontSize.md,
      fontWeight: fontWeight.semibold,
      color: colors.text,
    },
    monthRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.xs,
    },
    monthTitle: {
      fontSize: fontSize.md,
      fontWeight: fontWeight.bold,
      color: colors.text,
    },
    arrow: {
      width: 40,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    arrowText: {
      fontSize: fontSize.lg,
      color: colors.text,
    },
    week: {
      flexDirection: 'row',
    },
    weekday: {
      flex: 1,
      textAlign: 'center',
      fontSize: fontSize.xs,
      fontWeight: fontWeight.semibold,
      color: colors.textMuted,
      paddingBottom: spacing.xs,
    },
    day: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 2,
    },
    dayCircle: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayNumber: {
      fontSize: fontSize.md,
      color: colors.text,
    },
    faded: {
      color: colors.textMuted,
      opacity: 0.45,
    },
  });
