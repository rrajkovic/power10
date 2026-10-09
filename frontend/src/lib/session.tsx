import type { Session } from '@supabase/supabase-js';
import { createContext, use, useEffect, useState, type PropsWithChildren } from 'react';
import { isResettingPassword, rememberResettingPassword, rememberSignedIn } from './deviceMemory';
import { supabase } from './supabase';

type SessionState = {
  session: Session | null;
  isLoading: boolean;
  // Signed in, but must set a password before using the app: a Google/Apple
  // sign-up without one, or someone who used "forgot password".
  needsPassword: boolean;
  // True when needsPassword comes from "forgot password".
  resettingPassword: boolean;
  // Call after the password has been saved.
  passwordSet: () => void;
};

const SessionContext = createContext<SessionState | null>(null);

type PasswordCheck = { userId: string; hasPassword: boolean };

// Asks the database (has_password()) whether this account has a password.
async function checkPassword(userId: string): Promise<PasswordCheck> {
  const { data, error } = await supabase.rpc('has_password');
  // If the check itself fails, don't lock the user out of the app.
  return { userId, hasPassword: error ? true : data === true };
}

export function SessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [passwordCheck, setPasswordCheck] = useState<PasswordCheck | null>(null);
  const [resettingPassword, setResettingPassword] = useState(isResettingPassword);
  const userId = session?.user.id;

  useEffect(() => {
    // 1. On startup: is there a saved login on this device? If so, also check
    //    its password before showing anything.
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session) {
        rememberSignedIn();
        setPasswordCheck(await checkPassword(data.session.user.id));
      }
      setIsLoading(false);
    });

    // 2. From then on: react to every sign-in and sign-out.
    const { data } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      if (newSession) rememberSignedIn();
      if (event === 'PASSWORD_RECOVERY') {
        setResettingPassword(true);
        rememberResettingPassword(true);
      }
      if (event === 'SIGNED_OUT') {
        setResettingPassword(false);
        rememberResettingPassword(false);
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  // Whenever a different account signs in, check its password again.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    checkPassword(userId).then((check) => {
      if (!cancelled) setPasswordCheck(check);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const hasPassword =
    passwordCheck && passwordCheck.userId === userId ? passwordCheck.hasPassword : null;
  const needsPassword = !!session && (resettingPassword || hasPassword === false);

  function passwordSet() {
    setResettingPassword(false);
    rememberResettingPassword(false);
    if (userId) setPasswordCheck({ userId, hasPassword: true });
  }

  return (
    <SessionContext
      value={{ session, isLoading, needsPassword, resettingPassword, passwordSet }}
    >
      {children}
    </SessionContext>
  );
}

export function useSession() {
  const value = use(SessionContext);
  if (!value) {
    throw new Error('useSession must be used inside <SessionProvider>');
  }
  return value;
}
