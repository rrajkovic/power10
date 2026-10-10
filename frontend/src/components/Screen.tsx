import type { PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { spacing, type Palette } from '@/constants/theme';
import { useThemedStyles } from '@/lib/theme';

type ScreenProps = PropsWithChildren<{
  // Center the content vertically (sign-in, sign-up, empty states).
  centered?: boolean;
}>;

export function Screen({ children, centered = false }: ScreenProps) {
  const styles = useThemedStyles(makeStyles);
  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.content, centered && styles.centered]}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    flex: {
      flex: 1,
    },
    content: {
      flexGrow: 1,
      padding: spacing.xl,
      gap: spacing.md,
      width: '100%',
      maxWidth: 440,
      alignSelf: 'center',
    },
    centered: {
      justifyContent: 'center',
    },
  });
