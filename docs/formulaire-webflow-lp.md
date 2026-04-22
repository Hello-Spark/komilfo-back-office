# Formulaire LP Webflow — soumission des leads vers Supabase

## Vue d'ensemble

Une landing page hébergée sur **Webflow** embarque un formulaire HTML/JS en dur (code custom dans un bloc `Embed`). À la soumission, le formulaire POST un JSON vers une **Edge Function Supabase** (`submit-lead`) qui :

1. Vérifie un token **Cloudflare Turnstile** côté serveur (anti-bot),
2. Valide et sanitize le payload,
3. Mappe les valeurs affichées (ex : « Dans les 3 mois ») vers les enums DB (ex : `dans_3_mois`),
4. Insère la ligne dans `public.leads` avec la clé `service_role` (et les produits dans `public.lead_produits`).

La suite se passe **exclusivement côté base**, sans aucun code à maintenir côté Webflow :

- Un trigger `BEFORE INSERT` résout `magasin_id` depuis `code_postal` — cf. [routage-cp-magasins.md](./routage-cp-magasins.md).
- Un trigger `AFTER INSERT` appelle (via `pg_net`) l'Edge Function `notify-new-lead`, qui envoie un email Brevo aux utilisateurs actifs du magasin — cf. [notification-nouveau-lead.md](./notification-nouveau-lead.md).

### Schéma du flux

```
Webflow LP (embed HTML/JS + widget Turnstile)
        │  POST application/json  (fetch)
        ▼
Edge Function submit-lead
  1. CORS : vérifie Origin ∈ ALLOWED_ORIGINS
  2. Turnstile : POST siteverify (Cloudflare)
  3. Validate / sanitize / map enums
  4. INSERT public.leads (service_role)
        │
        ├─▶ BEFORE INSERT trigger : résout magasin_id via cp_magasins
        │      (échec propre si CP inconnu → 422 côté client)
        │
        └─▶ AFTER INSERT trigger : pg_net → notify-new-lead
                                   → Brevo → lead_activities(type=email)
        ▼
  5. INSERT public.lead_produits (join table) si produits sélectionnés
        ▼
  6. Réponse { ok: true, lead_id, magasin_id }
```

### Pourquoi Edge Function et pas insert direct depuis le navigateur

Trois raisons structurantes :

- **Sécurité** : la clé `anon` visible dans le JS public permettrait de spammer des inserts. Un captcha côté client sans validation serveur se bypasse. La vérification Turnstile doit être **server-side**, donc dans une Edge Function.
- **RGPD** : chaque spam = une ligne de PII (email/téléphone potentiellement de tiers) stockée sans base légale + un email parasite envoyé au magasin. Bloquer les bots en amont est un vrai devoir de protection des données, pas une optimisation.
- **Évolutivité** : on centralise validation, mapping, enrichissement, logs. Pas de logique à dupliquer côté Webflow quand les règles changent.

L'envoi email reste **découplé** dans un trigger `pg_net` → Edge Function `notify-new-lead` dédiée : si Brevo est down, le lead est quand même sauvegardé.

---

## Pré-requis

| Composant | Statut | Référence |
|---|---|---|
| Table `public.leads` + RLS + triggers | ✅ déjà en place | — |
| Notification email (`notify-new-lead`) | ✅ déjà en place | [notification-nouveau-lead.md](./notification-nouveau-lead.md) |
| Routage CP → magasin (`cp_magasins` + trigger `BEFORE INSERT`) | ⚠️ à faire | [routage-cp-magasins.md](./routage-cp-magasins.md) |
| Compte Cloudflare Turnstile (site key + secret key) | ⚠️ à faire | [Dashboard Turnstile](https://dash.cloudflare.com/?to=/:account/turnstile) |

Sans le routage CP → magasin, les leads s'insèrent avec `magasin_id = NULL` et l'email de notification est skippé (cf. [notification-nouveau-lead.md](./notification-nouveau-lead.md) — « Comportements & cas limites »). Le formulaire fonctionne quand même, mais les leads doivent être routés manuellement.

---

## Fichiers

- `supabase/functions/submit-lead/index.ts` — Edge Function publique (Deno).
- Embed HTML/JS à coller dans un bloc Webflow — cf. [Section 5](#5-code-dembed-webflow).

---

## 1. Contrat du formulaire (payload JSON)

L'Edge Function accepte un `POST application/json` avec le schéma suivant.

### Champs obligatoires

| Champ | Type | Contrainte | Commentaire |
|---|---|---|---|
| `nom` | `string` | non vide, ≤ 255 car. | |
| `prenom` | `string` | non vide, ≤ 255 car. | |
| `email` | `string` | format email | trim + lowercase côté serveur |
| `tel` | `string` | non vide | pas de normalisation stricte, stockée telle quelle |
| `code_postal` | `string` | `^[0-9]{5}$` | rejet `invalid_code_postal` sinon |
| `ville` | `string` | non vide | |
| `optin` | `boolean` | **doit valoir `true`** | sinon `optin_required` (et CHECK DB refusera de toute façon) |
| `optin_text` | `string` | non vide, ≤ 1000 car. | **Texte RGPD exact affiché sur la LP au moment de la soumission** — critique pour la traçabilité du consentement |
| `turnstile_token` | `string` | non vide | token retourné par le widget Turnstile |

### Champs optionnels

| Champ | Type | Valeurs acceptées | Enum DB cible |
|---|---|---|---|
| `type` | `string` | `"Devis"`, `"devis"`, `"SAV"`, `"sav"` (défaut : `devis`) | `lead_type` |
| `produits` | `string[]` | valeurs exactes de `produits.form_value` (ex : `"Pergola"`, `"Fenêtre / Baie Vitrée"`) | join table `lead_produits` |
| `echeance` | `string` | `"Dans les 3 mois"`, `"Dans l'année"`, `"Pas de date fixée"` (ou les formes snake_case) | `lead_echeance` |
| `travaux` | `string` | `"Neuf"`, `"Rénovation"` | `lead_travaux` |
| `habitat` | `string` | `"Maison"`, `"Appartement"`, `"Autres"` | `lead_habitat` |
| `contact_creneaux` | `string[]` | `"Matin"`, `"Après-midi"`, `"Soirée"` | `lead_creneau[]` |
| `message` | `string` | ≤ 2000 car. | `leads.message` |
| `src` | `string` | libre | attribution marketing |
| `campaign` | `string` | libre | attribution marketing |
| `location_host` | `string` | ex : `lp.komilfo.fr` | debug / attribution |
| `location_href` | `string` | URL complète avec UTM | debug / attribution |

### Champs posés automatiquement par l'Edge Function

- `user_agent` : lu depuis le header HTTP `User-Agent` (tronqué 500 car.).
- `ip_address` : lu depuis `cf-connecting-ip` puis `x-forwarded-for` (stockée en `inet`).
- `optin_at` : `now()` au moment de l'insert.
- `metadata.source` : `"webflow_lp"`.

### Réponses

| Code | Body | Quand |
|---|---|---|
| `201` | `{ ok: true, lead_id, magasin_id }` | Lead créé. `magasin_id` peut être `null` si le routage n'est pas encore en place. |
| `400` | `{ error: "invalid_json" }` | JSON illisible |
| `400` | `{ error: "optin_required" }` | Consentement non coché |
| `400` | `{ error: "captcha_missing" }` | Pas de `turnstile_token` |
| `400` | `{ error: "missing_fields", fields: [...] }` | Un champ obligatoire manque |
| `400` | `{ error: "invalid_email" }` | Email malformé |
| `400` | `{ error: "invalid_code_postal" }` | CP hors format 5 chiffres |
| `403` | `{ error: "captcha_failed" }` | Token Turnstile rejeté par Cloudflare |
| `405` | `{ error: "method not allowed" }` | Méthode ≠ POST |
| `422` | `{ error: "unknown_code_postal" }` | CP absent de `cp_magasins` (si routage activé) |
| `500` | `{ error: "server_misconfigured" }` | Secrets manquants (voir section Déploiement) |
| `500` | `{ error: "lead_insert_failed" }` | Échec DB non anticipé (consulter les logs Edge) |

---

## 2. Règles métier

1. **Consentement obligatoire et tracé** : le front ne doit **jamais** envoyer `optin: true` si la case n'est pas cochée. `optin_text` doit contenir **exactement** le texte RGPD affiché à l'utilisateur — pas un libellé générique. Cela permet de prouver, si besoin, ce qu'il a accepté et quand.
2. **Consentement non falsifiable côté DB** : la colonne `leads.optin` a un `CHECK optin = true`. Même si un attaquant bypass le front, la DB refusera l'insert.
3. **Captcha non contournable** : le token Turnstile est vérifié côté serveur. Pas de « validation JS suffit ».
4. **Produits non référencés** : si le front envoie un `produit` absent de la table `produits`, il est silencieusement ignoré mais **loggé** dans `lead_activities` (type `note`, titre « Produits non référencés ignorés ») pour que l'admin sache qu'il faut enrichir la table.
5. **Idempotence** : l'Edge Function **n'est pas idempotente**. Un double-clic côté front peut créer deux leads. Le bouton submit doit être désactivé après le premier clic (exemple dans la section 5).
6. **Pas de fallback magasin** : si le CP est inconnu de `cp_magasins`, le trigger `RAISE EXCEPTION` et l'Edge Function renvoie `422`. **C'est voulu** (cf. `routage-cp-magasins.md`) : on préfère rejeter et compléter le mapping plutôt qu'accepter un lead orphelin.

---

## 3. Déploiement de l'Edge Function

### 3.1 Créer les clés Turnstile

1. Dashboard Cloudflare → **Turnstile → Add site**.
2. Hostname : le domaine Webflow (ex : `lp.komilfo.fr` + `www.komilfo.webflow.io` pour le preview).
3. Mode : **Managed** (recommandé, bascule invisible → défi uniquement en cas de suspicion).
4. Récupérer **Site Key** (publique, utilisée dans le JS de la LP) et **Secret Key** (privée, posée en secret Edge).

### 3.2 Poser les secrets de l'Edge Function

Via CLI à la racine du projet :

```bash
supabase secrets set \
  TURNSTILE_SECRET_KEY="0x4AAAAAAA...." \
  ALLOWED_ORIGINS="https://lp.komilfo.fr,https://www.komilfo.webflow.io"
```

Ou via le dashboard : **Project Settings → Edge Functions → Secrets**.

- `TURNSTILE_SECRET_KEY` : secret Cloudflare (jamais exposé au navigateur).
- `ALLOWED_ORIGINS` : **CSV** des origines autorisées en CORS. Inclure le domaine de preview Webflow (`*.webflow.io`) pendant le dev puis restreindre au domaine final en prod. `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont injectés automatiquement — ne pas les poser manuellement.

### 3.3 Déployer la fonction

```bash
supabase functions deploy submit-lead --no-verify-jwt
```

`--no-verify-jwt` est **indispensable** : la fonction est publique (appelée depuis le navigateur sans Authorization header). La protection anti-abus est assurée par Turnstile + CORS + CHECK DB, pas par un JWT.

### 3.4 Récupérer l'URL publique

```
https://<project-ref>.supabase.co/functions/v1/submit-lead
```

C'est l'URL à hardcoder dans le JS Webflow.

---

## 4. CORS

L'Edge Function lit l'env var `ALLOWED_ORIGINS` (CSV) et renvoie `Access-Control-Allow-Origin` uniquement pour les origines listées. Un preflight `OPTIONS` est répondu en `204` avec les bons headers. En cas d'origin non autorisée, le navigateur bloque l'appel côté front (le serveur répond avec un `Allow-Origin` qui ne match pas).

**En prod** : ne laisser que le domaine final. Ne pas utiliser `*` — cela rendrait la fonction appelable depuis n'importe quel site.

---

## 5. Code d'embed Webflow

À coller dans un **Embed HTML** Webflow (block `</> Embed`). Remplacer les placeholders `<TURNSTILE_SITE_KEY>` et `<PROJECT_REF>`.

```html
<form id="lp-lead-form" novalidate>
  <label>Prénom *
    <input name="prenom" type="text" required autocomplete="given-name" />
  </label>
  <label>Nom *
    <input name="nom" type="text" required autocomplete="family-name" />
  </label>
  <label>Email *
    <input name="email" type="email" required autocomplete="email" />
  </label>
  <label>Téléphone *
    <input name="tel" type="tel" required autocomplete="tel" inputmode="tel" />
  </label>
  <label>Code postal *
    <input name="code_postal" type="text" required pattern="[0-9]{5}" inputmode="numeric" maxlength="5" />
  </label>
  <label>Ville *
    <input name="ville" type="text" required />
  </label>
  <label>Votre projet
    <textarea name="message" maxlength="2000" rows="4"></textarea>
  </label>

  <label class="consent">
    <input name="optin" type="checkbox" required />
    <span>
      J'accepte que ces données soient utilisées pour traiter ma demande.
      Responsable : KOMILFO SAS — rgpd@komilfo.fr.
      <a href="https://www.komilfo.fr/politique-protection-donnees-confidentialite" target="_blank" rel="noopener">Politique de confidentialité</a>.
    </span>
  </label>

  <!-- Widget Turnstile : rendu invisible en mode "managed" sauf suspicion -->
  <div class="cf-turnstile" data-sitekey="<TURNSTILE_SITE_KEY>"></div>

  <button type="submit">Demander un devis</button>
  <p id="lp-lead-feedback" role="status" aria-live="polite"></p>
</form>

<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>

<script>
(function () {
  var ENDPOINT = 'https://<PROJECT_REF>.supabase.co/functions/v1/submit-lead';
  var form = document.getElementById('lp-lead-form');
  var feedback = document.getElementById('lp-lead-feedback');
  var submitBtn = form.querySelector('button[type="submit"]');

  // Doit être rigoureusement identique au texte affiché dans le <label> ci-dessus.
  // Un écart = trace RGPD invalide (on ne pourra pas prouver ce que le user a accepté).
  var OPTIN_TEXT =
    "J'accepte que ces données soient utilisées pour traiter ma demande. " +
    "Responsable : KOMILFO SAS — rgpd@komilfo.fr. " +
    "Politique : https://www.komilfo.fr/politique-protection-donnees-confidentialite";

  function getUtm() {
    var params = new URLSearchParams(window.location.search);
    return {
      src: params.get('utm_source') || 'direct',
      campaign: params.get('utm_campaign') || '',
    };
  }

  function setFeedback(msg, ok) {
    feedback.textContent = msg;
    feedback.style.color = ok ? '#047857' : '#b91c1c';
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    setFeedback('', true);

    var token = (window.turnstile && window.turnstile.getResponse()) || '';
    if (!token) {
      setFeedback('Merci de valider le contrôle anti-robot.', false);
      return;
    }

    var fd = new FormData(form);
    var utm = getUtm();
    var payload = {
      turnstile_token: token,
      type: 'devis',
      nom: fd.get('nom'),
      prenom: fd.get('prenom'),
      email: fd.get('email'),
      tel: fd.get('tel'),
      code_postal: fd.get('code_postal'),
      ville: fd.get('ville'),
      message: fd.get('message') || '',
      optin: fd.get('optin') === 'on',
      optin_text: OPTIN_TEXT,
      src: utm.src,
      campaign: utm.campaign,
      location_host: window.location.host,
      location_href: window.location.href,
    };

    submitBtn.disabled = true;
    try {
      var res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      var data = await res.json().catch(function () { return {}; });

      if (res.status === 201 && data.ok) {
        setFeedback('Merci, nous revenons vers vous très vite.', true);
        form.reset();
        if (window.turnstile) window.turnstile.reset();
        // Optionnel : redirection vers une page "merci"
        // window.location.href = '/merci';
        return;
      }

      if (data.error === 'unknown_code_postal') {
        setFeedback("Nous n'intervenons pas encore sur ce code postal.", false);
      } else if (data.error === 'invalid_email') {
        setFeedback('Adresse email invalide.', false);
      } else if (data.error === 'invalid_code_postal') {
        setFeedback('Code postal invalide (5 chiffres attendus).', false);
      } else if (data.error === 'captcha_failed' || data.error === 'captcha_missing') {
        setFeedback('Contrôle anti-robot échoué. Rechargez la page et réessayez.', false);
      } else if (data.error === 'missing_fields') {
        setFeedback('Champs manquants : ' + (data.fields || []).join(', '), false);
      } else {
        setFeedback('Une erreur est survenue. Merci de réessayer plus tard.', false);
      }
      if (window.turnstile) window.turnstile.reset();
    } catch (err) {
      setFeedback('Connexion impossible. Vérifiez votre réseau.', false);
      if (window.turnstile) window.turnstile.reset();
    } finally {
      submitBtn.disabled = false;
    }
  });
})();
</script>
```

**Points à ne pas oublier côté Webflow :**

- Placer le CSS dans l'onglet `Custom Code` du projet pour garder une base cohérente.
- Dans les settings de la page Webflow, ajouter un meta `referrer` si on veut préserver les UTM entrants (sinon valeur par défaut OK dans la plupart des cas).
- Tester en mode preview **ET** sur le domaine publié : Webflow sert sur `*.webflow.io` en preview, il faut inclure cette origine dans `ALLOWED_ORIGINS` pendant le QA.

---

## 6. RGPD — checklist

| Exigence | Où c'est géré |
|---|---|
| Recueil du consentement explicite (case décochée par défaut) | Form Webflow, `<input type="checkbox" required>` |
| Traçabilité du texte accepté | `leads.optin_text` + `leads.optin_at` (posés par l'Edge Function) |
| Politique de confidentialité accessible avant soumission | Lien dans le label `optin` |
| Responsable du traitement identifié | Texte du label `optin` (KOMILFO SAS + rgpd@komilfo.fr) |
| Finalité explicite | Texte du label `optin` (« traiter ma demande ») |
| Minimisation des données | Seuls les champs nécessaires à la prise de contact + qualification |
| Protection anti-injection de PII tierce (spam) | Turnstile + CORS + CHECK DB |
| Hébergement EU | Projet Supabase en région EU, Brevo en région EU |
| Droit à l'effacement | Procédure manuelle : `DELETE FROM leads WHERE email = ?` (réalisable via le back-office ou SQL Editor) |
| Registre des traitements | À maintenir côté KOMILFO SAS (mention : Supabase + Brevo + Cloudflare Turnstile) |

**Attention** : `optin_text` doit **absolument** reprendre le texte affiché à l'utilisateur. Si le texte du label change dans Webflow, il faut mettre à jour la constante `OPTIN_TEXT` dans le script — sinon la trace stockée ne correspond plus à ce qui a été vu.

---

## 7. Test & debug

### 7.1 Test manuel via `curl`

Générer un token Turnstile de test (Cloudflare en fournit : clé publique `1x00000000000000000000AA` + secret `1x0000000000000000000000000000000AA` → toujours `success: true`). À poser temporairement comme `TURNSTILE_SECRET_KEY` puis :

```bash
curl -X POST https://<project-ref>.supabase.co/functions/v1/submit-lead \
  -H "Content-Type: application/json" \
  -H "Origin: https://lp.komilfo.fr" \
  -d '{
    "turnstile_token": "XXXX.DUMMY.TOKEN.XXXX",
    "nom": "Dupont",
    "prenom": "Jean",
    "email": "jean.dupont@example.com",
    "tel": "0601020304",
    "code_postal": "69003",
    "ville": "Lyon",
    "optin": true,
    "optin_text": "J'accepte...",
    "message": "Test LP Webflow",
    "src": "test",
    "campaign": "manual"
  }'
```

Réponse attendue : `201 { "ok": true, "lead_id": "...", "magasin_id": "..." }`.

### 7.2 Suivre la chaîne complète

```sql
-- 1. Le lead est bien créé + magasin_id résolu
select id, nom, prenom, email, code_postal, magasin_id, created_at, metadata
from public.leads
order by created_at desc
limit 5;

-- 2. Les produits sont bien rattachés (si fournis)
select lp.*, p.form_value
from public.lead_produits lp
join public.produits p on p.id = lp.produit_id
where lp.lead_id = '<lead-id>';

-- 3. L'appel pg_net vers notify-new-lead a bien été fait
select id, created, status_code, error_msg
from net._http_response
order by created desc
limit 10;

-- 4. L'email a bien été envoyé (ou skippé avec une raison)
select type, title, body, details, created_at
from public.lead_activities
where lead_id = '<lead-id>'
order by created_at desc;
```

### 7.3 Logs de l'Edge Function

Dashboard Supabase → **Edge Functions → submit-lead → Logs**. Filtrer sur `ERROR` pour repérer les `TURNSTILE_SECRET_KEY is not configured`, les échecs d'insert, etc.

---

## 8. Cas limites & comportements

| Situation | Comportement |
|---|---|
| Double-clic sur le bouton submit | Le JS désactive le bouton pendant l'appel, mais si le réseau est lent et que l'utilisateur rafraîchit la page avant la réponse, deux leads peuvent être créés. À dédoublonner manuellement (email + créé < 1 min). |
| CP absent de `cp_magasins` | `422 unknown_code_postal`. Le formulaire affiche « Nous n'intervenons pas encore sur ce code postal ». À compléter dans `cp_magasins`. |
| Token Turnstile expiré (widget > 5 min sans interaction) | `403 captcha_failed`. Le JS appelle `turnstile.reset()` pour régénérer un token — l'utilisateur peut re-soumettre. |
| Bot qui POST directement sans passer par Webflow | Rejeté au niveau CORS (origin non autorisée) **et** Turnstile (pas de token valide). Même si un bot forge une origine, il ne peut pas forger un token Turnstile. |
| Brevo down | Le lead est créé, l'email échoue, `lead_activities` log `Notification magasin échouée`. À retraiter (cf. évolutions dans `notification-nouveau-lead.md`). |
| `ALLOWED_ORIGINS` non posé | Aucune origin n'est reconnue, le navigateur bloque toutes les requêtes. Symptôme : erreurs CORS en console dev. |
| `TURNSTILE_SECRET_KEY` non posé | Toutes les soumissions retournent `403 captcha_failed` (log `TURNSTILE_SECRET_KEY is not configured`). |

---

## 9. Évolutions possibles

- **Rate limiting par IP** : ajouter `@supabase/ratelimit` ou une table `submit_lead_attempts` pour bloquer > N POST / minute depuis la même IP. Turnstile bloque déjà 99% des bots mais une vraie carte bancaire volée + tentatives de spam est un scénario à prévoir si la LP prend de l'ampleur.
- **Double opt-in email** : envoyer un lien de confirmation au prospect avant de marquer le lead comme `qualified`. Pertinent surtout si on fait de la newsletter post-lead ; pour un simple formulaire de contact, l'opt-in simple suffit légalement.
- **Pré-remplissage magasin** : si la LP a une variante « magasin X » (URL `/lyon-3`), passer un param `?magasin=komilfo-lyon-3` et l'intégrer au payload pour court-circuiter le routage CP. Nécessite une route de résolution dédiée côté Edge Function.
- **Enrichissement temps-réel** : après insert, appeler une API externe (Clearbit, Pappers, etc.) pour qualifier l'entreprise du prospect si le champ existe. À faire dans un trigger séparé pour garder `submit-lead` rapide.
