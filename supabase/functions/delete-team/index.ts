// Deletes a team and everything in it, including its photo files.
//
// The database decides whether the caller may do this (coaches; or athlete
// admins while the team has no coach). Deleting the team row removes all of
// its data, but the image files live in storage and would be left behind, so
// their paths are collected first and removed afterwards.

import { adminClient, callerClient, corsHeaders, json } from '../_shared/http.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const caller = await callerClient(req);
  if (!caller) return json({ error: 'Sign in first.' }, 401);

  const { team_id } = await req.json().catch(() => ({}));
  if (typeof team_id !== 'string') return json({ error: 'Which team?' }, 400);

  // Collected with full access (a coach can't necessarily read every photo
  // record directly), but nothing is removed unless the delete below succeeds.
  const admin = adminClient();
  const paths: string[] = [];
  for (let from = 0; ; from += 1000) {
    const page = await admin
      .from('session_photos')
      .select('storage_path')
      .eq('team_id', team_id)
      .range(from, from + 999);
    if (page.error || !page.data.length) break;
    paths.push(...page.data.map((photo) => photo.storage_path));
    if (page.data.length < 1000) break;
  }

  // As the caller: this is where permission is checked.
  const deleted = await caller.client.rpc('delete_team', { team: team_id });
  if (deleted.error) return json({ error: deleted.error.message }, 403);

  // Storage removes files in batches.
  for (let i = 0; i < paths.length; i += 100) {
    const cleanup = await admin.storage.from('session-photos').remove(paths.slice(i, i + 100));
    // The team is gone either way; a leftover file is only wasted space.
    if (cleanup.error) console.error('[delete-team] could not remove photos', cleanup.error);
  }

  return json({ status: 'deleted', photos_removed: paths.length });
});
