import { Stack } from 'expo-router';

// Signed-out users land on sign-in. (New devices are sent on to sign-up by
// the root layout.)
export const unstable_settings = {
  anchor: 'sign-in',
};

export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
