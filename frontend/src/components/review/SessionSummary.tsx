import { Image, StyleSheet, Text, View } from 'react-native';
import { Muted } from '@/components/Typography';
import { fontSize, fontWeight, radius, spacing, type Palette } from '@/constants/theme';
import { dayLabel, formatDuration } from '@/lib/logging';
import { formatMetric } from '@/lib/progress';
import { usePhotoUrls } from '@/lib/review';
import { useThemedStyles } from '@/lib/theme';

type Summary = {
  session_date: string;
  activity_name: string;
  intensity_name: string | null;
  custom_label: string | null;
  duration_seconds: number;
  distance_meters: number | null;
  credits: number;
  flag_note: string | null;
  photo_paths: string[];
};

// What was logged, why it was flagged, and the photos: shared by the
// athlete's review screen and the coaches' list.
export function SessionSummary({ session, today }: { session: Summary; today: string }) {
  const styles = useThemedStyles(makeStyles);
  const photos = usePhotoUrls(session.photo_paths);
  const activity = session.custom_label
    ? `${session.activity_name} (${session.custom_label})`
    : session.activity_name;

  return (
    <View style={styles.wrapper}>
      <Text style={styles.title}>
        {activity}
        {session.intensity_name ? ` · ${session.intensity_name}` : ''}
      </Text>
      <Muted style={styles.small}>
        {dayLabel(session.session_date, today)} · {formatDuration(session.duration_seconds)}
        {session.distance_meters ? ` · ${formatMetric('distance', session.distance_meters)}` : ''} ·{' '}
        {formatMetric('credits', session.credits)} credits
      </Muted>
      {session.flag_note ? (
        <View style={styles.flag}>
          <Text style={styles.flagText}>{session.flag_note}</Text>
        </View>
      ) : null}
      {photos.data?.length ? (
        <View style={styles.photos}>
          {photos.data.map((url) => (
            <Image key={url} source={{ uri: url }} style={styles.photo} resizeMode="cover" />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    wrapper: {
      gap: spacing.sm,
    },
    title: {
      fontSize: fontSize.md,
      fontWeight: fontWeight.semibold,
      color: colors.text,
    },
    small: {
      fontSize: fontSize.sm,
    },
    flag: {
      padding: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.caution,
    },
    flagText: {
      fontSize: fontSize.sm,
      color: colors.caution,
    },
    photos: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    photo: {
      width: 140,
      height: 140,
      borderRadius: radius.md,
      backgroundColor: colors.track,
    },
  });
