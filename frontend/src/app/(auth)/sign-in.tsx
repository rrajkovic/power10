import { router } from 'expo-router';
import { useState } from 'react';
import { Button, TextButton } from '@/components/Button';
import { Divider } from '@/components/Divider';
import { Screen } from '@/components/Screen';
import { SocialSignIn } from '@/components/SocialSignIn';
import { SwitchAuthLink } from '@/components/SwitchAuthLink';
import { TextField } from '@/components/TextField';
import { ErrorText, Muted, Title } from '@/components/Typography';
import { supabase } from '@/lib/supabase';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) return setError('Enter your email and password.');

    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });

    // Signed up but never entered the code: send a fresh one and finish that first.
    if (error?.code === 'email_not_confirmed') {
      await supabase.auth.resend({ type: 'signup', email: cleanEmail });
      setLoading(false);
      router.push({ pathname: '/verify', params: { email: cleanEmail } });
      return;
    }

    setLoading(false);
    if (error) {
      // Same message whether the email exists or not, so the form can't be
      // used to find out who has an account.
      setError(
        error.code === 'invalid_credentials' ? 'Wrong email or password.' : error.message,
      );
    }
    // On success the gate in _layout.tsx opens the app.
  }

  return (
    <Screen centered>
      <Title>Welcome back</Title>
      <Muted>Sign in to log your training.</Muted>

      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        textContentType="emailAddress"
      />
      <TextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        onSubmitEditing={handleSignIn}
      />
      <TextButton
        title="Forgot password?"
        onPress={() =>
          router.push({ pathname: '/forgot-password', params: { email: email.trim().toLowerCase() } })
        }
      />

      {error ? <ErrorText>{error}</ErrorText> : null}

      <Button title="Sign in" onPress={handleSignIn} loading={loading} />

      <Divider label="or" />
      <SocialSignIn onMessage={setError} />

      <SwitchAuthLink
        question="New here?"
        action="Create an account"
        onPress={() => router.replace('/sign-up')}
      />
    </Screen>
  );
}
