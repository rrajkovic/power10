import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { supabase } from '@/lib/supabase';

export default function Index() {
  const [status, setStatus] = useState('Checking connection…');

  useEffect(() => {
    supabase
      .from('teams')
      .select('id')
      .then(({ error }) => {
        setStatus(error ? `Error: ${error.message}` : 'Connected to Supabase ✅');
      });
  }, []);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>{status}</Text>
    </View>
  );
}