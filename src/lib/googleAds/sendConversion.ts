import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { uploadClickConversion } from './uploadConversion';

interface GoogleAdsSettings {
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

export type SendConversionOutcome =
  | { kind: 'success'; identifierUsed: string }
  | { kind: 'error'; message: string }
  | { kind: 'skipped'; reason: string };

interface SendInput {
  admin: SupabaseClient;
  leadId: string;
  triggeredBy: string | null;
  // Optionnel : settings/lead déjà chargés (évite les round-trips dans le replay batch).
  prefetchedSettings?: GoogleAdsSettings | null;
  prefetchedLead?: LeadRow | null;
}

// Logique partagée entre l'envoi single (route POST /leads/[id]) et le replay
// batch. Charge lead + settings, vérifie les pré-conditions, appelle l'API
// Google Ads et logge le résultat dans google_ads_conversion_logs.
export async function sendConversionForLead(
  input: SendInput,
): Promise<SendConversionOutcome> {
  const { admin, leadId, triggeredBy } = input;

  const [leadRow, settings] = await Promise.all([
    input.prefetchedLead !== undefined
      ? Promise.resolve(input.prefetchedLead)
      : fetchLead(admin, leadId),
    input.prefetchedSettings !== undefined
      ? Promise.resolve(input.prefetchedSettings)
      : fetchSettings(admin),
  ]);

  if (!leadRow) {
    return { kind: 'error', message: 'lead_not_found' };
  }

  if (!settings || !settings.enabled) {
    await logSkipped(admin, leadId, 'settings_disabled', triggeredBy);
    return { kind: 'skipped', reason: 'settings_disabled' };
  }
  if (!settings.customer_id || !settings.conversion_action_id) {
    await logSkipped(admin, leadId, 'settings_incomplete', triggeredBy);
    return { kind: 'skipped', reason: 'settings_incomplete' };
  }
  if (leadRow.status !== 'won') {
    await logSkipped(admin, leadId, 'lead_not_won', triggeredBy);
    return { kind: 'skipped', reason: 'lead_not_won' };
  }

  const value =
    leadRow.lead_value !== null && leadRow.lead_value !== undefined
      ? Number(leadRow.lead_value)
      : settings.default_value;
  const currency = leadRow.currency ?? settings.currency ?? 'EUR';

  let result;
  try {
    result = await uploadClickConversion({
      customerId: settings.customer_id,
      loginCustomerId: settings.login_customer_id,
      conversionActionId: settings.conversion_action_id,
      conversionDateTime: new Date(leadRow.updated_at),
      conversionValue: value,
      currencyCode: currency,
      orderId: leadRow.id,
      gclid: leadRow.gclid,
      gbraid: leadRow.gbraid,
      wbraid: leadRow.wbraid,
      email: leadRow.email,
      phone: leadRow.tel,
      firstName: leadRow.prenom,
      lastName: leadRow.nom,
      sendEnhancedConversions: settings.send_enhanced_conversions,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error';
    await admin.from('google_ads_conversion_logs').insert({
      lead_id: leadId,
      status: 'error',
      identifier_used: leadRow.gclid ? 'gclid' : 'enhanced_only',
      conversion_value: value,
      currency,
      conversion_action: `customers/${settings.customer_id}/conversionActions/${settings.conversion_action_id}`,
      order_id: leadId,
      error_message: message,
      triggered_by: triggeredBy,
    });
    return { kind: 'error', message };
  }

  await admin.from('google_ads_conversion_logs').insert({
    lead_id: leadId,
    status: result.ok ? 'success' : 'error',
    identifier_used: result.identifierUsed,
    conversion_value: value,
    currency,
    conversion_action: result.conversionAction,
    order_id: leadId,
    request_payload: result.request as object,
    response_payload: result.response as object,
    error_message: result.errorMessage ?? null,
    triggered_by: triggeredBy,
  });

  if (!result.ok) {
    return { kind: 'error', message: result.errorMessage ?? 'upload_failed' };
  }
  return { kind: 'success', identifierUsed: result.identifierUsed };
}

async function fetchLead(admin: SupabaseClient, leadId: string): Promise<LeadRow | null> {
  const { data } = await admin
    .from('leads')
    .select(
      'id, status, email, tel, prenom, nom, gclid, gbraid, wbraid, lead_value, currency, updated_at',
    )
    .eq('id', leadId)
    .maybeSingle<LeadRow>();
  return data ?? null;
}

async function fetchSettings(admin: SupabaseClient): Promise<GoogleAdsSettings | null> {
  const { data } = await admin
    .from('google_ads_settings')
    .select('*')
    .eq('id', 1)
    .maybeSingle<GoogleAdsSettings>();
  return data ?? null;
}

async function logSkipped(
  admin: SupabaseClient,
  leadId: string,
  reason: string,
  triggeredBy: string | null,
): Promise<void> {
  await admin.from('google_ads_conversion_logs').insert({
    lead_id: leadId,
    status: 'skipped',
    identifier_used: 'none',
    error_message: reason,
    triggered_by: triggeredBy,
  });
}
