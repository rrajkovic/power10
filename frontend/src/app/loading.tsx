import { ActivityIndicator } from 'react-native';
import { Screen } from '@/components/Screen';

// Shown for a moment after signing in, while we load your teams.
export default function Loading() {
  return (
    <Screen centered>
      <ActivityIndicator size="large" />
    </Screen>
  );
}
