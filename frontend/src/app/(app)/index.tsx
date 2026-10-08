import { Button, Text, View } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/session';

export default function Home() {
  const { session } = useSession();

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <Text>Signed in as {session?.user.email}</Text>
      <Button title="Sign out" onPress={() => supabase.auth.signOut()} />
    </View>
  );
}