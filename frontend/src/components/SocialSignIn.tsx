import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppleLogo } from '@/components/icons/AppleLogo';
import { GoogleLogo } from '@/components/icons/GoogleLogo';
import { colors, fontSize, fontWeight, radius, spacing } from '@/constants/theme';

type SocialSignInProps = {
  // Shows a message on the screen (e.g. an error from the provider).
  onMessage: (message: string) => void;
};

// "Continue with Apple / Google". Used on both sign-in and sign-up: for these
// providers there's no difference, the account is created on first use.
export function SocialSignIn({ onMessage }: SocialSignInProps) {
  // TODO: connect once the Google and Apple providers are set up in Supabase.
  function notReady(provider: string) {
    onMessage(`Sign in with ${provider} is coming soon.`);
  }

  return (
    <View style={styles.list}>
      <SocialButton
        icon={<AppleLogo size={20} color={colors.text} />}
        title="Continue with Apple"
        onPress={() => notReady('Apple')}
      />
      <SocialButton
        icon={<GoogleLogo size={20} />}
        title="Continue with Google"
        onPress={() => notReady('Google')}
      />
    </View>
  );
}

function SocialButton({
  icon,
  title,
  onPress,
}: {
  icon: ReactNode;
  title: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      {/* Fixed-width icon slot so both labels line up exactly. */}
      <View style={styles.icon}>{icon}</View>
      <Text style={styles.title}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.sm,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    minHeight: 52,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pressed: {
    opacity: 0.85,
  },
  icon: {
    width: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
});
