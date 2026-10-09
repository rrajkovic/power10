import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Button, TextButton } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { ErrorText, Muted, Title } from '@/components/Typography';
import { supabase } from '@/lib/supabase';

export default function ForgotPassword() {
  // Pre-filled when coming from the sign-in screen.
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSend() {
    const cleanEmail = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) return setError('Enter a valid email address.');

    setError(null);
    setLoading(true);
    // Succeeds even if no account uses this email, so the form can't be used
    // to find out who has an account.
    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail);
    setLoading(false);

    if (error) return setError(error.message);
    router.push({ pathname: '/verify', params: { email: cleanEmail, purpose: 'reset' } });
  }

  return (
    <Screen centered>
      <Title>Forgot your password?</Title>
      <Muted>Enter your email and we’ll send you a code to set a new one.</Muted>

      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        textContentType="emailAddress"
        onSubmitEditing={handleSend}
      />

      {error ? <ErrorText>{error}</ErrorText> : null}

      <Button title="Send code" onPress={handleSend} loading={loading} />
      <TextButton title="Back to sign in" onPress={() => router.replace('/sign-in')} />
    </Screen>
  );
}
