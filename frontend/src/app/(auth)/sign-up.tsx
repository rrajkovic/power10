import { router } from 'expo-router';
import { useState } from 'react';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { ErrorText, Muted, Title } from '@/components/Typography';
import { supabase } from '@/lib/supabase';

export default function SignUp() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSignUp() {
    const cleanEmail = email.trim().toLowerCase();

    // Quick checks for friendly messages. Supabase enforces the real rules.
    if (!name.trim()) return setError('Enter your full name.');
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) return setError('Enter a valid email address.');
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    if (password !== confirm) return setError("Passwords don't match.");

    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: { data: { name: name.trim() } },
    });
    setLoading(false);

    if (error) return setError(error.message);
    router.push({ pathname: '/verify', params: { email: cleanEmail } });
  }

  return (
    <Screen centered>
      <Title>Create your account</Title>
      <Muted>We’ll email you a code to confirm it’s you.</Muted>

      <TextField
        label="Full name"
        value={name}
        onChangeText={setName}
        autoComplete="name"
        textContentType="name"
      />
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
        placeholder="At least 8 characters"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <TextField
        label="Confirm password"
        value={confirm}
        onChangeText={setConfirm}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
      />

      {error ? <ErrorText>{error}</ErrorText> : null}

      <Button title="Sign up" onPress={handleSignUp} loading={loading} />
    </Screen>
  );
}
