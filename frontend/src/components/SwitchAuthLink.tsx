import { StyleSheet, View } from 'react-native';
import { TextButton } from '@/components/Button';
import { Muted } from '@/components/Typography';
import { spacing } from '@/constants/theme';

type SwitchAuthLinkProps = {
  question: string;
  action: string;
  onPress: () => void;
};

// "New here? Create an account" / "Already have an account? Sign in".
export function SwitchAuthLink({ question, action, onPress }: SwitchAuthLinkProps) {
  return (
    <View style={styles.row}>
      <Muted>{question}</Muted>
      <TextButton title={action} onPress={onPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    flexWrap: 'wrap',
  },
});
