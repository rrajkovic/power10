// Checks a saved session against its photos.
//
// Adding a photo to a session puts a row in `verification_checks` (status
// 'queued'). The app then calls this function with the session's id. It reads
// the photos with Gemini, compares them with what the athlete logged, and
// records 'passed' or 'flagged'. It's also flagged when the AI isn't
// confident it read the screen correctly, even if the numbers seem to match.
// Flagged sessions keep counting until an admin rejects them.
//
// It also looks for reused photos, in two ways:
//   1. The exact same file is on another workout of the team (compared by
//      fingerprint, a hash of the file).
//   2. Another workout's photos read as exactly the same time and distance.
//      That can be a coincidence, so the AI is then asked to compare the two
//      sets of photos, and it's only flagged if they show the same picture.
//
// The caller only chooses WHICH session to check, never the result.

import { askGemini, MIN_CONFIDENCE, READING_RULES, type Photo } from '../_shared/gemini.ts';
import { adminClient, callerClient, corsHeaders, json } from '../_shared/http.ts';

const MAX_PHOTOS = 6;

// A fingerprint of a file: the same bytes always give the same text.
async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

type AdminClient = ReturnType<typeof adminClient>;

async function loadPhotos(admin: AdminClient, sessionId: string) {
  const rows = await admin
    .from('session_photos')
    .select('id, storage_path')
    .eq('session_id', sessionId)
    .order('created_at')
    .limit(MAX_PHOTOS);
  const loaded: { id: string; photo: Photo; hash: string }[] = [];
  for (const row of rows.data ?? []) {
    const file = await admin.storage.from('session-photos').download(row.storage_path);
    if (file.error) continue;
    const bytes = new Uint8Array(await file.data.arrayBuffer());
    loaded.push({
      id: row.id,
      photo: { mimeType: file.data.type || 'image/jpeg', base64: toBase64(bytes) },
      hash: await sha256(bytes),
    });
  }
  return loaded;
}

// "Sam Okafor's workout on 2026-10-09", for the note a coach reads.
async function describeSession(admin: AdminClient, sessionId: string, sameAthleteId: string) {
  const other = await admin
    .from('sessions')
    .select('athlete_id, session_date, profiles!sessions_athlete_id_fkey(name)')
    .eq('id', sessionId)
    .maybeSingle();
  if (!other.data) return 'another workout';
  const row = other.data as unknown as {
    athlete_id: string;
    session_date: string;
    profiles: { name: string } | null;
  };
  const whose = row.athlete_id === sameAthleteId ? 'their own' : `${row.profiles?.name || 'a teammate'}’s`;
  return `${whose} workout on ${row.session_date}`;
}

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

  const session = await admin
    .from('sessions')
    .select(
      'team_id, athlete_id, session_date, duration_seconds, distance_meters, custom_label, activity_types(name), intensities(name)',
    )
    .eq('id', session_id)
    .single();
  if (session.error) return fail('The session could not be found.');

  const loaded = await loadPhotos(admin, session_id);
  if (loaded.length === 0) return fail('The photos could not be opened.');
  const photos = loaded.map((item) => item.photo);

  // Remember each photo's fingerprint, so later checks can spot the same file.
  for (const item of loaded) {
    await admin.from('session_photos').update({ image_hash: item.hash }).eq('id', item.id);
  }

  const s = session.data as unknown as {
    team_id: string;
    athlete_id: string;
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

  const aiNote = typeof result.json.note === 'string' ? result.json.note.slice(0, 300) : '';

  // --- Reused photo? ---------------------------------------------------------
  let reused: string | null = null;

  // 1. The exact same file on another workout of this team.
  const sameFile = await admin
    .from('session_photos')
    .select('session_id')
    .eq('team_id', s.team_id)
    .in('image_hash', loaded.map((item) => item.hash))
    .neq('session_id', session_id)
    .limit(1)
    .maybeSingle();
  if (sameFile.data) {
    reused = `Possibly a reused photo: the same photo file is on ${await describeSession(admin, sameFile.data.session_id, s.athlete_id)}.`;
  }

  // 2. Another workout whose photos read as the same time AND distance. Only
  //    then are the pictures themselves compared (an extra AI call).
  const readSeconds = Number(result.json.seconds);
  const readMeters = Number(result.json.distance_meters);
  if (!reused && Number.isInteger(readSeconds) && readSeconds > 0 && Number.isInteger(readMeters) && readMeters > 0) {
    const sameNumbers = await admin
      .from('verification_checks')
      .select('session_id')
      .eq('team_id', s.team_id)
      .eq('status', 'done')
      .neq('session_id', session_id)
      .eq('result->>seconds', String(readSeconds))
      .eq('result->>distance_meters', String(readMeters))
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (sameNumbers.data) {
      const others = await loadPhotos(admin, sameNumbers.data.session_id);
      if (others.length) {
        const compare = await askGemini({
          instructions: `You compare two sets of workout photos to catch a photo being reused for a second workout.
Set A has ${photos.length} photo(s), then set B has ${others.length}. Answer whether any photo in A shows the SAME photograph or the same screen at the same moment as a photo in B: the same monitor with the same numbers and the same surroundings, glare, angle or crop.
Two different workouts can have identical numbers (the same piece done twice, or two athletes side by side). Different surroundings, a different date on the screen, or a clearly different device means NOT the same. Only say "same" when you are confident.`,
          prompt: `Set A is the first ${photos.length} photo(s); set B is the rest.`,
          photos: [...photos, ...others.map((item) => item.photo)],
          schema: {
            type: 'OBJECT',
            properties: { same: { type: 'BOOLEAN' }, note: { type: 'STRING' } },
            required: ['same'],
          },
        });
        if (compare.ok && compare.json.same === true) {
          reused = `Possibly a reused photo: it looks the same as the photo on ${await describeSession(admin, sameNumbers.data.session_id, s.athlete_id)}.`;
        }
      }
    }
  }

  const verdict = matches && !unsure && !reused ? 'passed' : 'flagged';
  // Say why it needs a look. A reused photo comes first; then a photo that
  // was hard to read even though the numbers matched.
  const note = reused
    ? `${reused}${matches ? '' : ` ${aiNote}`}`.trim()
    : matches && unsure
      ? `The photo was hard to read (confidence ${confidence}/10). ${aiNote}`.trim()
      : aiNote || null;
  const applied = await admin.rpc('apply_verification', {
    check_id: checkId,
    check_verdict: verdict,
    check_note: note,
    check_result: { ...result.json, confidence, reused: reused !== null },
    check_engine: result.model,
  });
  if (applied.error) return fail('The result could not be saved.');

  return json({ status: 'done', verdict, note, confidence });
});
