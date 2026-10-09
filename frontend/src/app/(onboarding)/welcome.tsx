import { router } from 'expo-router';
import { Button, TextButton } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { Muted, Title } from '@/components/Typography';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

export default function Welcome() {
  const { session } = useSession();
  const firstName = session?.user.user_metadata?.name?.split(' ')[0];

  return (
    <Screen centered>
      <Title>{firstName ? `Welcome, ${firstName}` : 'Welcome'}</Title>
      <Muted>
        Teams track their training together. Ask your coach or captain for a team code, or
        create a new team.
      </Muted>

      <Button title="Join a team" onPress={() => router.push('/join-team')} />
      <Button title="Create a team" variant="secondary" onPress={() => router.push('/create-team')} />

      <TextButton title="Sign out" onPress={() => supabase.auth.signOut()} />
    </Screen>
  );
}
