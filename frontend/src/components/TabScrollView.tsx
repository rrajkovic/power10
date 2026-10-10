import { useQueryClient } from '@tanstack/react-query';
import { BlurView } from 'expo-blur';
import { useState, type PropsWithChildren, type ReactNode } from 'react';
import { Platform, RefreshControl, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing, type Palette } from '@/constants/theme';
import { progressKey } from '@/lib/progress';
import { useTheme, useThemedStyles } from '@/lib/theme';

const isIOS = Platform.OS === 'ios';
// On the web the tab bar sits at the top of the page instead of the bottom.
const WEB_TAB_BAR_HEIGHT = Platform.OS === 'web' ? 64 : 0;
// Room to scroll the last rows above the floating tab bar.
const TAB_BAR_CLEARANCE = Platform.OS === 'web' ? spacing.xxl : 96;
// Height of the pinned top bar (below the status bar).
const HEADER_BAR_HEIGHT = 60;
// The top bar comes back this long after scrolling stops.
const SHOW_AFTER_MS = 250;

// The page used by every tab.
// - `background` stays fixed behind everything (e.g. the team glow), so it
//   doesn't move when you scroll or pull to refresh.
// - `header` is a frosted, blurred bar at the top. It fades and slides away
//   while you scroll down, and slides back when you stop or scroll up.
// - Pull to refresh shows the spinner below the header.
export function TabScrollView({
  children,
  background,
  header,
}: PropsWithChildren<{ background?: ReactNode; header?: ReactNode }>) {
  const styles = useThemedStyles(makeStyles);
  const { scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const headerHeight = insets.top + WEB_TAB_BAR_HEIGHT + (header ? HEADER_BAR_HEIGHT : 0);

  // How far the content has scrolled (0 = at the top).
  const scrolled = useSharedValue(0);
  // Which way the last scroll went (0 = up or at the top, 1 = down), eased.
  const target = useSharedValue(0);
  const down = useSharedValue(0);
  // Goes from 0 to 1 once scrolling has stopped. Every scroll event restarts it.
  const idle = useSharedValue(1);

  const onScroll = useAnimatedScrollHandler((event) => {
    // On iOS the content starts at -headerHeight (it's inset below the header).
    const y = event.contentOffset.y + (isIOS ? headerHeight : 0);
    const moved = y - scrolled.value;
    scrolled.value = y;

    // Hide while scrolling down; show at the top of the page (including while
    // pulling to refresh) and when scrolling back up.
    const next = y <= 0 || moved < -1 ? 0 : moved > 1 ? 1 : target.value;

    // If the header was (partly) back because scrolling had stopped, carry on
    // from where it is now instead of jumping.
    const wasIdle = idle.value > 0;
    if (wasIdle) down.value = down.value * (1 - idle.value);
    if (wasIdle || next !== target.value) {
      target.value = next;
      down.value = withTiming(next, { duration: 200 });
    }

    // Bring it back once scrolling has stopped.
    idle.value = 0;
    idle.value = withDelay(SHOW_AFTER_MS, withTiming(1, { duration: 250 }));
  });

  // 0 = shown, 1 = hidden.
  const headerStyle = useAnimatedStyle(() => {
    const hidden = down.value * (1 - idle.value);
    return {
      opacity: 1 - hidden,
      transform: [{ translateY: -hidden * headerHeight }],
    };
  });

  async function handleRefresh() {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: progressKey });
    setRefreshing(false);
  }

  return (
    <View style={styles.screen}>
      {background ? <View style={StyleSheet.absoluteFill}>{background}</View> : null}

      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        // We position everything ourselves. ("automatic" also made iOS reset
        // the scroll position whenever a native menu opened.)
        contentInsetAdjustmentBehavior="never"
        // iOS: inset the content below the header, so the refresh spinner
        // appears under it and content can still scroll up behind it.
        contentInset={isIOS ? { top: headerHeight } : undefined}
        contentOffset={isIOS ? { x: 0, y: -headerHeight } : undefined}
        scrollIndicatorInsets={isIOS ? { top: headerHeight } : undefined}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: (isIOS ? 0 : headerHeight) + spacing.md,
            paddingBottom: insets.bottom + TAB_BAR_CLEARANCE,
          },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            // Android: draw the spinner below the header.
            progressViewOffset={headerHeight}
          />
        }
      >
        {children}
      </Animated.ScrollView>

      {header ? (
        <Animated.View style={[styles.header, { height: headerHeight }, headerStyle]}>
          <BlurView
            intensity={80}
            tint={
              isIOS
                ? scheme === 'dark'
                  ? 'systemChromeMaterialDark'
                  : 'systemChromeMaterialLight'
                : scheme === 'dark'
                  ? 'dark'
                  : 'light'
            }
            style={StyleSheet.absoluteFill}
          />
          {/* A hairline under the bar. Android doesn't blur here, so it also
              gets a nearly solid background. */}
          <View style={[StyleSheet.absoluteFill, styles.frost]} />
          <View style={[styles.headerContent, { paddingTop: insets.top + WEB_TAB_BAR_HEIGHT }]}>
            {header}
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      gap: spacing.xl,
      width: '100%',
      maxWidth: 640,
      alignSelf: 'center',
    },
    header: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      overflow: 'hidden',
    },
    frost: {
      backgroundColor: Platform.OS === 'android' ? colors.background : 'transparent',
      opacity: Platform.OS === 'android' ? 0.92 : 1,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    headerContent: {
      flex: 1,
      justifyContent: 'center',
      width: '100%',
      maxWidth: 640,
      alignSelf: 'center',
    },
  });
