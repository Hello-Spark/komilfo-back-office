# Notification email à chaque nouveau lead

## Vue d'ensemble

À chaque `INSERT` sur `public.leads`, un email est envoyé via **Brevo** à tous les utilisateurs actifs (`profiles.active = true`) rattachés au `magasin_id` du lead. Le template contient les infos clés du lead + un lien vers la fiche dans l'app.

## Architecture

```
Drupal form → INSERT public.leads
           → trigger on_lead_insert_notify_magasin
              → pg_net.http_post(Edge Function)
                 → notify-new-lead
                    → fetch magasins + profiles (service_role)
                    → Brevo API /v3/smtp/email
                    → INSERT lead_activities (type=email)
```

- Le trigger appelle l'Edge Function **en asynchrone** via `pg_net`. L'insert du lead n'est jamais bloqué par l'envoi email : si Brevo est lent ou down, le lead se crée quand même.
- L'Edge Function est authentifiée par un **shared secret** (header `x-webhook-secret`). `verify_jwt = false` car elle est appelée par la DB, pas par un user.
- Chaque envoi (succès ou échec) est loggé dans `lead_activities` avec `type = 'email'`.

## Fichiers

- `supabase/functions/notify-new-lead/index.ts` — Edge Function (Deno).
- `supabase/migrations/20260422_notify_new_lead_trigger.sql` — `pg_net` + fonction trigger + trigger `AFTER INSERT ON leads`.

## État actuel

Installé & branché sur le projet Supabase (`otoffzpjlkyefwxxtwdn`) le 2026-04-22 :

- ✅ Extension `pg_net` activée
- ✅ Trigger `on_lead_insert_notify_magasin` créé sur `public.leads`
- ✅ Fonction `handle_new_lead_notification` déployée (lit Vault)
- ✅ Edge Function `notify-new-lead` déployée (v1, `verify_jwt = false`)
- ✅ Secrets Vault posés : `notify_new_lead_edge_function_url`, `notify_new_lead_webhook_secret`
- ✅ Secrets Edge posés : `WEBHOOK_SECRET`, `MAIL_FROM_EMAIL=no-reply@komilfo.fr`, `MAIL_FROM_NAME=Komilfo`, `APP_BASE_URL=http://localhost:3000`
- ✅ Test bout-à-bout validé : trigger → pg_net → Edge Function → auth OK → fetch DB OK (HTTP 200)

## À faire plus tard (pour activer réellement l'envoi d'emails)

**Tant que les 3 points ci-dessous ne sont pas faits, les leads se créent normalement mais aucun email ne part (l'Edge Function retourne 500 sur le check `BREVO_API_KEY` manquante, aucun log parasite dans `lead_activities`).**

### 1. Récupérer une clé API Brevo

Brevo (ex-Sendinblue) → **SMTP & API → API Keys → Generate a new API key**. Copier la valeur (format `xkeysib-...`).

### 2. Authentifier le domaine expéditeur

Avant d'envoyer depuis `no-reply@komilfo.fr`, le domaine `komilfo.fr` doit être **authentifié SPF/DKIM** côté Brevo. Sans ça, les mails partent en spam ou sont rejetés par les serveurs destinataires.

- Brevo → **Senders, Domains & dedicated IPs → Domains → Add a domain**
- Renseigner `komilfo.fr`
- Copier les enregistrements DNS (SPF + DKIM) fournis par Brevo
- Les ajouter chez le registrar / hébergeur DNS de `komilfo.fr`
- Attendre la propagation (quelques minutes à quelques heures) puis cliquer **Authenticate** côté Brevo

### 3. Poser `BREVO_API_KEY` dans les secrets de l'Edge Function

Via le dashboard Supabase : **Project Settings → Edge Functions → Secrets → Add new secret** :
- Nom : `BREVO_API_KEY`
- Valeur : `xkeysib-...` (celle récupérée à l'étape 1)

Ou via CLI (à la racine du projet) :

```bash
supabase secrets set BREVO_API_KEY="xkeysib-..."
```

Aucun redéploiement nécessaire : les secrets sont rechargés automatiquement par le runtime des Edge Functions.

### 4. (Plus tard, en prod) Mettre à jour `APP_BASE_URL`

Actuellement `APP_BASE_URL=http://localhost:3000` (bon pour le dev). Quand l'app sera déployée, mettre à jour ce secret :

```bash
supabase secrets set APP_BASE_URL="https://app.komilfo.fr"  # URL réelle de prod
```

C'est cette URL qui est utilisée dans le bouton « Voir le lead » de l'email.

### 5. Valider avec un vrai envoi

Une fois les étapes 1-3 faites, tester avec `curl` :

```bash
curl -X POST \
  https://otoffzpjlkyefwxxtwdn.supabase.co/functions/v1/notify-new-lead \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: e3d5c1b63f4b09e46c775fd90f0b799d39533cf4d0f8eb3f971a2fdc0783fe19" \
  -d @- <<'JSON'
{
  "type": "INSERT", "table": "leads", "schema": "public", "old_record": null,
  "record": {
    "id": "<uuid-d-un-lead-existant-avec-profils-actifs>",
    "magasin_id": "<magasin-uuid-correspondant>",
    "type": "devis", "status": "new", "priority": "medium",
    "nom": "Dupont", "prenom": "Jean",
    "email": "test@example.com", "tel": "0601020304",
    "code_postal": "69003", "ville": "Lyon",
    "travaux": "volets_roulants", "habitat": "maison", "echeance": "3_mois",
    "message": "Test notification", "contact_creneaux": ["matin"],
    "created_at": "2026-04-22T10:00:00Z"
  }
}
JSON
```

Réponse attendue : `{"sent": N, "message_id": "<brevo-id>"}`. Vérifier que l'email arrive dans les boîtes des `profiles` actifs du magasin.

## Configuration initiale (référence — déjà faite)

### 1. Secrets de l'Edge Function

Via le dashboard Supabase : **Project Settings → Edge Functions → Secrets**. Ou via CLI :

```bash
supabase secrets set \
  BREVO_API_KEY="xkeysib-..." \
  MAIL_FROM_EMAIL="no-reply@komilfo.fr" \
  MAIL_FROM_NAME="Komilfo" \
  APP_BASE_URL="http://localhost:3000" \
  WEBHOOK_SECRET="<chaîne aléatoire ≥ 32 caractères>"
```

En prod, changer `APP_BASE_URL` vers l'URL déployée.

`SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont injectés automatiquement par le runtime.

### 2. Secrets côté base (Supabase Vault)

Le trigger lit l'URL de l'Edge Function et le shared secret depuis **Supabase Vault** (pas depuis `ALTER DATABASE`, refusé au rôle `postgres` côté projet Supabase). Créer/mettre à jour les deux secrets dans le **SQL Editor** :

```sql
do $$
declare
  v_id uuid;
begin
  select id into v_id from vault.secrets where name = 'notify_new_lead_edge_function_url';
  if v_id is null then
    perform vault.create_secret(
      'https://<project-ref>.supabase.co/functions/v1/notify-new-lead',
      'notify_new_lead_edge_function_url',
      'URL de l''Edge Function notify-new-lead appelée depuis le trigger pg_net'
    );
  else
    perform vault.update_secret(v_id, 'https://<project-ref>.supabase.co/functions/v1/notify-new-lead');
  end if;

  select id into v_id from vault.secrets where name = 'notify_new_lead_webhook_secret';
  if v_id is null then
    perform vault.create_secret(
      '<même valeur que WEBHOOK_SECRET>',
      'notify_new_lead_webhook_secret',
      'Shared secret aligné avec WEBHOOK_SECRET de l''Edge Function notify-new-lead'
    );
  else
    perform vault.update_secret(v_id, '<même valeur que WEBHOOK_SECRET>');
  end if;
end $$;
```

Vérifier :

```sql
select name, description, updated_at from vault.secrets where name like 'notify_new_lead_%';
```

Tant que les deux secrets ne sont pas présents, le trigger émet un `RAISE WARNING` et skippe. L'insert du lead reste fonctionnel.

## Debug & observabilité

### Test bout en bout (trigger DB)

1. Insérer un lead valide (via le formulaire Drupal de staging, l'app, ou `INSERT` SQL direct).
2. Vérifier la log `lead_activities` :

```sql
select type, title, body, details, created_at
from public.lead_activities
where lead_id = '<nouveau-lead-id>'
order by created_at desc;
```

3. Inspecter les appels `pg_net` récents si besoin :

```sql
select id, created, status_code, error_msg
from net._http_response
order by created desc
limit 20;
```

4. Logs de l'Edge Function : dashboard Supabase → Edge Functions → `notify-new-lead` → Logs.

## Comportements & cas limites

| Situation                                              | Comportement                                                                 |
| ------------------------------------------------------ | ---------------------------------------------------------------------------- |
| `magasin_id` NULL (ne devrait pas arriver — cf. routage CP) | Edge Function répond `{skipped}`, rien n'est envoyé, pas d'activité loggée.  |
| Aucun `profiles` actif rattaché au magasin             | Activité `Notification magasin ignorée` loggée. Pas d'email.                 |
| Brevo renvoie une erreur (4xx/5xx)                     | Activité `Notification magasin échouée` loggée avec le détail. Pas de retry. |
| Secrets Vault manquants (`notify_new_lead_edge_function_url` / `notify_new_lead_webhook_secret`) | `RAISE WARNING`, trigger n'appelle pas l'Edge Function. L'insert du lead passe. |
| Edge Function down                                     | `pg_net` tente l'appel, échec enregistré dans `net._http_response`. Pas d'impact sur le lead. |

## Évolutions envisageables

- **Retry** : `pg_net` ne retry pas nativement. Si un envoi échoue, on peut :
  - Programmer un `pg_cron` qui scanne les leads sans `lead_activity` de type `email` dans les 10 dernières minutes et relance.
  - Ou passer par une queue (`pgmq`) + worker dédié.
- **Templates Brevo** : remplacer le HTML inline par un `templateId` Brevo + `params` pour permettre à l'équipe marketing de faire évoluer le design sans déploiement.
- **Multi-destinataires** : si on veut que chaque utilisateur reçoive un email personnalisé (et non un envoi commun), utiliser `messageVersions` côté Brevo.
