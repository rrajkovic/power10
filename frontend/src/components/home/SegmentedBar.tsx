import { StyleSheet, View } from 'react-native';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/lib/theme';

// Equinox-style progress: a bar split into a few segments that fill left to
// right. `progress` is 0–1 (anything above 1 shows as full).
export function SegmentedBar({
  progress,
  color,
  segments = 3,
}: {
  progress: number;
  color: string;
  segments?: number;
}) {
  const { colors } = useTheme();
  const filled = Math.max(0, Math.min(1, progress)) * segments;

  return (
    <View style={styles.row}>
      {Array.from({ length: segments }, (_, i) => {
        const fill = Math.max(0, Math.min(1, filled - i));
        return (
          <View key={i} style={[styles.segment, { backgroundColor: colors.track }]}>
            <View style={[styles.fill, { width: `${fill * 100}%`, backgroundColor: color }]} />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  segment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 2,
  },
});
