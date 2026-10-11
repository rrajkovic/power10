import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router, SplashScreen, Stack } from 'expo-router';
import { useEffect, useRef } from 'react';
import { hasSignedInBefore } from '@/lib/deviceMemory';
import { SessionProvider, useSession } from '@/lib/session';
import { TeamsProvider, useTeams } from '@/lib/teams';

// Keep the splash screen up until we know where to send the user.
SplashScreen.preventAutoHideAsync();

// Fetches and caches data from Supabase for every screen.
const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000 } },
});

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <TeamsProvider>
          <RootNavigator />
        </TeamsProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}

// Where the user is in getting into the app. Each stage unlocks one area.
type Stage = 'signed-out' | 'needs-password' | 'loading' | 'no-team' | 'ready';

function RootNavigator() {
  const { session, isLoading, needsPassword, isCheckingPassword } = useSession();
  const { teams, isLoading: teamsLoading } = useTeams();
  const landed = useRef(false);
  const splashHidden = useRef(false);

  const stage: Stage = !session
    ? 'signed-out'
    : needsPassword
      ? 'needs-password'
      : isCheckingPassword || teamsLoading
        ? 'loading'
        : teams.length === 0
          ? 'no-team'
          : 'ready';

  useEffect(() => {
    if (isLoading) return;
    // Signed-out users land on sign-in, except on a device where nobody has
    // ever signed in: that's probably a new user, so show sign-up instead.
    if (!landed.current) {
      landed.current = true;
      if (!session && !hasSignedInBefore()) router.replace('/sign-up');
    }
    // On app launch, keep the splash screen until the first real screen is known.
    if (!splashHidden.current && stage !== 'loading') {
      splashHidden.current = true;
      SplashScreen.hide();
    }
  }, [isLoading, session, stage]);

  if (isLoading) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={stage === 'ready'}>
        <Stack.Screen name="(app)" />
        {/* Slides up over the tabs. */}
        <Stack.Screen name="log" options={{ presentation: 'modal' }} />
        <Stack.Screen name="review" options={{ presentation: 'modal' }} />
      </Stack.Protected>
      <Stack.Protected guard={stage === 'no-team'}>
        <Stack.Screen name="(onboarding)" />
      </Stack.Protected>
      <Stack.Protected guard={stage === 'loading'}>
        <Stack.Screen name="loading" />
      </Stack.Protected>
      {/* Signed in without a password yet: this screen is all they can see. */}
      <Stack.Protected guard={stage === 'needs-password'}>
        <Stack.Screen name="set-password" />
      </Stack.Protected>
      <Stack.Protected guard={stage === 'signed-out'}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}
