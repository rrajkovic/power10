// Small things this device remembers between launches.
// Uses localStorage: built into browsers, provided by expo-sqlite on phones
// (installed in ./storage.ts, which loads with the Supabase client).

const SIGNED_IN_BEFORE_KEY = 'power10.signedInBefore';

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

// Has anyone ever signed in on this device? Decides whether signed-out
// users land on sign-in (yes) or sign-up (no, probably a new user).
export function hasSignedInBefore(): boolean {
  try {
    return storage()?.getItem(SIGNED_IN_BEFORE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function rememberSignedIn(): void {
  try {
    storage()?.setItem(SIGNED_IN_BEFORE_KEY, 'true');
  } catch {
    // Not being able to remember this only changes which screen opens first.
  }
}

const CURRENT_TEAM_KEY = 'power10.currentTeam';

// The team the app shows, for people on several teams.
export function currentTeamId(): string | null {
  try {
    return storage()?.getItem(CURRENT_TEAM_KEY) ?? null;
  } catch {
    return null;
  }
}

export function rememberCurrentTeam(teamId: string): void {
  try {
    storage()?.setItem(CURRENT_TEAM_KEY, teamId);
  } catch {
    // Best effort: without it the app opens your first team.
  }
}

const RESETTING_PASSWORD_KEY = 'power10.resettingPassword';

// Someone signed in with a "forgot password" code but hasn't set a new
// password yet. Remembered so closing the app doesn't skip that step.
export function isResettingPassword(): boolean {
  try {
    return storage()?.getItem(RESETTING_PASSWORD_KEY) === 'true';
  } catch {
    return false;
  }
}

export function rememberResettingPassword(resetting: boolean): void {
  try {
    if (resetting) storage()?.setItem(RESETTING_PASSWORD_KEY, 'true');
    else storage()?.removeItem(RESETTING_PASSWORD_KEY);
  } catch {
    // Best effort.
  }
}
