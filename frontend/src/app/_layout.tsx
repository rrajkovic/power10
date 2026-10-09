import { router, SplashScreen, Stack } from 'expo-router';
import { useEffect, useRef } from 'react';
import { hasSignedInBefore } from '@/lib/deviceMemory';
import { SessionProvider, useSession } from '@/lib/session';

// Keep the splash screen up until we know whether someone is signed in.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <SessionProvider>
      <RootNavigator />
    </SessionProvider>
  );
}

function RootNavigator() {
  const { session, isLoading, needsPassword } = useSession();
  const landed = useRef(false);

  useEffect(() => {
    if (isLoading) return;
    // Signed-out users land on sign-in, except on a device where nobody has
    // ever signed in: that's probably a new user, so show sign-up instead.
    if (!landed.current) {
      landed.current = true;
      if (!session && !hasSignedInBefore()) router.replace('/sign-up');
    }
    SplashScreen.hide();
  }, [isLoading, session]);

  if (isLoading) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!session && !needsPassword}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      {/* Signed in without a password yet: this screen is all they can see. */}
      <Stack.Protected guard={!!session && needsPassword}>
        <Stack.Screen name="set-password" />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}
