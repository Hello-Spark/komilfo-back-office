import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendConversionForLead } from '@/lib/googleAds/sendConversion';

// Limites volontairement basses : Google Ads n'aime pas le spam, et on veut
// que la route réponde dans un timing UI raisonnable. Pour un backlog plus
// gros, ré-appeler la route plusieurs fois (les leads déjà succès sont skip).
const LOOKBACK_DAYS = 90; // GCLID expire à 90 jours
const MAX_LEADS_PER_RUN = 50;

interface SettingsRow {
  enabled: boolean;
  customer_id: string | null;
  login_customer_id: string | null;
  conversion_action_id: string | null;
  default_value: number;
  currency: string;
  send_enhanced_conversions: boolean;
}

interface LeadRow {
  id: string;
  status: string;
  email: string;
  tel: string | null;
  prenom: string | null;
  nom: string | null;
  gclid: string | null;
  gbraid: string | null;
  wbraid: string | null;
  lead_value: number | string | null;
  currency: string | null;
  updated_at: string;
}

async function assertAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401 as const };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile || profile.role !== 'admin') {
    return { ok: false as const, status: 403 as const };
  }
  return { ok: true as const, userId: user.id };
}

export async function POST() {
  const auth = await assertAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: 'forbidden' }, { status: auth.status });
  }

  const admin = createAdminClient();

  const { data: settings, error: settingsErr } = await admin
    .from('google_ads_settings')
    .select('*')
    .eq('id', 1)
    .maybeSingle<SettingsRow>();

  if (settingsErr) {
    return NextResponse.json(
      { error: 'settings_error', detail: settingsErr.message },
      { status: 500 },
    );
  }
  if (!settings || !settings.enabled) {
    return NextResponse.json({ error: 'disabled' }, { status: 400 });
  }
  if (!settings.customer_id || !settings.conversion_action_id) {
    return NextResponse.json({ error: 'incomplete_settings' }, { status: 400 });
  }

  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 3600 * 1000).toISOString();

  const { data: wonLeads, error: leadsErr } = await admin
    .from('leads')
    .select(
      'id, status, email, tel, prenom, nom, gclid, gbraid, wbraid, lead_value, currency, updated_at',
    )
    .eq('status', 'won')
    .gte('updated_at', since)
    .order('updated_at', { ascending: false })
    .limit(500)
    .returns<LeadRow[]>();

  if (leadsErr) {
    return NextResponse.json(
      { error: 'leads_fetch_failed', detail: leadsErr.message },
      { status: 500 },
    );
  }

  // PostgREST ne sait pas faire un anti-join élégant via supabase-js : on
  // récupère les ids de leads déjà acquittés et on filtre côté JS. La
  // volumétrie attendue (quelques centaines max sur 90j) le permet.
  const { data: successLogs, error: logsErr } = await admin
    .from('google_ads_conversion_logs')
    .select('lead_id')
    .eq('status', 'success')
    .gte('created_at', since);

  if (logsErr) {
    return NextResponse.json(
      { error: 'logs_fetch_failed', detail: logsErr.message },
      { status: 500 },
    );
  }

  const alreadySent = new Set(
    (successLogs ?? []).map((row) => (row as { lead_id: string }).lead_id),
  );
  const pending = (wonLeads ?? [])
    .filter((l) => !alreadySent.has(l.id))
    .slice(0, MAX_LEADS_PER_RUN);

  let success = 0;
  let errors = 0;
  let skipped = 0;
  const failures: { lead_id: string; reason: string }[] = [];

  for (const lead of pending) {
    const outcome = await sendConversionForLead({
      admin,
      leadId: lead.id,
      triggeredBy: auth.userId,
      prefetchedSettings: settings,
      prefetchedLead: lead,
    });
    if (outcome.kind === 'success') success++;
    else if (outcome.kind === 'skipped') {
      skipped++;
      failures.push({ lead_id: lead.id, reason: outcome.reason });
    } else {
      errors++;
      failures.push({ lead_id: lead.id, reason: outcome.message });
    }
  }

  return NextResponse.json({
    ok: true,
    pending_total: pending.length,
    processed: success + errors + skipped,
    success,
    errors,
    skipped,
    failures: failures.slice(0, 20),
    truncated: pending.length === MAX_LEADS_PER_RUN,
  });
}
