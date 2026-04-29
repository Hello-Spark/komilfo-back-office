// Edge Function : submit-lead
// Reçoit un POST depuis la LP Webflow (embed HTML/JS), vérifie le token Turnstile
// côté serveur, valide/sanitize le payload, mappe les valeurs UI vers les enums DB,
// puis insère dans public.leads (+ public.lead_produits si produits sélectionnés).
//
// Chaîne d'effets déclenchée ensuite côté DB :
//   INSERT leads
//     -> BEFORE INSERT trigger : résout magasin_id depuis code_postal (cf. routage-cp-magasins.md)
//     -> AFTER INSERT trigger  : pg_net -> Edge Function notify-new-lead -> Brevo
//
// Secrets attendus (Edge Function Secrets) :
//   - TURNSTILE_SECRET_KEY : clé secrète Cloudflare Turnstile
//   - ALLOWED_ORIGINS      : liste CSV d'origines autorisées (ex: "https://www.komilfo.fr,https://lp.komilfo.fr")
//   - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY : injectés automatiquement par le runtime

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

type LeadType = 'devis' | 'sav';
type LeadEcheance = 'dans_3_mois' | 'dans_annee' | 'pas_de_date';
type LeadTravaux = 'neuf' | 'renovation';
type LeadHabitat = 'maison' | 'appartement' | 'autres';
type LeadCreneau = 'matin' | 'apres_midi' | 'soiree';

type InboundPayload = {
  turnstile_token?: string;
  type?: string;
  nom?: string;
  prenom?: string;
  email?: string;
  tel?: string;
  code_postal?: string;
  code_insee?: string;
  ville?: string;
  message?: string;
  optin?: boolean;
  optin_text?: string;
  produits?: string[];
  echeance?: string;
  travaux?: string;
  habitat?: string;
  contact_creneaux?: string[];
  src?: string;
  campaign?: string;
  location_host?: string;
  location_href?: string;
  // Trackers Google Ads. Le formulaire Webflow doit lire les query params
  // ?gclid= / ?gbraid= / ?wbraid= au premier chargement et les persister
  // (cookie 1st party, durée 90 jours pour le gclid) avant de les renvoyer ici.
  gclid?: string;
  gbraid?: string;
  wbraid?: string;
};

const TYPE_MAP: Record<string, LeadType> = {
  devis: 'devis',
  Devis: 'devis',
  sav: 'sav',
  SAV: 'sav',
};

const ECHEANCE_MAP: Record<string, LeadEcheance> = {
  'Dans les 3 mois': 'dans_3_mois',
  dans_3_mois: 'dans_3_mois',
  "Dans l'année": 'dans_annee',
  'Dans l’année': 'dans_annee',
  dans_annee: 'dans_annee',
  'Pas de date fixée': 'pas_de_date',
  pas_de_date: 'pas_de_date',
};

const TRAVAUX_MAP: Record<string, LeadTravaux> = {
  Neuf: 'neuf',
  neuf: 'neuf',
  Rénovation: 'renovation',
  Renovation: 'renovation',
  renovation: 'renovation',
};

const HABITAT_MAP: Record<string, LeadHabitat> = {
  Maison: 'maison',
  maison: 'maison',
  Appartement: 'appartement',
  appartement: 'appartement',
  Autres: 'autres',
  autres: 'autres',
};

const CRENEAU_MAP: Record<string, LeadCreneau> = {
  Matin: 'matin',
  matin: 'matin',
  'Après-midi': 'apres_midi',
  'Apres-midi': 'apres_midi',
  apres_midi: 'apres_midi',
  Soirée: 'soiree',
  Soiree: 'soiree',
  soiree: 'soiree',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CP_RE = /^[0-9]{5}$/;
const INSEE_RE = /^[0-9A-Z]{5}$/;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_STRING_LENGTH = 255;

function corsHeaders(origin: string | null): HeadersInit {
  const allowed = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  const isAllowed = origin && allowed.includes(origin);
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : allowed[0] ?? '',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin),
    },
  });
}

function clampString(value: unknown, max = MAX_STRING_LENGTH): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, max);
}

function mapEnum<T extends string>(
  map: Record<string, T>,
  value: unknown,
): T | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return map[trimmed] ?? null;
}

function mapEnumArray<T extends string>(
  map: Record<string, T>,
  values: unknown,
): T[] {
  if (!Array.isArray(values)) return [];
  const out: T[] = [];
  const seen = new Set<T>();
  for (const v of values) {
    const mapped = mapEnum(map, v);
    if (mapped && !seen.has(mapped)) {
      seen.add(mapped);
      out.push(mapped);
    }
  }
  return out;
}

async function verifyTurnstile(token: string, ip: string | null): Promise<boolean> {
  const secret = Deno.env.get('TURNSTILE_SECRET_KEY');
  if (!secret) {
    console.error('TURNSTILE_SECRET_KEY is not configured');
    return false;
  }
  const body = new URLSearchParams();
  body.set('secret', secret);
  body.set('response', token);
  if (ip) body.set('remoteip', ip);

  try {
    const res = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!res.ok) {
      console.error(`Turnstile verify HTTP ${res.status}`);
      return false;
    }
    const data = (await res.json()) as { success?: boolean; 'error-codes'?: string[] };
    if (!data.success) {
      console.warn('Turnstile verify failed', data['error-codes']);
    }
    return data.success === true;
  } catch (err) {
    console.error('Turnstile verify exception', err);
    return false;
  }
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (req.method !== 'POST') {
    return json({ error: 'method not allowed' }, 405, origin);
  }

  let payload: InboundPayload;
  try {
    payload = (await req.json()) as InboundPayload;
  } catch {
    return json({ error: 'invalid json' }, 400, origin);
  }

  // Consentement RGPD : bloquant et non falsifiable côté DB (CHECK optin = true),
  // mais on refuse ici pour renvoyer une erreur claire au front.
  if (payload.optin !== true) {
    return json({ error: 'optin_required' }, 400, origin);
  }

  const token = typeof payload.turnstile_token === 'string' ? payload.turnstile_token : '';
  if (!token) {
    return json({ error: 'captcha_missing' }, 400, origin);
  }

  const ip =
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    null;

  const captchaOk = await verifyTurnstile(token, ip);
  if (!captchaOk) {
    return json({ error: 'captcha_failed' }, 403, origin);
  }

  const nom = clampString(payload.nom);
  const prenom = clampString(payload.prenom);
  const emailRaw = clampString(payload.email);
  const email = emailRaw ? emailRaw.toLowerCase() : null;
  const tel = clampString(payload.tel);
  const codePostal = clampString(payload.code_postal);
  const codeInseeRaw = clampString(payload.code_insee);
  const codeInsee = codeInseeRaw ? codeInseeRaw.toUpperCase() : null;
  const ville = clampString(payload.ville);
  const optinText = clampString(payload.optin_text, 1000);

  const missing: string[] = [];
  if (!nom) missing.push('nom');
  if (!prenom) missing.push('prenom');
  if (!email) missing.push('email');
  if (!tel) missing.push('tel');
  if (!codePostal) missing.push('code_postal');
  if (!codeInsee) missing.push('code_insee');
  if (!ville) missing.push('ville');
  if (!optinText) missing.push('optin_text');
  if (missing.length > 0) {
    return json({ error: 'missing_fields', fields: missing }, 400, origin);
  }

  if (!EMAIL_RE.test(email!)) {
    return json({ error: 'invalid_email' }, 400, origin);
  }
  if (!CP_RE.test(codePostal!)) {
    return json({ error: 'invalid_code_postal' }, 400, origin);
  }
  if (!INSEE_RE.test(codeInsee!)) {
    return json({ error: 'invalid_code_insee' }, 400, origin);
  }

  const type: LeadType = mapEnum(TYPE_MAP, payload.type) ?? 'devis';
  const echeance = mapEnum(ECHEANCE_MAP, payload.echeance);
  const travaux = mapEnum(TRAVAUX_MAP, payload.travaux);
  const habitat = mapEnum(HABITAT_MAP, payload.habitat);
  const contactCreneaux = mapEnumArray(CRENEAU_MAP, payload.contact_creneaux);

  const messageRaw = typeof payload.message === 'string' ? payload.message.trim() : '';
  const message = messageRaw.length > 0 ? messageRaw.slice(0, MAX_MESSAGE_LENGTH) : null;

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing');
    return json({ error: 'server_misconfigured' }, 500, origin);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data: leadInserted, error: leadError } = await supabase
    .from('leads')
    .insert({
      type,
      nom,
      prenom,
      email,
      tel,
      code_postal: codePostal,
      code_insee: codeInsee,
      ville,
      echeance,
      travaux,
      habitat,
      message,
      contact_creneaux: contactCreneaux,
      optin: true,
      optin_at: new Date().toISOString(),
      optin_text: optinText,
      src: clampString(payload.src),
      campaign: clampString(payload.campaign),
      location_host: clampString(payload.location_host),
      location_href: clampString(payload.location_href, 2000),
      user_agent: clampString(req.headers.get('user-agent'), 500),
      ip_address: ip,
      gclid: clampString(payload.gclid, 512),
      gbraid: clampString(payload.gbraid, 512),
      wbraid: clampString(payload.wbraid, 512),
      metadata: { source: 'webflow_lp' },
    })
    .select('id, magasin_id')
    .single();

  if (leadError || !leadInserted) {
    console.error('lead insert error', leadError);
    // Cas attendus gérés explicitement : le trigger `resolve_lead_magasin`
    // lève une exception si le code INSEE est inconnu.
    const msg = leadError?.message?.toLowerCase() ?? '';
    if (msg.includes('code insee inconnu')) {
      return json({ error: 'unknown_code_insee' }, 422, origin);
    }
    if (msg.includes('code postal inconnu')) {
      // Compat avec l'ancien trigger CP si le rollback n'a pas été fait.
      return json({ error: 'unknown_code_postal' }, 422, origin);
    }
    return json({ error: 'lead_insert_failed' }, 500, origin);
  }

  // Produits (join table). Best-effort : un échec ici ne rollback pas le lead,
  // mais il est loggé côté lead_activities pour traitement manuel.
  const produitValues = Array.isArray(payload.produits)
    ? payload.produits.filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    : [];

  if (produitValues.length > 0) {
    const { data: produitsRows, error: produitsErr } = await supabase
      .from('produits')
      .select('id, form_value')
      .in('form_value', produitValues);

    if (produitsErr) {
      console.error('produits lookup error', produitsErr);
    } else if (produitsRows && produitsRows.length > 0) {
      const rows = produitsRows.map((p) => ({
        lead_id: leadInserted.id,
        produit_id: p.id,
      }));
      const { error: linkErr } = await supabase.from('lead_produits').insert(rows);
      if (linkErr) {
        console.error('lead_produits insert error', linkErr);
        await supabase.from('lead_activities').insert({
          lead_id: leadInserted.id,
          type: 'note',
          title: 'Rattachement produits échoué',
          body: linkErr.message,
          details: { produit_values: produitValues },
        });
      }

      const unknown = produitValues.filter(
        (v) => !produitsRows.some((p) => p.form_value === v),
      );
      if (unknown.length > 0) {
        await supabase.from('lead_activities').insert({
          lead_id: leadInserted.id,
          type: 'note',
          title: 'Produits non référencés ignorés',
          body: unknown.join(', '),
          details: { unknown_form_values: unknown },
        });
      }
    }
  }

  return json(
    { ok: true, lead_id: leadInserted.id, magasin_id: leadInserted.magasin_id },
    201,
    origin,
  );
});
