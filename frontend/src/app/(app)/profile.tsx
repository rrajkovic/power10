import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { Muted, Title } from '@/components/Typography';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

// Placeholder: account details, emails, theme and notifications come later.
export default function Profile() {
  const { session } = useSession();
  const name = session?.user.user_metadata?.name;

  return (
    <Screen centered>
      <Title>{name || 'Profile'}</Title>
      <Muted>{session?.user.email}</Muted>
      <Muted>Account, emails, theme and notifications.</Muted>
      <Button title="Sign out" variant="secondary" onPress={() => supabase.auth.signOut()} />
    </Screen>
  );
}
