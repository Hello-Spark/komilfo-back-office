import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentProfile } from '@/lib/supabase/queries';
import GoogleAdsSettingsForm from './GoogleAdsSettingsForm';
import ReplayConversionsButton from './ReplayConversionsButton';

export const dynamic = 'force-dynamic';

interface GoogleAdsSettings {
  id: number;
  enabled: boolean;
  customer_id: string | null;
  login_customer_id: string | null;
  conversion_action_id: string | null;
  conversion_label: string | null;
  default_value: number;
  currency: string;
  send_enhanced_conversions: boolean;
  updated_at: string;
}

interface ConversionLogRow {
  id: string;
  status: 'success' | 'error' | 'skipped';
  identifier_used: string;
  conversion_value: number | null;
  currency: string | null;
  error_message: string | null;
  created_at: string;
  lead_id: string;
}

export default async function GoogleAdsSettingsPage() {
  const me = await getCurrentProfile();
  if (!me) redirect('/signin?redirect=/parametres/google-ads');
  if (me.role !== 'admin') redirect('/');

  const supabase = await createClient();
  const [{ data: settings }, { data: recentLogs }] = await Promise.all([
    supabase.from('google_ads_settings').select('*').eq('id', 1).maybeSingle<GoogleAdsSettings>(),
    supabase
      .from('google_ads_conversion_logs')
      .select('id, status, identifier_used, conversion_value, currency, error_message, created_at, lead_id')
      .order('created_at', { ascending: false })
      .limit(20)
      .returns<ConversionLogRow[]>(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">
          Google Ads — Conversions offline
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Envoie automatiquement chaque lead gagné à Google Ads pour optimiser
          le bidding sur tes campagnes. Capture du GCLID côté formulaire requise.
        </p>
      </div>

      <GoogleAdsSettingsForm initialSettings={settings ?? null} />

      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-3 text-lg font-semibold text-gray-800 dark:text-white/90">
          Rattrapage manuel
        </h2>
        <ReplayConversionsButton
          disabled={!settings?.enabled || !settings?.customer_id || !settings?.conversion_action_id}
        />
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">
          Derniers envois
        </h2>
        {!recentLogs || recentLogs.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Aucun envoi enregistré pour le moment.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:text-gray-400">
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Lead</th>
                  <th className="py-2 pr-4">Statut</th>
                  <th className="py-2 pr-4">Identifiant</th>
                  <th className="py-2 pr-4">Valeur</th>
                  <th className="py-2 pr-4">Erreur</th>
                </tr>
              </thead>
              <tbody>
                {recentLogs.map((log) => (
                  <tr
                    key={log.id}
                    className="border-b border-gray-100 last:border-0 dark:border-gray-800"
                  >
                    <td className="py-2 pr-4 text-gray-700 dark:text-gray-300">
                      {new Date(log.created_at).toLocaleString('fr-FR')}
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs text-gray-700 dark:text-gray-300">
                      {log.lead_id.slice(0, 8).toUpperCase()}
                    </td>
                    <td className="py-2 pr-4">
                      <StatusPill status={log.status} />
                    </td>
                    <td className="py-2 pr-4 text-gray-700 dark:text-gray-300">
                      {log.identifier_used}
                    </td>
                    <td className="py-2 pr-4 text-gray-700 dark:text-gray-300">
                      {log.conversion_value !== null
                        ? `${log.conversion_value} ${log.currency ?? ''}`
                        : '—'}
                    </td>
                    <td className="py-2 pr-4 text-xs text-gray-500 dark:text-gray-400">
                      {log.error_message ?? ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: 'success' | 'error' | 'skipped' }) {
  const map = {
    success: 'bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-400',
    error: 'bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-400',
    skipped: 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-400',
  };
  const label = { success: 'Succès', error: 'Erreur', skipped: 'Ignoré' }[status];
  return (
    <span
      className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${map[status]}`}
    >
      {label}
    </span>
  );
}
