import { router } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { Platform, Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fontSize, fontWeight, spacing, type Palette } from '@/constants/theme';
import { useThemedStyles } from '@/lib/theme';

function openLog() {
  router.push('/log');
}

// iOS 26+: sits in the Liquid Glass bar above the tab bar (like the mini
// player in Apple Music). The system draws two copies: a wide one, and a
// compact one next to the tab bar when it shrinks on scroll.
export function LogWorkoutAccessory() {
  const styles = useThemedStyles(makeStyles);
  const placement = NativeTabs.BottomAccessory.usePlacement();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Log a workout"
      onPress={openLog}
      style={({ pressed }) => [styles.accessory, pressed && styles.pressed]}
    >
      <Text style={styles.accessoryText}>{placement === 'inline' ? '＋ Log' : '＋ Log a workout'}</Text>
    </Pressable>
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
      alignItems: 'center',
      justifyContent: 'center',
    },
    accessoryText: {
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
