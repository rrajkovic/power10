import { Stack } from 'expo-router';

// Signed-out users land on sign-up first.
export const unstable_settings = {
  anchor: 'sign-up',
};

export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
