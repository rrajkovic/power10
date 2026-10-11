import { router } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '@/components/Avatar';
import { Muted } from '@/components/Typography';
import { fontSize, fontWeight, radius, spacing, type Palette } from '@/constants/theme';
import { verificationLabel, type FeedSession } from '@/lib/feed';
import { dayLabel, formatDuration } from '@/lib/logging';
import { formatMetric } from '@/lib/progress';
import { usePhotoUrls } from '@/lib/review';
import { useThemedStyles } from '@/lib/theme';
import { ReactionBar } from './ReactionBar';

type Props = {
  session: FeedSession;
  accent: string;
  today: string;
  // Photo-check labels are only for the athlete and for admins.
  showVerification: boolean;
  // On the session's own screen: bigger photos, and tapping does nothing.
  detail?: boolean;
};

// One workout: who, what, the numbers, photos and reactions.
export function SessionCard({ session, accent, today, showVerification, detail = false }: Props) {
  const styles = useThemedStyles(makeStyles);
  const photos = usePhotoUrls(session.photos.map((photo) => photo.storage_path));
  const name = session.athlete?.name || 'Unnamed';
  const activity = session.custom_label
    ? `${session.activity?.name ?? 'Workout'} (${session.custom_label})`
    : (session.activity?.name ?? 'Workout');
  const verification = showVerification ? verificationLabel(session.verification_status) : null;
  const commentCount = session.comments[0]?.count ?? 0;
  const loggedByCoach = session.logged_by !== null && session.logged_by !== session.athlete_id;

  const body = (
    <>
      <View style={styles.header}>
        <Avatar name={name} color={accent} size={40} />
        <View style={styles.headerText}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          <Muted style={styles.small}>
            {dayLabel(session.session_date, today)}
            {loggedByCoach ? ' · logged by coach' : ''}
          </Muted>
        </View>
        <View style={styles.credits}>
          <Text style={[styles.creditsValue, { color: accent }]}>
            {formatMetric('credits', session.credits)}
          </Text>
          <Muted style={styles.tiny}>credits</Muted>
        </View>
      </View>

      <Text style={styles.activity}>
        {activity}
        {session.intensity ? ` · ${session.intensity.name}` : ''}
      </Text>
      <Muted style={styles.small}>
        {formatDuration(session.duration_seconds)}
        {session.distance_meters ? ` · ${formatMetric('distance', session.distance_meters)}` : ''}
      </Muted>

      {session.notes ? (
        <Text style={styles.notes} numberOfLines={detail ? undefined : 3}>
          {session.notes}
        </Text>
      ) : null}

      {photos.data?.length ? (
        <View style={styles.photos}>
          {photos.data.map((url) => (
            <Image
              key={url}
              source={{ uri: url }}
              style={detail ? styles.photoLarge : styles.photo}
              resizeMode="cover"
            />
          ))}
        </View>
      ) : null}

      {verification ? (
        <Muted style={styles.small}>
          {verification}
          {session.verification_status === 'flagged' && session.verification_note
            ? `: ${session.verification_note}`
            : ''}
        </Muted>
      ) : null}
    </>
  );

  return (
    <View style={styles.card}>
      {detail ? (
        <View style={styles.body}>{body}</View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${name}, ${activity}. Open workout`}
          onPress={() => router.push({ pathname: '/session/[id]', params: { id: session.id } })}
          style={({ pressed }) => [styles.body, pressed && styles.pressed]}
        >
          {body}
        </Pressable>
      )}
      <ReactionBar session={session} accent={accent} />
      {detail ? null : (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/session/[id]', params: { id: session.id } })}
          hitSlop={8}
        >
          <Muted style={styles.small}>
            {commentCount === 0
              ? 'Add a comment'
              : commentCount === 1
                ? '1 comment'
                : `${commentCount} comments`}
          </Muted>
        </Pressable>
      )}
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    card: {
      gap: spacing.md,
      padding: spacing.lg,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    body: {
      gap: spacing.sm,
    },
    pressed: {
      opacity: 0.7,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    headerText: {
      flex: 1,
      gap: 2,
    },
    name: {
      fontSize: fontSize.md,
      fontWeight: fontWeight.bold,
      color: colors.text,
    },
    small: {
      fontSize: fontSize.sm,
    },
    tiny: {
      fontSize: fontSize.xs,
    },
    credits: {
      alignItems: 'flex-end',
    },
    creditsValue: {
      fontSize: fontSize.lg,
      fontWeight: fontWeight.heavy,
    },
    activity: {
      fontSize: fontSize.lg,
      fontWeight: fontWeight.semibold,
      color: colors.text,
    },
    notes: {
      fontSize: fontSize.md,
      color: colors.text,
    },
    photos: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    photo: {
      width: 96,
      height: 96,
      borderRadius: radius.md,
      backgroundColor: colors.track,
    },
    photoLarge: {
      width: '100%',
      aspectRatio: 1,
      borderRadius: radius.md,
      backgroundColor: colors.track,
    },
  });
