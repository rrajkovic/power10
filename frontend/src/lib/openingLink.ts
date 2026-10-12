import * as Linking from 'expo-linking';

// The link the app was opened with, if any (for example a notification that
// points at the Feed). Read once, as early as possible: while the app is
// working out whether you're signed in it moves through other screens, and
// on the web that changes the address.
const opening: Promise<string | null> = Linking.getInitialURL().catch(() => null);

let used = false;

// The path of the opening link ('feed', 'team', …), or '' if there wasn't
// one or it has already been followed.
export async function openingPath(): Promise<string> {
  const url = await opening;
  if (used || !url) return '';
  return (Linking.parse(url).path ?? '').replace(/^\/+|\/+$/g, '');
}

// Call once the link has been followed. It only counts the first time: after
// signing out and back in, the app starts on Home again.
export function markOpeningPathUsed() {
  used = true;
}
