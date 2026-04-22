import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

type LeadRecord = {
  id: string;
  magasin_id: string | null;
  type: 'devis' | 'sav';
  status: string;
  priority: string | null;
  nom: string;
  prenom: string;
  email: string;
  tel: string;
  code_postal: string;
  ville: string;
  travaux: string | null;
  habitat: string | null;
  echeance: string | null;
  message: string | null;
  contact_creneaux: string[] | null;
  created_at: string;
};

type WebhookPayload = {
  type: 'INSERT';
  table: string;
  schema: string;
  record: LeadRecord;
  old_record: null;
};

type Recipient = { email: string; name?: string };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function escapeHtml(value: string | null | undefined): string {
  if (value == null) return '';
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatList(values: (string | null | undefined)[]): string {
  return values.filter((v) => v != null && v !== '').join(', ');
}

function buildSubject(lead: LeadRecord): string {
  const kind = lead.type === 'sav' ? 'SAV' : 'Devis';
  return `[Komilfo] Nouveau ${kind} — ${lead.prenom} ${lead.nom} (${lead.code_postal})`;
}

function buildHtml(lead: LeadRecord, magasinName: string, leadUrl: string): string {
  const kindLabel = lead.type === 'sav' ? 'demande SAV' : 'demande de devis';
  const rows: [string, string][] = [
    ['Contact', `${escapeHtml(lead.prenom)} ${escapeHtml(lead.nom)}`],
    ['Email', `<a href="mailto:${escapeHtml(lead.email)}">${escapeHtml(lead.email)}</a>`],
    ['Téléphone', `<a href="tel:${escapeHtml(lead.tel)}">${escapeHtml(lead.tel)}</a>`],
    ['Localisation', escapeHtml(`${lead.code_postal} ${lead.ville}`)],
    ['Travaux', escapeHtml(lead.travaux ?? '—')],
    ['Habitat', escapeHtml(lead.habitat ?? '—')],
    ['Échéance', escapeHtml(lead.echeance ?? '—')],
    ['Créneaux de rappel', escapeHtml(formatList(lead.contact_creneaux ?? []) || '—')],
  ];

  const rowsHtml = rows
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:8px 12px;color:#6b7280;font-size:13px;width:180px;vertical-align:top;">${label}</td>
          <td style="padding:8px 12px;color:#111827;font-size:14px;">${value}</td>
        </tr>`,
    )
    .join('');

  const messageBlock = lead.message
    ? `
      <tr>
        <td colspan="2" style="padding:16px 12px 0;">
          <div style="font-size:13px;color:#6b7280;margin-bottom:6px;">Message du client</div>
          <div style="background:#f9fafb;border-radius:6px;padding:12px;color:#111827;font-size:14px;line-height:1.5;white-space:pre-wrap;">${escapeHtml(lead.message)}</div>
        </td>
      </tr>`
    : '';

  return `<!doctype html>
<html lang="fr">
  <body style="margin:0;padding:24px;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
      <tr>
        <td style="padding:20px 24px;background:#111827;color:#ffffff;">
          <div style="font-size:13px;opacity:0.8;">Komilfo — ${escapeHtml(magasinName)}</div>
          <div style="font-size:20px;font-weight:600;margin-top:4px;">Nouvelle ${kindLabel}</div>
        </td>
      </tr>
      <tr>
        <td style="padding:20px 24px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            ${rowsHtml}
            ${messageBlock}
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:0 24px 24px;">
          <a href="${escapeHtml(leadUrl)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:6px;font-weight:600;font-size:14px;">Voir le lead dans l'app</a>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 24px;background:#f9fafb;color:#6b7280;font-size:12px;border-top:1px solid #e5e7eb;">
          Cet email a été envoyé automatiquement suite à la création du lead côté formulaire devis-komilfo.fr.
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function buildText(lead: LeadRecord, magasinName: string, leadUrl: string): string {
  const kindLabel = lead.type === 'sav' ? 'demande SAV' : 'demande de devis';
  return [
    `Komilfo — ${magasinName}`,
    `Nouvelle ${kindLabel}`,
    '',
    `Contact: ${lead.prenom} ${lead.nom}`,
    `Email: ${lead.email}`,
    `Téléphone: ${lead.tel}`,
    `Localisation: ${lead.code_postal} ${lead.ville}`,
    `Travaux: ${lead.travaux ?? '—'}`,
    `Habitat: ${lead.habitat ?? '—'}`,
    `Échéance: ${lead.echeance ?? '—'}`,
    `Créneaux de rappel: ${formatList(lead.contact_creneaux ?? []) || '—'}`,
    lead.message ? `\nMessage:\n${lead.message}` : '',
    '',
    `Voir le lead: ${leadUrl}`,
  ]
    .filter(Boolean)
    .join('\n');
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return json({ error: 'method not allowed' }, 405);
  }

  const expectedSecret = Deno.env.get('WEBHOOK_SECRET');
  if (!expectedSecret) {
    console.error('WEBHOOK_SECRET is not configured');
    return json({ error: 'server misconfigured' }, 500);
  }
  if (req.headers.get('x-webhook-secret') !== expectedSecret) {
    return json({ error: 'unauthorized' }, 401);
  }

  let payload: WebhookPayload;
  try {
    payload = (await req.json()) as WebhookPayload;
  } catch {
    return json({ error: 'invalid json' }, 400);
  }

  const lead = payload?.record;
  if (!lead?.id) {
    return json({ error: 'missing record' }, 400);
  }
  if (!lead.magasin_id) {
    return json({ skipped: 'lead has no magasin_id' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing');
    return json({ error: 'server misconfigured' }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const [magasinRes, profilesRes] = await Promise.all([
    supabase
      .from('magasins')
      .select('id, code, name, ville')
      .eq('id', lead.magasin_id)
      .single(),
    supabase
      .from('profiles')
      .select('email, first_name, last_name')
      .eq('magasin_id', lead.magasin_id)
      .eq('active', true),
  ]);

  if (magasinRes.error) {
    console.error('magasin fetch error', magasinRes.error);
    return json({ error: `magasin fetch: ${magasinRes.error.message}` }, 500);
  }
  if (profilesRes.error) {
    console.error('profiles fetch error', profilesRes.error);
    return json({ error: `profiles fetch: ${profilesRes.error.message}` }, 500);
  }

  const magasin = magasinRes.data;
  const recipients: Recipient[] = (profilesRes.data ?? [])
    .filter((p): p is { email: string; first_name: string | null; last_name: string | null } =>
      typeof p.email === 'string' && p.email.length > 0,
    )
    .map((p) => {
      const fullName = [p.first_name, p.last_name].filter(Boolean).join(' ').trim();
      return fullName ? { email: p.email, name: fullName } : { email: p.email };
    });

  if (recipients.length === 0) {
    console.warn(`no active recipients for magasin ${lead.magasin_id}`);
    await supabase.from('lead_activities').insert({
      lead_id: lead.id,
      type: 'email',
      title: 'Notification magasin ignorée',
      body: 'Aucun utilisateur actif rattaché au magasin',
      details: { reason: 'no_recipients', magasin_id: lead.magasin_id },
    });
    return json({ skipped: 'no active recipients' });
  }

  const brevoKey = Deno.env.get('BREVO_API_KEY');
  if (!brevoKey) {
    console.error('BREVO_API_KEY missing');
    return json({ error: 'server misconfigured' }, 500);
  }

  const fromEmail = Deno.env.get('MAIL_FROM_EMAIL') ?? 'no-reply@komilfo.fr';
  const fromName = Deno.env.get('MAIL_FROM_NAME') ?? 'Komilfo';
  const appBaseUrl = (Deno.env.get('APP_BASE_URL') ?? 'http://localhost:3000').replace(/\/+$/, '');
  const leadUrl = `${appBaseUrl}/leads/${lead.id}`;
  const magasinName = magasin?.name ?? 'votre magasin';

  const brevoRes = await fetch(BREVO_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      accept: 'application/json',
      'api-key': brevoKey,
    },
    body: JSON.stringify({
      sender: { email: fromEmail, name: fromName },
      to: recipients,
      subject: buildSubject(lead),
      htmlContent: buildHtml(lead, magasinName, leadUrl),
      textContent: buildText(lead, magasinName, leadUrl),
      tags: ['new-lead', `magasin:${magasin?.code ?? lead.magasin_id}`, `type:${lead.type}`],
    }),
  });

  if (!brevoRes.ok) {
    const errBody = await brevoRes.text();
    console.error(`Brevo error ${brevoRes.status}: ${errBody}`);
    await supabase.from('lead_activities').insert({
      lead_id: lead.id,
      type: 'email',
      title: 'Notification magasin échouée',
      body: `Erreur Brevo ${brevoRes.status}`,
      details: {
        magasin_id: lead.magasin_id,
        status: brevoRes.status,
        recipients: recipients.map((r) => r.email),
        error: errBody,
      },
    });
    return json({ error: `brevo ${brevoRes.status}`, details: errBody }, 502);
  }

  const brevoData = (await brevoRes.json()) as { messageId?: string };

  await supabase.from('lead_activities').insert({
    lead_id: lead.id,
    type: 'email',
    title: 'Notification envoyée au magasin',
    body: `${recipients.length} destinataire(s) — ${magasinName}`,
    details: {
      magasin_id: lead.magasin_id,
      message_id: brevoData.messageId,
      recipients: recipients.map((r) => r.email),
    },
  });

  return json({ sent: recipients.length, message_id: brevoData.messageId });
});
