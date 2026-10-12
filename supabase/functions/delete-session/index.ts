// Deletes a workout together with its photo files.
//
// Deleting the session row removes its photo records, comments and reactions
// automatically, but the image files live in storage and would be left
// behind. So: delete the row AS THE CALLER (the database decides whether
// they're allowed, including the team's time limit), and only if that worked,
// remove the files.

import { adminClient, callerClient, corsHeaders, json } from '../_shared/http.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const caller = await callerClient(req);
  if (!caller) return json({ error: 'Sign in first.' }, 401);

  const { session_id } = await req.json().catch(() => ({}));
  if (typeof session_id !== 'string') return json({ error: 'Which session?' }, 400);

  // The paths have to be read before the session goes, because the photo
  // records go with it. Through the caller's own access.
  const photos = await caller.client
    .from('session_photos')
    .select('storage_path')
    .eq('session_id', session_id);
  const paths = (photos.data ?? []).map((photo) => photo.storage_path);

  // Asking for the row back tells us whether anything was actually deleted:
  // a session you may not delete is silently skipped by row-level security.
  const removed = await caller.client.from('sessions').delete().eq('id', session_id).select('id');
  if (removed.error) return json({ error: removed.error.message }, 403);
  if (!removed.data?.length) {
    return json({ error: 'You can’t delete this workout, or it’s already gone.' }, 404);
  }

  if (paths.length) {
    const cleanup = await adminClient().storage.from('session-photos').remove(paths);
    // The workout is gone either way; a leftover file is only wasted space.
    if (cleanup.error) console.error('[delete-session] could not remove photos', cleanup.error);
  }

  return json({ status: 'deleted', photos_removed: paths.length });
});
