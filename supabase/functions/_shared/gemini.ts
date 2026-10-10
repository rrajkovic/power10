// One place that talks to Google's Gemini. Both photo functions use it.
//
// We send photos plus instructions and ask for JSON in an exact shape
// (`schema`), so the reply can be used by code without guessing.

// Tried in order. A busy model is retried once, then skipped. Override with
// the GEMINI_MODELS secret (comma-separated).
const DEFAULT_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3.8-flash',
  'gemini-3.6-flash',
];

// Longest we wait for one model, and for all of them together.
const ATTEMPT_TIMEOUT_MS = 20_000;
const TOTAL_BUDGET_MS = 45_000;
const RETRY_PAUSE_MS = 1_500;

export type Photo = { mimeType: string; base64: string };

export type GeminiResult =
  | { ok: true; json: Record<string, unknown>; model: string }
  | { ok: false; kind: 'not_configured' | 'rejected_key' | 'busy'; message: string };

type Attempt =
  | { outcome: 'ok'; json: Record<string, unknown> }
  // Busy or broken on Google's side: worth one more try.
  | { outcome: 'retry'; reason: string }
  // This model can't do it: go to the next one.
  | { outcome: 'next'; reason: string }
  // Our key is wrong: no model will do better.
  | { outcome: 'stop' };

async function askModel(model: string, body: string, key: string, timeoutMs: number): Promise<Attempt> {
  let res: Response;
  try {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body,
        signal: AbortSignal.timeout(timeoutMs),
      },
    );
  } catch (error) {
    return { outcome: 'next', reason: `no answer (${error})` };
  }

  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).slice(0, 200);
    if (res.status === 401 || res.status === 403) return { outcome: 'stop' };
    if (res.status === 429 || res.status >= 500) {
      return { outcome: 'retry', reason: `HTTP ${res.status} ${detail}` };
    }
    return { outcome: 'next', reason: `HTTP ${res.status} ${detail}` };
  }

  const payload = await res.json().catch(() => null);
  const text: string =
    payload?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return { outcome: 'next', reason: 'reply was not JSON' };
  try {
    return { outcome: 'ok', json: JSON.parse(match[0]) };
  } catch {
    return { outcome: 'next', reason: 'reply JSON did not parse' };
  }
}

export async function askGemini(options: {
  instructions: string;
  prompt: string;
  photos: Photo[];
  schema: Record<string, unknown>;
}): Promise<GeminiResult> {
  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) {
    return { ok: false, kind: 'not_configured', message: 'Photo reading isn’t set up yet.' };
  }
  const models = (Deno.env.get('GEMINI_MODELS') ?? '')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);

  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: options.instructions }] },
    contents: [
      {
        role: 'user',
        parts: [
          { text: options.prompt },
          ...options.photos.map((photo) => ({
            inline_data: { mime_type: photo.mimeType, data: photo.base64 },
          })),
        ],
      },
    ],
    generationConfig: { responseMimeType: 'application/json', responseSchema: options.schema },
  });

  const deadline = Date.now() + TOTAL_BUDGET_MS;
  for (const model of models.length ? models : DEFAULT_MODELS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      const remaining = deadline - Date.now();
      if (remaining < 3_000) break;

      const result = await askModel(model, body, key, Math.min(ATTEMPT_TIMEOUT_MS, remaining));
      if (result.outcome === 'ok') return { ok: true, json: result.json, model };
      if (result.outcome === 'stop') {
        console.error('[gemini] the API key was rejected');
        return { ok: false, kind: 'rejected_key', message: 'Photo reading isn’t set up correctly.' };
      }
      console.warn(`[gemini] ${model} attempt ${attempt} failed: ${result.reason}`);
      if (result.outcome === 'next' || attempt === 2) break;
      await new Promise((resolve) => setTimeout(resolve, RETRY_PAUSE_MS));
    }
  }
  return {
    ok: false,
    kind: 'busy',
    message: 'The photo reader is busy right now. Try again in a minute.',
  };
}

// What every prompt needs to know about reading workout screens.
export const READING_RULES = `The photos show a workout summary: a rowing or bike erg monitor (such as a Concept2 PM5), a sports watch, a GPS or bike computer, a treadmill, or a fitness-app summary screen.
ONLY WORK TIME COUNTS, never rest. On an interval screen, read the totals from the summary row directly under the column headers (work time, total meters). Rows starting with "r" are rest: never count their time or meters. A "Total Time" that includes rest is not the workout time.
ROWER OR BIKE: Concept2 rowing and bike ergs share the same monitor. Tell them apart by the units, never the layout: pace per 500m and a rate in s/m or spm is rowing; pace per 1000m or a rate in rpm is a bike.
SEVERAL PHOTOS are different pieces of the SAME session, and every photo counts, even when two screens show identical numbers (people repeat the same piece, like 4 x 20:00). Add the pieces together. Within one photo, split rows under the summary row are part of that piece: never add them on top.
NEVER GUESS. If a number is not clearly readable, leave it out. Do not judge photo quality, lighting or styling.
DATES: report the date shown on the screen as YYYY-MM-DD. If no date is visible, report none.`;
