import { Link, router } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fontSize, fontWeight, spacing, type Palette } from '@/constants/theme';
import { useThemedStyles } from '@/lib/theme';

function openLog() {
  router.push('/log');
}

// iOS 26+: sits in the Liquid Glass bar above the tab bar (like the mini
// player in Apple Music). The system draws two copies: a wide one, and a
// compact one next to the tab bar when it shrinks on scroll.
//
// Link.AppleZoom makes the logging sheet grow out of this bar and shrink back
// into it when closed, the way "now playing" does in Apple Music.
export function LogWorkoutAccessory() {
  const styles = useThemedStyles(makeStyles);
  const placement = NativeTabs.BottomAccessory.usePlacement();
  return (
    // The outer view fills the bar and centers the button. (The zoom wrapper
    // sits between them and takes no space of its own, so the button can't
    // be the one that stretches.)
    <View style={styles.accessory}>
      <Link href="/log" asChild>
        <Link.AppleZoom>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Log a workout"
            // The label is small; make the whole bar easy to hit.
            hitSlop={{ top: 14, bottom: 14, left: 100, right: 100 }}
            style={({ pressed }) => [styles.accessoryButton, pressed && styles.pressed]}
          >
            <Text style={styles.accessoryText}>
              {placement === 'inline' ? '＋ Log' : '＋ Log a workout'}
            </Text>
          </Pressable>
        </Link.AppleZoom>
      </Link>
    </View>
  );
}

// Android, the web and older iPhones: a floating button in the corner.
export function LogWorkoutFloatingButton() {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  // On phones the tab bar is at the bottom, so float above it.
  const bottom = Platform.OS === 'web' ? spacing.xl : insets.bottom + 96;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Log a workout"
      onPress={openLog}
      style={({ pressed }) => [styles.floating, { bottom }, pressed && styles.pressed]}
    >
      <Text style={styles.floatingText}>＋ Log a workout</Text>
    </Pressable>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    accessory: {
      flex: 1,
      alignSelf: 'stretch',
      alignItems: 'center',
      justifyContent: 'center',
    },
    accessoryButton: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
    },
    accessoryText: {
      textAlign: 'center',
      fontSize: fontSize.md,
      fontWeight: fontWeight.semibold,
      color: colors.text,
    },
    floating: {
      position: 'absolute',
      right: spacing.xl,
      paddingVertical: spacing.md + 2,
      paddingHorizontal: spacing.xl,
      borderRadius: 999,
      backgroundColor: colors.primary,
      shadowColor: '#000',
      shadowOpacity: 0.25,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
    },
    floatingText: {
      fontSize: fontSize.md,
      fontWeight: fontWeight.semibold,
      color: colors.onPrimary,
    },
    pressed: {
      opacity: 0.7,
    },
  });
