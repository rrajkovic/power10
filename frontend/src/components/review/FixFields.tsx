import { StyleSheet, View } from 'react-native';
import { Chips } from '@/components/Chips';
import { TextField } from '@/components/TextField';
import { Label } from '@/components/Typography';
import { spacing } from '@/constants/theme';
import {
  durationInput,
  parseDistanceMeters,
  parseDurationSeconds,
  useLoggingOptions,
} from '@/lib/logging';

// The corrected values for a flagged workout, as typed.
export type Fix = {
  typeId: string;
  intensityId: string | null;
  duration: string;
  // In kilometers.
  distance: string;
};

// A fix starts from what was logged.
export function fixFrom(session: {
  activity_type_id: string;
  intensity_id: string | null;
  duration_seconds: number;
  distance_meters: number | null;
}): Fix {
  return {
    typeId: session.activity_type_id,
    intensityId: session.intensity_id,
    duration: durationInput(session.duration_seconds),
    distance: session.distance_meters ? String(session.distance_meters / 1000) : '',
  };
}

// Turns what was typed into numbers; `valid` is false until they make sense.
export function readFix(fix: Fix) {
  const durationSeconds = parseDurationSeconds(fix.duration);
  const distanceMeters = parseDistanceMeters(fix.distance, 'km');
  const distanceInvalid = Number.isNaN(distanceMeters);
  return {
    durationSeconds,
    distanceMeters: distanceInvalid ? null : distanceMeters,
    distanceInvalid,
    valid: durationSeconds !== null && !distanceInvalid,
  };
}

// Activity, intensity, time and distance: used by the athlete fixing their
// own flagged workout and by a coach fixing someone's.
export function FixFields({
  teamId,
  accent,
  fix,
  onChange,
}: {
  teamId: string;
  accent: string;
  fix: Fix;
  onChange: (fix: Fix) => void;
}) {
  const options = useLoggingOptions(teamId);
  const { durationSeconds, distanceInvalid } = readFix(fix);

  return (
    <View style={styles.fields}>
      <View style={styles.field}>
        <Label>Activity</Label>
        <Chips
          options={(options.data?.types ?? []).map((t) => ({ value: t.id, label: t.name }))}
          value={fix.typeId}
          onChange={(typeId) => typeId && onChange({ ...fix, typeId })}
          accent={accent}
        />
      </View>
      {options.data?.intensities.length ? (
        <View style={styles.field}>
          <Label>Intensity</Label>
          <Chips
            options={options.data.intensities.map((i) => ({ value: i.id, label: i.name }))}
            value={fix.intensityId}
            onChange={(intensityId) => onChange({ ...fix, intensityId })}
            accent={accent}
            allowNone
          />
        </View>
      ) : null}
      <View style={styles.field}>
        <Label>Time</Label>
        <TextField
          placeholder="45, 1h 15m or 39:40"
          value={fix.duration}
          onChangeText={(duration) => onChange({ ...fix, duration })}
          keyboardType="numbers-and-punctuation"
          autoCapitalize="none"
          autoCorrect={false}
          error={durationSeconds === null ? 'Try something like 45, 1h 15m or 39:40' : null}
        />
      </View>
      <View style={styles.field}>
        <Label>Distance in km (optional)</Label>
        <TextField
          placeholder="0"
          value={fix.distance}
          onChangeText={(distance) => onChange({ ...fix, distance })}
          keyboardType="decimal-pad"
          error={distanceInvalid ? 'Enter a number' : null}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fields: {
    gap: spacing.lg,
  },
  field: {
    gap: spacing.sm,
  },
});
