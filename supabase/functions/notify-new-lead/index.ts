import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

// Charte Komilfo (reprise des templates Supabase + Tailwind config back-office).
const BRAND = {
  yellow: '#fdd626',
  yellowDark: '#8a6d0a',
  text: '#1f2937',
  textMuted: '#4b5563',
  textFaint: '#6b7280',
  textHint: '#9ca3af',
  border: '#e5e7eb',
  borderSoft: '#f0efec',
  bgApp: '#f4f4f2',
  bgCard: '#ffffff',
  bgSurface: '#f9fafb',
};

const LOGO_URL = 'https://www.komilfo.fr/themes/custom/komilfo/logo.png';

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
type MagasinInfo = { name: string | null; code: string | null; gerant_nom: string | null; gerant_prenom: string | null };

const ECHEANCE_LABEL: Record<string, string> = {
  dans_3_mois: 'Dans 3 mois',
  dans_annee: "Dans l'année",
  pas_de_date: 'Pas de date',
};
const TRAVAUX_LABEL: Record<string, string> = { neuf: 'Neuf', renovation: 'Rénovation' };
const HABITAT_LABEL: Record<string, string> = {
  maison: 'Maison',
  appartement: 'Appartement',
  autres: 'Autres',
};
const CRENEAU_LABEL: Record<string, string> = {
  matin: 'Matin',
  apres_midi: 'Après-midi',
  soiree: 'Soirée',
};
const PRIORITY_LABEL: Record<string, string> = {
  urgent: 'Urgent',
  high: 'Prioritaire',
  normal: 'Normal',
  low: 'Faible',
};

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

function formatPhoneDisplay(tel: string): string {
  const digits = tel.replace(/\D+/g, '');
  if (digits.length === 10 && digits.startsWith('0')) {
    return digits.replace(/(\d{2})(?=\d)/g, '$1 ').trim();
  }
  return tel.trim();
}

function formatPhoneHref(tel: string): string {
  const trimmed = tel.trim();
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D+/g, '');
  if (!digits) return '';
  if (!hasPlus && digits.length === 10 && digits.startsWith('0')) {
    return `+33${digits.slice(1)}`;
  }
  return `${hasPlus ? '+' : ''}${digits}`;
}

function formatCreatedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function buildSubject(lead: LeadRecord): string {
  const kind = lead.type === 'sav' ? 'SAV' : 'Devis';
  return `[Komilfo] Nouveau ${kind} — ${lead.prenom} ${lead.nom} (${lead.code_postal})`;
}

// ---------- Template HTML : même organisation visuelle que le drawer ----------

function badge(label: string, style: 'solid' | 'soft' = 'soft'): string {
  if (style === 'solid') {
    return `<span style="display:inline-block;padding:3px 10px;background-color:${BRAND.text};color:#ffffff;font-size:11px;font-weight:600;letter-spacing:0.04em;border-radius:999px;text-transform:uppercase;">${escapeHtml(label)}</span>`;
  }
  return `<span style="display:inline-block;padding:3px 10px;background-color:${BRAND.bgSurface};color:${BRAND.textMuted};font-size:11px;font-weight:600;letter-spacing:0.04em;border-radius:999px;border:1px solid ${BRAND.border};">${escapeHtml(label)}</span>`;
}

function field(label: string, value: string): string {
  // Champs en 2 colonnes émulés via table (compatible clients email).
  return `
    <td style="padding:10px 0;vertical-align:top;width:50%;">
      <div style="font-size:11px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:${BRAND.textFaint};">${escapeHtml(label)}</div>
      <div style="margin-top:4px;font-size:14px;line-height:1.45;color:${BRAND.text};">${value}</div>
    </td>`;
}

function row(cells: string[]): string {
  // Pad à 2 cellules pour garder l'alignement.
  const padded = cells.length % 2 === 0 ? cells : [...cells, '<td style="width:50%;">&nbsp;</td>'];
  return `<tr>${padded.join('')}</tr>`;
}

function buildHtml(
  lead: LeadRecord,
  magasin: MagasinInfo | null,
  produits: string[],
  leadUrl: string,
): string {
  const kindLabel = lead.type === 'sav' ? 'Nouvelle demande SAV' : 'Nouveau devis';
  const emailHref = `mailto:${encodeURIComponent(lead.email)}`;
  const telHref = formatPhoneHref(lead.tel);
  const telDisplay = formatPhoneDisplay(lead.tel);
  const magasinName = magasin?.name ?? 'Magasin à assigner';
  const gerantFull = [magasin?.gerant_prenom, magasin?.gerant_nom].filter(Boolean).join(' ').trim();
  const createdAt = formatCreatedAt(lead.created_at);
  const leadIdShort = lead.id.slice(0, 8).toUpperCase();

  const creneaux = (lead.contact_creneaux ?? [])
    .map((c) => CRENEAU_LABEL[c] ?? c)
    .filter(Boolean)
    .join(', ') || '—';

  // Grille Infos commerciales — 2 colonnes, même labels que le drawer.
  const rows: string[] = [];
  rows.push(
    row([
      field('Email', `<a href="${emailHref}" style="color:${BRAND.yellowDark};text-decoration:underline;font-weight:500;word-break:break-all;">${escapeHtml(lead.email)}</a>`),
      field(
        'Téléphone',
        telHref
          ? `<a href="tel:${escapeHtml(telHref)}" style="color:${BRAND.yellowDark};text-decoration:underline;font-weight:500;">${escapeHtml(telDisplay)}</a>`
          : escapeHtml(telDisplay),
      ),
    ]),
  );
  rows.push(
    row([
      field('Localisation', `${escapeHtml(lead.ville)} <span style="color:${BRAND.textFaint};">(${escapeHtml(lead.code_postal)})</span>`),
      field('Créneaux préférés', escapeHtml(creneaux)),
    ]),
  );
  rows.push(
    row([
      field('Travaux', escapeHtml(lead.travaux ? TRAVAUX_LABEL[lead.travaux] ?? lead.travaux : '—')),
      field('Habitat', escapeHtml(lead.habitat ? HABITAT_LABEL[lead.habitat] ?? lead.habitat : '—')),
    ]),
  );
  rows.push(
    row([
      field('Échéance', escapeHtml(lead.echeance ? ECHEANCE_LABEL[lead.echeance] ?? lead.echeance : '—')),
      field('Magasin', escapeHtml(magasinName)),
    ]),
  );

  const produitsBlock = produits.length > 0
    ? `
        <tr><td colspan="2" style="padding-top:12px;">
          <div style="font-size:11px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:${BRAND.textFaint};margin-bottom:8px;">Produits demandés</div>
          <div style="line-height:1.9;">
            ${produits.map((p) => badge(p)).join(' ')}
          </div>
        </td></tr>`
    : '';

  const messageBlock = lead.message
    ? `
        <tr><td colspan="2" style="padding-top:16px;">
          <div style="font-size:11px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:${BRAND.textFaint};margin-bottom:8px;">Message du client</div>
          <div style="background-color:${BRAND.bgSurface};border:1px solid ${BRAND.border};border-radius:8px;padding:12px 14px;font-size:14px;line-height:1.6;color:${BRAND.textMuted};white-space:pre-wrap;">${escapeHtml(lead.message)}</div>
        </td></tr>`
    : '';

  const priorityBadge = lead.priority && lead.priority !== 'normal'
    ? badge(PRIORITY_LABEL[lead.priority] ?? lead.priority)
    : '';

  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <meta name="supported-color-schemes" content="light" />
    <title>${escapeHtml(buildSubject(lead))}</title>
  </head>
  <body style="margin:0;padding:0;background-color:${BRAND.bgApp};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:${BRAND.text};">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${BRAND.bgApp};">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="640" style="max-width:640px;background-color:${BRAND.bgCard};border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.04);">

            <!-- Header Komilfo (fond jaune + logo) -->
            <tr>
              <td style="background-color:${BRAND.yellow};padding:24px 32px;">
                <img src="${LOGO_URL}" alt="Komilfo" height="36" style="display:block;height:36px;width:auto;border:0;outline:none;text-decoration:none;" />
              </td>
            </tr>

            <!-- Bandeau titre + badges -->
            <tr>
              <td style="padding:28px 32px 8px 32px;">
                <div style="margin-bottom:10px;">
                  ${badge(lead.type.toUpperCase(), 'solid')}
                  ${priorityBadge ? ' ' + priorityBadge : ''}
                </div>
                <h1 style="margin:0;font-size:24px;line-height:1.3;font-weight:600;color:${BRAND.text};">${kindLabel}</h1>
                <p style="margin:6px 0 0 0;font-size:16px;line-height:1.4;color:${BRAND.textMuted};">
                  <strong style="color:${BRAND.text};">${escapeHtml(lead.prenom)} ${escapeHtml(lead.nom)}</strong>
                  &nbsp;·&nbsp; ${escapeHtml(lead.ville)} (${escapeHtml(lead.code_postal)})
                </p>
              </td>
            </tr>

            <!-- Section Infos commerciales -->
            <tr>
              <td style="padding:16px 32px 0 32px;">
                <div style="border:1px solid ${BRAND.border};border-radius:12px;padding:4px 18px 14px 18px;">
                  <div style="font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${BRAND.textFaint};padding:14px 0 6px 0;">Infos commerciales</div>
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                    ${rows.join('')}
                    ${produitsBlock}
                    ${messageBlock}
                  </table>
                </div>
              </td>
            </tr>

            <!-- CTA -->
            <tr>
              <td align="center" style="padding:24px 32px 8px 32px;">
                <a href="${escapeHtml(leadUrl)}" style="display:inline-block;background-color:${BRAND.yellow};color:${BRAND.text};text-decoration:none;font-weight:600;font-size:15px;padding:14px 28px;border-radius:10px;">Ouvrir le lead dans l'app</a>
              </td>
            </tr>

            <!-- Lien brut -->
            <tr>
              <td style="padding:8px 32px 24px 32px;">
                <p style="margin:0;font-size:12px;line-height:1.6;color:${BRAND.textFaint};">Lien direct&nbsp;: <a href="${escapeHtml(leadUrl)}" style="color:${BRAND.yellowDark};text-decoration:underline;word-break:break-all;">${escapeHtml(leadUrl)}</a></p>
              </td>
            </tr>

            <!-- Footer avec métadonnées + magasin -->
            <tr>
              <td style="padding:16px 32px 28px 32px;border-top:1px solid ${BRAND.borderSoft};">
                <p style="margin:16px 0 0 0;font-size:12px;line-height:1.7;color:${BRAND.textHint};">
                  Reçu le ${escapeHtml(createdAt)}<br />
                  Magasin&nbsp;: <strong style="color:${BRAND.textMuted};">${escapeHtml(magasinName)}</strong>${gerantFull ? ` · ${escapeHtml(gerantFull)}` : ''}<br />
                  ID&nbsp;: ${escapeHtml(leadIdShort)}
                </p>
              </td>
            </tr>

          </table>
          <div style="max-width:640px;margin:16px auto 0 auto;text-align:center;font-size:12px;color:${BRAND.textHint};">
            Komilfo — Confort, efficacité, service.
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function buildText(
  lead: LeadRecord,
  magasin: MagasinInfo | null,
  produits: string[],
  leadUrl: string,
): string {
  const kindLabel = lead.type === 'sav' ? 'Nouvelle demande SAV' : 'Nouveau devis';
  const telDisplay = formatPhoneDisplay(lead.tel);
  const creneaux = (lead.contact_creneaux ?? [])
    .map((c) => CRENEAU_LABEL[c] ?? c)
    .join(', ') || '—';
  const magasinName = magasin?.name ?? 'Magasin à assigner';

  return [
    `Komilfo — ${magasinName}`,
    kindLabel,
    '',
    `Contact : ${lead.prenom} ${lead.nom}`,
    `Email : ${lead.email}`,
    `Téléphone : ${telDisplay}`,
    `Localisation : ${lead.ville} (${lead.code_postal})`,
    `Travaux : ${lead.travaux ? TRAVAUX_LABEL[lead.travaux] ?? lead.travaux : '—'}`,
    `Habitat : ${lead.habitat ? HABITAT_LABEL[lead.habitat] ?? lead.habitat : '—'}`,
    `Échéance : ${lead.echeance ? ECHEANCE_LABEL[lead.echeance] ?? lead.echeance : '—'}`,
    `Créneaux : ${creneaux}`,
    produits.length > 0 ? `Produits : ${produits.join(', ')}` : '',
    lead.message ? `\nMessage :\n${lead.message}` : '',
    '',
    `Voir le lead : ${leadUrl}`,
  ]
    .filter((s) => s !== '')
    .join('\n');
}

// ---------- Handler ----------

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

  const [magasinRes, emailsRes, produitsRes] = await Promise.all([
    supabase
      .from('magasins')
      .select('id, code, name, ville, gerant_nom, gerant_prenom')
      .eq('id', lead.magasin_id)
      .single(),
    supabase
      .from('magasin_emails')
      .select('email, role')
      .eq('magasin_id', lead.magasin_id)
      .eq('notify', true),
    // Produits demandés — via la join table lead_produits.
    supabase
      .from('lead_produits')
      .select('produit:produits(label, sort_order)')
      .eq('lead_id', lead.id),
  ]);

  if (magasinRes.error) {
    console.error('magasin fetch error', magasinRes.error);
    return json({ error: `magasin fetch: ${magasinRes.error.message}` }, 500);
  }
  if (emailsRes.error) {
    console.error('magasin_emails fetch error', emailsRes.error);
    return json({ error: `magasin_emails fetch: ${emailsRes.error.message}` }, 500);
  }
  if (produitsRes.error) {
    console.warn('produits fetch error (non-bloquant)', produitsRes.error);
  }

  const magasin = magasinRes.data;
  const gerantName = [magasin?.gerant_prenom, magasin?.gerant_nom]
    .filter(Boolean)
    .join(' ')
    .trim();

  const seen = new Set<string>();
  const recipients: Recipient[] = (emailsRes.data ?? [])
    .filter((r): r is { email: string; role: string } =>
      typeof r.email === 'string' && r.email.length > 0,
    )
    .filter((r) => {
      const key = r.email.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((r) => (gerantName ? { email: r.email, name: gerantName } : { email: r.email }));

  if (recipients.length === 0) {
    console.warn(`no recipients for magasin ${lead.magasin_id}`);
    await supabase.from('lead_activities').insert({
      lead_id: lead.id,
      type: 'email',
      title: 'Notification magasin ignorée',
      body: 'Aucun email actif rattaché au magasin',
      details: { reason: 'no_recipients', magasin_id: lead.magasin_id },
    });
    return json({ skipped: 'no recipients' });
  }

  const produitLabels: string[] = ((produitsRes.data ?? []) as Array<{ produit: { label: string; sort_order: number } | null }>)
    .map((r) => r.produit)
    .filter((p): p is { label: string; sort_order: number } => p != null && typeof p.label === 'string')
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((p) => p.label);

  const brevoKey = Deno.env.get('BREVO_API_KEY');
  if (!brevoKey) {
    console.error('BREVO_API_KEY missing');
    return json({ error: 'server misconfigured' }, 500);
  }

  const fromEmail = Deno.env.get('MAIL_FROM_EMAIL') ?? 'no-reply@komilfo.fr';
  const fromName = Deno.env.get('MAIL_FROM_NAME') ?? 'Komilfo';
  const appBaseUrl = (Deno.env.get('APP_BASE_URL') ?? 'http://localhost:3000').replace(/\/+$/, '');
  const leadUrl = `${appBaseUrl}/list?lead=${lead.id}`;

  const magasinInfo: MagasinInfo = {
    name: magasin?.name ?? null,
    code: magasin?.code ?? null,
    gerant_nom: magasin?.gerant_nom ?? null,
    gerant_prenom: magasin?.gerant_prenom ?? null,
  };

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
      htmlContent: buildHtml(lead, magasinInfo, produitLabels, leadUrl),
      textContent: buildText(lead, magasinInfo, produitLabels, leadUrl),
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
    body: `${recipients.length} destinataire(s) — ${magasin?.name ?? 'magasin'}`,
    details: {
      magasin_id: lead.magasin_id,
      message_id: brevoData.messageId,
      recipients: recipients.map((r) => r.email),
    },
  });

  return json({ sent: recipients.length, message_id: brevoData.messageId });
});
