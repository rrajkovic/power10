// Checks a saved session against its photos.
//
// Adding a photo to a session puts a row in `verification_checks` (status
// 'queued'). The app then calls this function with the session's id. It reads
// the photos with Gemini, compares them with what the athlete logged, and
// records 'passed' or 'flagged'. It's also flagged when the AI isn't
// confident it read the screen correctly, even if the numbers seem to match.
// Flagged sessions keep counting until an admin rejects them.
//
// The caller only chooses WHICH session to check, never the result.

import { askGemini, MIN_CONFIDENCE, READING_RULES, type Photo } from '../_shared/gemini.ts';
import { adminClient, callerClient, corsHeaders, json } from '../_shared/http.ts';

const MAX_PHOTOS = 6;

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const caller = await callerClient(req);
  if (!caller) return json({ error: 'Sign in first.' }, 401);

  const { session_id } = await req.json().catch(() => ({}));
  if (typeof session_id !== 'string') return json({ error: 'Which session?' }, 400);

  // Through row-level security: the caller must be able to see the session.
  const visible = await caller.client.from('sessions').select('id').eq('id', session_id).maybeSingle();
  if (!visible.data) return json({ error: 'Session not found.' }, 404);

  const admin = adminClient();

  // Take the oldest waiting check. Setting it to 'running' in the same
  // statement means two calls at once can't both take it.
  const waiting = await admin
    .from('verification_checks')
    .select('id')
    .eq('session_id', session_id)
    .eq('status', 'queued')
    .order('created_at')
    .limit(1)
    .maybeSingle();
  if (!waiting.data) return json({ status: 'nothing_to_check' });

  const claimed = await admin
    .from('verification_checks')
    .update({ status: 'running', started_at: new Date().toISOString() })
    .eq('id', waiting.data.id)
    .eq('status', 'queued')
    .select('id, attempts')
    .maybeSingle();
  if (!claimed.data) return json({ status: 'nothing_to_check' });
  const checkId: string = claimed.data.id;

  // If anything goes wrong the session stays 'pending' and the check is
  // marked failed, so an admin can still look at it by hand.
  const fail = async (note: string, status = 500) => {
    await admin
      .from('verification_checks')
      .update({
        status: 'failed',
        note,
        attempts: (claimed.data!.attempts ?? 0) + 1,
        finished_at: new Date().toISOString(),
      })
      .eq('id', checkId);
    return json({ status: 'failed', error: note }, status);
  };

  const [session, photoRows] = await Promise.all([
    admin
      .from('sessions')
      .select(
        'session_date, duration_seconds, distance_meters, custom_label, activity_types(name), intensities(name)',
      )
      .eq('id', session_id)
      .single(),
    admin
      .from('session_photos')
      .select('storage_path')
      .eq('session_id', session_id)
      .order('created_at')
      .limit(MAX_PHOTOS),
  ]);
  if (session.error || !photoRows.data?.length) return fail('The photos could not be found.');

  const photos: Photo[] = [];
  for (const row of photoRows.data) {
    const file = await admin.storage.from('session-photos').download(row.storage_path);
    if (file.error) continue;
    photos.push({
      mimeType: file.data.type || 'image/jpeg',
      base64: toBase64(new Uint8Array(await file.data.arrayBuffer())),
    });
  }
  if (photos.length === 0) return fail('The photos could not be opened.');

  const s = session.data as unknown as {
    session_date: string;
    duration_seconds: number;
    distance_meters: number | null;
    custom_label: string | null;
    activity_types: { name: string } | null;
    intensities: { name: string } | null;
  };
  const minutes = Math.floor(s.duration_seconds / 60);
  const extraSeconds = s.duration_seconds % 60;

  const result = await askGemini({
    instructions: `You check proof photos for a sports team's training log.
${READING_RULES}
All the photos are pieces of this ONE session: add their work time and meters together, then compare the total with what the athlete logged.
PASS when a workout screen is readable and its work time is within about 10% of the logged time (or the time isn't shown but the screen clearly shows a matching workout), and any logged distance is within about 10% of the screen's.
FLAG when the numbers don't match, when the logged time looks like it includes rest, when the photos don't show a workout, or when you can't read them. A flag is only a note for a coach to look, so explain it in one plain sentence that names the numbers (for example "Logged 71 min, but the screen shows 59 min of work.").
A screen dated before the logged date is fine (a workout logged late). Flag a screen dated AFTER the logged date. Never flag because no date is visible.`,
    prompt: `The athlete logged: ${s.activity_types?.name ?? 'a workout'}${s.custom_label ? ` (${s.custom_label})` : ''}${s.intensities ? `, ${s.intensities.name}` : ''}, on ${s.session_date}, ${minutes} min${extraSeconds ? ` ${extraSeconds} s` : ''}${s.distance_meters ? `, ${s.distance_meters} m` : ', no distance'}.
Check ${photos.length === 1 ? 'the photo' : `the ${photos.length} photos`}.`,
    photos,
    schema: {
      type: 'OBJECT',
      properties: {
        matches: { type: 'BOOLEAN' },
        note: { type: 'STRING' },
        seconds: { type: 'INTEGER', nullable: true },
        distance_meters: { type: 'INTEGER', nullable: true },
        date: { type: 'STRING', nullable: true },
        confidence: { type: 'INTEGER' },
      },
      required: ['matches', 'note', 'confidence'],
    },
  });

  if (!result.ok) {
    // The AI couldn't be reached. Put the check back in the queue so it can
    // be tried again, and give up after three tries.
    const attempts = (claimed.data.attempts ?? 0) + 1;
    if (attempts >= 3) return fail(result.message, 503);
    await admin
      .from('verification_checks')
      .update({ status: 'queued', attempts, note: result.message, started_at: null })
      .eq('id', checkId);
    return json({ status: 'queued', error: result.message }, 503);
  }

  // A missing or odd confidence counts as the lowest.
  const rawConfidence = Number(result.json.confidence);
  const confidence =
    Number.isInteger(rawConfidence) && rawConfidence >= 1 && rawConfidence <= 10 ? rawConfidence : 1;
  const matches = result.json.matches === true;
  const unsure = confidence < MIN_CONFIDENCE;

  const verdict = matches && !unsure ? 'passed' : 'flagged';
  const aiNote = typeof result.json.note === 'string' ? result.json.note.slice(0, 300) : '';
  // Numbers matched but the photo was hard to read: say that, so the coach
  // knows why it needs a look.
  const note =
    matches && unsure
      ? `The photo was hard to read (confidence ${confidence}/10). ${aiNote}`.trim()
      : aiNote || null;
  const applied = await admin.rpc('apply_verification', {
    check_id: checkId,
    check_verdict: verdict,
    check_note: note,
    check_result: { ...result.json, confidence },
    check_engine: result.model,
  });
  if (applied.error) return fail('The result could not be saved.');

  return json({ status: 'done', verdict, note, confidence });
});
