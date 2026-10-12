import { router } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { LogWorkoutAccessory, LogWorkoutFloatingButton } from '@/components/LogWorkoutButton';
import { useLiveUpdates } from '@/lib/feed';
import { markOpeningPathUsed, openingPath } from '@/lib/openingLink';
import { useTeams } from '@/lib/teams';

// Links that should open their own tab instead of Home.
const TAB_PATHS = ['team', 'calendar', 'feed', 'profile'];
// The bar above the tab bar only exists on iOS 26 and later.
const hasBottomAccessory = Platform.OS === 'ios' && parseInt(String(Platform.Version), 10) >= 26;

// The system tab bar: Liquid Glass on iOS 26, Material on Android.
// Tabs appear in the order of the triggers.
export default function AppLayout() {
  const { currentTeam } = useTeams();
  // Reload the feed and totals when a teammate logs, comments or reacts.
  useLiveUpdates(currentTeam?.id);

  // Native tabs always start on their first tab (Team) and ignore the usual
  // "anchor" setting, so open Home ourselves whenever you enter the app.
  // The exception: the app was opened by a link straight to a tab (say, a
  // notification that points at the Feed). Then go where the link pointed,
  // even if you had to sign in first.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const path = await openingPath();
      if (cancelled) return;
      markOpeningPathUsed();
      // (Typed as a plain string because the path is only known at run time.)
      router.replace(TAB_PATHS.includes(path) ? (`/${path}` as '/feed') : '/');
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <View style={styles.fill}>
      <Tabs />
      {hasBottomAccessory ? null : <LogWorkoutFloatingButton />}
    </View>
  );
}

function Tabs() {
  return (
    <NativeTabs>
      {hasBottomAccessory ? (
        <NativeTabs.BottomAccessory>
          <LogWorkoutAccessory />
        </NativeTabs.BottomAccessory>
      ) : null}

      <NativeTabs.Trigger name="team">
        <NativeTabs.Trigger.Label>Team</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'person.3', selected: 'person.3.fill' }}
          md="groups"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="calendar">
        <NativeTabs.Trigger.Label>Calendar</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="calendar" md="calendar_month" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="feed">
        <NativeTabs.Trigger.Label>Feed</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="list.bullet.rectangle" md="dynamic_feed" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }}
          md="account_circle"
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
