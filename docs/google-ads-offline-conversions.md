# Google Ads — Conversions offline

Au passage d'un lead en `won`, le BO uploade automatiquement une **click conversion** vers Google Ads (GCLID + enhanced conversions PII hashées). Permet à Smart Bidding d'optimiser sur des conversions réelles plutôt que sur les form-submits.

## Architecture

```
Form Webflow (capture gclid/email/tel)
        │
        ▼
Edge Function submit-lead  ─►  table public.leads (gclid persisté)
        │
        ▼
BO (kanban/liste) — passage status = 'won'
        │
        ▼
useLeadsRealtime.updateStatus()
        │  fire-and-forget
        ▼
POST /api/admin/leads/[id]/google-ads-conversion
        │
        ▼
src/lib/googleAds/uploadConversion.ts
        │
        ▼
Google Ads API v18 — uploadClickConversions
        │
        ▼
Log dans public.google_ads_conversion_logs
```

## Variables d'environnement (Coolify prod + .env.local dev)

```bash
# Token Google Ads développeur (Tools → API Center)
GOOGLE_ADS_DEVELOPER_TOKEN=...

# Client OAuth créé dans Google Cloud Console (Desktop app)
GOOGLE_ADS_OAUTH_CLIENT_ID=...
GOOGLE_ADS_OAUTH_CLIENT_SECRET=...

# Refresh token généré une fois pour le compte qui a accès au compte Google Ads
# Procédure : https://developers.google.com/google-ads/api/docs/oauth/cloud-project
GOOGLE_ADS_REFRESH_TOKEN=...
```

Le `customer_id`, `login_customer_id`, `conversion_action_id` et la valeur par défaut sont configurés via le BO (`/parametres/google-ads`).

## Capture côté formulaire Webflow

Sur la LP, ajouter un script qui :

1. Lit `?gclid=`, `?gbraid=`, `?wbraid=` dans l'URL.
2. Persiste dans un cookie 1st party `_ko_gclid` (TTL 90 jours).
3. Lit le cookie au submit et l'inclut dans le POST vers l'edge function.

```html
<script>
(function () {
  var params = new URLSearchParams(window.location.search);
  var keys = ['gclid', 'gbraid', 'wbraid'];
  keys.forEach(function (k) {
    var v = params.get(k);
    if (!v) return;
    var maxAge = 60 * 60 * 24 * 90; // 90 jours
    document.cookie =
      '_ko_' + k + '=' + encodeURIComponent(v) +
      '; max-age=' + maxAge +
      '; path=/; samesite=lax';
  });
})();

function readKoCookie(name) {
  var match = document.cookie.match(
    new RegExp('(?:^|; )_ko_' + name + '=([^;]+)')
  );
  return match ? decodeURIComponent(match[1]) : null;
}

// Au submit du form, ajouter au payload :
//   gclid: readKoCookie('gclid'),
//   gbraid: readKoCookie('gbraid'),
//   wbraid: readKoCookie('wbraid'),
</script>
```

## Migration BDD

Migration : `supabase/migrations/20260429_google_ads_offline_conversions.sql`

Ajoute :
- `leads.gclid`, `leads.gbraid`, `leads.wbraid`, `leads.lead_value`, `leads.currency`
- Table `public.google_ads_settings` (singleton id=1)
- Table `public.google_ads_conversion_logs` (audit trail)
- RLS admin only sur les deux tables

À appliquer via :
```bash
supabase db push
```

⚠️ **Vérifier la vue `leads_full`** : si elle n'est pas en `select l.* from leads l`, la recréer pour exposer les nouvelles colonnes.

## Tester l'intégration

1. Configurer les env vars (refresh token Google Ads obtenu une fois).
2. Configurer `/parametres/google-ads` : customer_id + conversion_action_id, activer.
3. Insérer un lead test avec un gclid bidon (`update leads set gclid = 'test_123' where id = '...';`).
4. Le passer en "Gagné" depuis le BO.
5. Vérifier dans `/parametres/google-ads` (section "Derniers envois") le statut.
6. Vérifier `google_ads_conversion_logs` pour le détail request/response.

## Doc Google

- [REST UploadClickConversionsRequest](https://developers.google.com/google-ads/api/rest/reference/rest/v18/customers/uploadClickConversions)
- [Enhanced conversions for leads](https://support.google.com/google-ads/answer/13262500)
- [GCLID lifetime: 90 jours](https://support.google.com/google-ads/answer/9888656)
