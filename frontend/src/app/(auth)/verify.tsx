import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

export default function Verify() {
  const { email } = useLocalSearchParams<{ email: string }>();

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Code screen for {email} (coming next)</Text>
    </View>
  );
}
