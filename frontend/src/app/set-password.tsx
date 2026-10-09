import { useState } from 'react';
import { Button, TextButton } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { ErrorText, Muted, Title } from '@/components/Typography';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

// Shown to signed-in users who must set a password first:
// - after a Google/Apple sign-up (every account needs a password)
// - after signing in with a "forgot password" code
export default function SetPassword() {
  const { resettingPassword, passwordSet } = useSession();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    if (password !== confirm) return setError("Passwords don't match.");

    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      return setError(
        error.code === 'same_password'
          ? 'Choose a password different from your old one.'
          : error.message,
      );
    }
    // The gate in _layout.tsx now opens the app.
    passwordSet();
  }

  return (
    <Screen centered>
      <Title>{resettingPassword ? 'Set a new password' : 'Create your password'}</Title>
      <Muted>
        {resettingPassword
          ? 'Choose a new password for your account.'
          : 'Every account has a password, so you can always sign in with your email too.'}
      </Muted>

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
        onSubmitEditing={handleSave}
      />

      {error ? <ErrorText>{error}</ErrorText> : null}

      <Button title="Save password" onPress={handleSave} loading={loading} />
      <TextButton title="Sign out" onPress={() => supabase.auth.signOut()} />
    </Screen>
  );
}
