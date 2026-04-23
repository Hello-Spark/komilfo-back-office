// Edge Function : lookup-communes
// GET /functions/v1/lookup-communes?cp=XXXXX
//   -> 200 [{ code_insee, nom }]
//   -> 400 invalid_code_postal (format != 5 chiffres)
//   -> 204 si aucun résultat (CP non couvert par le réseau)
//
// Utilisé par le front embed (StepLocalisation) pour alimenter le dropdown
// « Ville » après saisie du code postal. Le front stocke le code_insee
// sélectionné et l'envoie au submit-lead (routage côté DB).
//
// Pas de Turnstile sur cet endpoint :
//   - read-only, pas d'impact base de données
//   - les données sont du référentiel INSEE public
//   - l'endpoint est naturellement limité par la fréquence de saisie CP
//     d'un utilisateur (pas d'incitation au spam)
//
// Cache HTTP : réponse taguée `public, max-age=3600` (le mapping
// communes→magasin change rarement — plusieurs fois par an au plus).

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const CP_RE = /^[0-9]{5}$/;

function corsHeaders(origin: string | null): HeadersInit {
  const allowed = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  const isAllowed = origin && allowed.includes(origin);
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : allowed[0] ?? '',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(body: unknown, status: number, origin: string | null, extraHeaders: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin),
      ...extraHeaders,
    },
  });
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (req.method !== 'GET') {
    return json({ error: 'method not allowed' }, 405, origin);
  }

  const url = new URL(req.url);
  const cp = url.searchParams.get('cp')?.trim() ?? '';

  if (!CP_RE.test(cp)) {
    return json({ error: 'invalid_code_postal' }, 400, origin);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing');
    return json({ error: 'server_misconfigured' }, 500, origin);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase
    .from('communes')
    .select('code_insee, nom')
    .eq('code_postal', cp)
    .order('nom', { ascending: true });

  if (error) {
    console.error('communes lookup error', error);
    return json({ error: 'lookup_failed' }, 500, origin);
  }

  // Cache public 1h : le référentiel change rarement. Si on change le
  // mapping, invalidation manuelle via `?v=xxx` côté client.
  return json(data ?? [], 200, origin, {
    'Cache-Control': 'public, max-age=3600',
  });
});
