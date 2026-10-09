import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Button, TextButton } from '@/components/Button';
import { CodeInput } from '@/components/CodeInput';
import { Screen } from '@/components/Screen';
import { Body, ErrorText, Muted, Title } from '@/components/Typography';
import { spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

const RESEND_SECONDS = 60;

export default function Verify() {
  // purpose: 'signup' confirms a new account, 'reset' is "forgot password".
  const { email, purpose } = useLocalSearchParams<{ email?: string; purpose?: 'signup' | 'reset' }>();
  const isReset = purpose === 'reset';
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);

  // Count down to when "Resend" becomes available.
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace(isReset ? '/forgot-password' : '/sign-up');
  }

  // Opened /verify directly, without coming from sign-up.
  if (!email) {
    return (
      <Screen centered>
        <Title>Something went wrong</Title>
        <Muted>We don’t know which email to confirm.</Muted>
        <Button title="Back to sign up" onPress={() => router.replace('/sign-up')} />
      </Screen>
    );
  }

  async function handleComplete(token: string) {
    setVerifying(true);
    setError(null);
    setNotice(null);
    const { error } = await supabase.auth.verifyOtp({
      email: email!,
      token,
      type: isReset ? 'recovery' : 'email',
    });
    setVerifying(false);

    if (error) {
      setError('That code is wrong or has expired.');
      setShakeKey((key) => key + 1);
      setCode('');
    }
    // On success Supabase signs you in, and the gate in _layout.tsx opens the
    // app (or, after a reset, the "set a new password" screen).
  }

  async function handleResend() {
    setError(null);
    const { error } = isReset
      ? await supabase.auth.resetPasswordForEmail(email!)
      : await supabase.auth.resend({ type: 'signup', email: email! });
    if (error) return setError(error.message);
    setNotice('We sent you a new code.');
    setSecondsLeft(RESEND_SECONDS);
  }

  return (
    <Screen centered>
      <Title>{isReset ? 'Reset your password' : 'Check your email'}</Title>
      <Muted>We sent a 6-digit code to</Muted>
      <Body style={{ marginBottom: spacing.md }}>{email}</Body>

      <CodeInput
        value={code}
        onChange={(value) => {
          setCode(value);
          if (error) setError(null);
        }}
        onComplete={handleComplete}
        error={!!error}
        shakeKey={shakeKey}
        disabled={verifying}
      />

      <View style={{ minHeight: 24, justifyContent: 'center' }}>
        {verifying ? <ActivityIndicator /> : null}
        {error ? <ErrorText>{error}</ErrorText> : null}
        {notice ? <Muted>{notice}</Muted> : null}
      </View>

      {secondsLeft > 0 ? (
        <Muted>Didn’t get it? You can resend in {secondsLeft}s.</Muted>
      ) : (
        <TextButton title="Resend code" onPress={handleResend} />
      )}
      <TextButton title="Wrong email? Go back" onPress={goBack} />
    </Screen>
  );
}
