// Reads photos of workout screens and returns the workouts to put in the
// logging form.
//
// The AI reads each photo on its own (what kind of workout, time, distance,
// date, and how confident it is). The readings are then merged into workouts
// by groupPieces (_shared/group.ts): photos of the same activity are added
// together into ONE workout, and different activities become separate ones.
//
// Called by the app while the form is open. Nothing is saved here.

import { askGemini, MIN_CONFIDENCE, READING_RULES, type Photo } from '../_shared/gemini.ts';
import { groupPieces, type Piece } from '../_shared/group.ts';
import { adminClient, callerClient, corsHeaders, json } from '../_shared/http.ts';

// The most photos in one read (one log).
const MAX_PHOTOS = 6;
// The most photos one person can have read in 24 hours. Every read costs
// money, and adding a photo re-reads the whole set, so this is generous:
// it's a safety net against abuse, not something normal use should reach.
const DAILY_PHOTO_LIMIT = 60;
// About 3 MB per photo once decoded; the app shrinks them well below this.
const MAX_BASE64_LENGTH = 4_000_000;

type Body = { team_id?: string; photos?: Photo[] };

function wholeNumber(value: unknown, min: number, max: number): number | null {
  const n = Number(value);
  return value !== null && Number.isInteger(n) && n >= min && n <= max ? n : null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const caller = await callerClient(req);
  if (!caller) return json({ error: 'Sign in first.' }, 401);

  const body: Body = await req.json().catch(() => ({}));
  const photos = (body.photos ?? []).filter(
    (photo) =>
      typeof photo?.base64 === 'string' &&
      photo.base64.length <= MAX_BASE64_LENGTH &&
      /^image\/(jpeg|png|webp|heic)$/.test(photo.mimeType ?? ''),
  );
  if (!body.team_id || photos.length === 0 || photos.length > MAX_PHOTOS) {
    return json({ error: `Send 1 to ${MAX_PHOTOS} photos.` }, 400);
  }

  // Row-level security means this only returns rows for a member of the team.
  const [types, intensities] = await Promise.all([
    caller.client
      .from('activity_types')
      .select('id, name, is_custom')
      .eq('team_id', body.team_id)
      .is('archived_at', null)
      .order('sort_order'),
    caller.client
      .from('intensities')
      .select('id, name')
      .eq('team_id', body.team_id)
      .is('archived_at', null)
      .order('sort_order'),
  ]);
  if (types.error || !types.data?.length) return json({ error: 'You’re not on this team.' }, 403);

  // The daily allowance. Counted before asking the AI, so firing off many
  // requests at once can't get around it.
  const admin = adminClient();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const used = await admin
    .from('photo_reads')
    .select('photo_count')
    .eq('user_id', caller.userId)
    .gte('created_at', since);
  const usedToday = (used.data ?? []).reduce((sum, row) => sum + row.photo_count, 0);
  if (usedToday + photos.length > DAILY_PHOTO_LIMIT) {
    return json(
      { error: 'You’ve reached today’s limit for reading photos. You can still type the workout in.' },
      429,
    );
  }
  await admin
    .from('photo_reads')
    .insert({ user_id: caller.userId, team_id: body.team_id, photo_count: photos.length });

  const typeNames = types.data.map((type) => type.name);
  const intensityNames = (intensities.data ?? []).map((intensity) => intensity.name);

  const result = await askGemini({
    instructions: `You read workout screen photos so an athlete doesn't have to type the numbers in.
${READING_RULES}
The photos may show DIFFERENT workouts (for example three rowing pieces and one bike ride). Do not add anything together and do not decide which photos belong together: report each photo on its own.
pieces: exactly one entry per photo, in photo order ("photo" is 1 for the first photo, 2 for the second, and so on).
ACTIVITY: for each photo, choose the one that fits best from this team's list: ${typeNames.join(', ')}. If nothing fits, leave it out.
${intensityNames.length ? `INTENSITY: only if the screen makes it clear (for example intervals with rest are hard work), choose from: ${intensityNames.join(', ')}. Otherwise leave it out.` : ''}
For a photo you cannot read, give confidence 1 and leave the numbers out.`,
    prompt: `Read ${photos.length === 1 ? 'this photo' : `each of these ${photos.length} photos`}.`,
    photos,
    schema: {
      type: 'OBJECT',
      properties: {
        pieces: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              photo: { type: 'INTEGER' },
              activity: { type: 'STRING', nullable: true },
              intensity: { type: 'STRING', nullable: true },
              seconds: { type: 'INTEGER', nullable: true },
              distance_meters: { type: 'INTEGER', nullable: true },
              date: { type: 'STRING', nullable: true },
              confidence: { type: 'INTEGER' },
            },
            required: ['photo', 'confidence'],
          },
        },
      },
      required: ['pieces'],
    },
  });

  if (!result.ok) return json({ error: result.message }, result.kind === 'busy' ? 503 : 500);

  const sameName = (a: unknown, b: string) =>
    typeof a === 'string' && a.trim().toLowerCase() === b.toLowerCase();

  // Keep only readings the database would accept, at most one per photo.
  const pieces: Piece[] = [];
  const raw = Array.isArray(result.json.pieces) ? result.json.pieces : [];
  for (const entry of raw as Record<string, unknown>[]) {
    const photo = wholeNumber(entry?.photo, 1, photos.length);
    const seconds = wholeNumber(entry?.seconds, 1, 86_400);
    if (photo === null || seconds === null) continue;
    if (pieces.some((piece) => piece.photo === photo - 1)) continue;
    pieces.push({
      photo: photo - 1,
      seconds,
      distance_meters: wholeNumber(entry.distance_meters, 1, 1_000_000),
      date: typeof entry.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(entry.date) ? entry.date : null,
      activity_type_id: types.data.find((type) => sameName(entry.activity, type.name))?.id ?? null,
      intensity_id:
        (intensities.data ?? []).find((intensity) => sameName(entry.intensity, intensity.name))?.id ??
        null,
      confidence: wholeNumber(entry.confidence, 1, 10) ?? 1,
    });
  }
  const sessions = groupPieces(pieces, MIN_CONFIDENCE);

  const read = new Set(pieces.map((piece) => piece.photo));
  return json({
    sessions,
    // Photos nothing could be read from.
    unread: photos.map((_, index) => index).filter((index) => !read.has(index)),
    min_confidence: MIN_CONFIDENCE,
  });
});
