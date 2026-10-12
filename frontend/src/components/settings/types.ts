import type { useTeamSetup } from '@/lib/settings';

// Runs one settings write (see useSettingsChange in lib/settings.ts).
export type Save = (run: () => PromiseLike<{ error: { code?: string; message: string } | null }>) => void;

// What the settings screen loaded.
export type Setup = NonNullable<ReturnType<typeof useTeamSetup>['data']>;
