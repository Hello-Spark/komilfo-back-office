import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Regarde si l'email saisi au signup est déjà référencé dans `magasin_emails`.
// Sert uniquement à donner un feedback visuel — le rattachement effectif est
// fait côté DB par le trigger `profiles_auto_link_magasins` à la création du
// profile (cf. migration 20260423_profile_magasins.sql).
//
// Endpoint non authentifié (appelé depuis le formulaire de signup). Protections :
// - validation stricte du format email
// - payload de retour minimal (name, ville, groupe) — pas d'id magasin
// - RLS de magasin_emails bloque l'accès direct client : on passe par le
//   service_role serveur.

// Validation pragmatique sans regex overkill : un "@" avec quelque chose
// des deux côtés et un "." dans le domaine.
function isValidEmail(input: unknown): input is string {
  if (typeof input !== 'string') return false;
  const trimmed = input.trim();
  if (trimmed.length < 3 || trimmed.length > 254) return false;
  const at = trimmed.indexOf('@');
  if (at < 1 || at === trimmed.length - 1) return false;
  const domain = trimmed.slice(at + 1);
  return domain.includes('.') && !domain.startsWith('.') && !domain.endsWith('.');
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || !isValidEmail(body.email)) {
    return NextResponse.json({ error: 'invalid_email' }, { status: 400 });
  }

  const email = (body.email as string).trim().toLowerCase();

  let admin;
  try {
    admin = createAdminClient();
  } catch (err) {
    // Var d'env SUPABASE_SERVICE_ROLE_KEY manquante en prod → on loggue
    // explicitement et on rend une erreur propre (le client affiche un
    // message neutre, ne bloque pas le signup).
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[preview-magasin] admin client init failed', err);
    return NextResponse.json(
      { error: 'server_misconfigured', detail: msg },
      { status: 500 },
    );
  }

  const { data, error } = await admin
    .from('magasin_emails')
    .select('magasin:magasins(name, ville, groupe)')
    .eq('email', email);

  if (error) {
    console.error('[preview-magasin] query failed', { email, error });
    return NextResponse.json(
      {
        error: 'query_failed',
        detail: error.message,
        code: error.code ?? null,
        hint: error.hint ?? null,
      },
      { status: 500 },
    );
  }

  // Dedup (même magasin peut apparaître plusieurs fois si listé sous plusieurs rôles)
  // + skip les null au cas où un magasin aurait été supprimé mais pas l'email.
  const seen = new Set<string>();
  type MagasinRow = { name: string | null; ville: string | null; groupe: string | null };
  const magasins: MagasinRow[] = [];
  for (const row of data ?? []) {
    // Supabase renvoie la relation en array même pour une FK 1:1 — on
    // normalise avant usage.
    const raw = (row as unknown as { magasin: MagasinRow | MagasinRow[] | null }).magasin;
    const m = Array.isArray(raw) ? (raw[0] ?? null) : raw;
    if (!m || !m.name) continue;
    const key = `${m.name}|${m.ville ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    magasins.push(m);
  }

  return NextResponse.json({
    matched: magasins.length > 0,
    magasins,
  });
}
