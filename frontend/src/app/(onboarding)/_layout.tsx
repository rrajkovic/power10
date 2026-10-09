import { Stack } from 'expo-router';

// Signed in, but not on a team yet.
export const unstable_settings = {
  anchor: 'welcome',
};

export default function OnboardingLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
