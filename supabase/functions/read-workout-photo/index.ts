// Reads photos of a workout screen and returns what to put in the logging
// form: time, distance, date, and the team's activity and intensity.
//
// Called by the app while the form is open. Nothing is saved here.

import { askGemini, READING_RULES, type Photo } from '../_shared/gemini.ts';
import { callerClient, corsHeaders, json } from '../_shared/http.ts';

const MAX_PHOTOS = 4;
// About 3 MB per photo once decoded; the app shrinks them well below this.
const MAX_BASE64_LENGTH = 4_000_000;

type Body = { team_id?: string; photos?: Photo[] };

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

  const typeNames = types.data.map((type) => type.name);
  const intensityNames = (intensities.data ?? []).map((intensity) => intensity.name);

  const result = await askGemini({
    instructions: `You read workout screen photos so an athlete doesn't have to type the numbers in.
${READING_RULES}
ACTIVITY: choose the one that fits best from this team's list: ${typeNames.join(', ')}. If nothing fits, leave it out.
${intensityNames.length ? `INTENSITY: only if the screen makes it clear (for example intervals with rest are hard work), choose from: ${intensityNames.join(', ')}. Otherwise leave it out.` : ''}
NOTE: one short, friendly sentence for the athlete saying what you read (for example "Read 4 pieces: 80 min, 20.7 km."), or why you couldn't read it.`,
    prompt: `Read ${photos.length === 1 ? 'this photo' : `these ${photos.length} photos`} of one training session.`,
    photos,
    schema: {
      type: 'OBJECT',
      properties: {
        readable: { type: 'BOOLEAN' },
        seconds: { type: 'INTEGER', nullable: true },
        distance_meters: { type: 'INTEGER', nullable: true },
        date: { type: 'STRING', nullable: true },
        activity: { type: 'STRING', nullable: true },
        intensity: { type: 'STRING', nullable: true },
        note: { type: 'STRING' },
      },
      required: ['readable', 'note'],
    },
  });

  if (!result.ok) return json({ error: result.message }, result.kind === 'busy' ? 503 : 500);

  const read = result.json;
  const sameName = (a: unknown, b: string) =>
    typeof a === 'string' && a.trim().toLowerCase() === b.toLowerCase();
  const seconds = Number(read.seconds);
  const meters = Number(read.distance_meters);

  return json({
    readable: read.readable === true,
    note: typeof read.note === 'string' ? read.note.slice(0, 300) : '',
    // Only pass on values the database would accept.
    seconds: Number.isInteger(seconds) && seconds >= 1 && seconds <= 86_400 ? seconds : null,
    distance_meters: Number.isInteger(meters) && meters >= 1 && meters <= 1_000_000 ? meters : null,
    date: typeof read.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(read.date) ? read.date : null,
    activity_type_id: types.data.find((type) => sameName(read.activity, type.name))?.id ?? null,
    intensity_id:
      (intensities.data ?? []).find((intensity) => sameName(read.intensity, intensity.name))?.id ?? null,
  });
});
