import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

// Lets the web version of the app call these functions.
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// A Supabase client that acts as the signed-in person who called the
// function, so every query still goes through row-level security.
// Returns null when nobody is signed in.
export async function callerClient(
  req: Request,
): Promise<{ client: SupabaseClient; userId: string } | null> {
  const authorization = req.headers.get('Authorization');
  if (!authorization) return null;
  const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
  });
  const { data, error } = await client.auth.getUser(authorization.replace(/^Bearer /i, ''));
  if (error || !data.user) return null;
  return { client, userId: data.user.id };
}

// Full access, skipping row-level security. Only for work the caller must
// not be able to do themselves (like writing a verification result).
export function adminClient(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
}
