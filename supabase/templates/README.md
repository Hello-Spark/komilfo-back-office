# Templates emails Komilfo — Supabase Auth

Templates HTML aux couleurs Komilfo pour tous les emails transactionnels envoyés par Supabase Auth.

## Fichiers

| Fichier | Template Supabase | Déclenché quand |
|---|---|---|
| `confirm.html` | Confirm signup | L'utilisateur crée un compte |
| `invite.html` | Invite user | Un admin invite un utilisateur |
| `magic_link.html` | Magic Link | Connexion via lien |
| `recovery.html` | Reset Password | Mot de passe oublié |
| `email_change.html` | Change Email Address | Changement d'email |
| `reauthentication.html` | Reauthentication | Code OTP (MFA / reauth sensible) |

## Comment appliquer

### Option 1 — Dashboard (le plus simple)

1. Ouvrir [Authentication → Emails → Templates](https://supabase.com/dashboard/project/otoffzpjlkyefwxxtwdn/auth/templates)
2. Pour chaque template : copier-coller le HTML du fichier correspondant
3. Ajuster le **Subject** selon :
   - Confirm signup : `Confirmez votre compte Komilfo`
   - Invite user : `Invitation à rejoindre Komilfo CRM`
   - Magic Link : `Votre lien de connexion Komilfo`
   - Reset Password : `Réinitialisation de votre mot de passe Komilfo`
   - Change Email : `Confirmez votre nouvelle adresse email Komilfo`
   - Reauthentication : `Votre code de vérification Komilfo`

### Option 2 — Via `supabase/config.toml` (CLI)

Si le projet utilise la CLI Supabase, ajouter dans `supabase/config.toml` :

```toml
[auth.email.template.confirmation]
subject = "Confirmez votre compte Komilfo"
content_path = "./supabase/templates/confirm.html"

[auth.email.template.invite]
subject = "Invitation à rejoindre Komilfo CRM"
content_path = "./supabase/templates/invite.html"

[auth.email.template.magic_link]
subject = "Votre lien de connexion Komilfo"
content_path = "./supabase/templates/magic_link.html"

[auth.email.template.recovery]
subject = "Réinitialisation de votre mot de passe Komilfo"
content_path = "./supabase/templates/recovery.html"

[auth.email.template.email_change]
subject = "Confirmez votre nouvelle adresse email Komilfo"
content_path = "./supabase/templates/email_change.html"

[auth.email.template.reauthentication]
subject = "Votre code de vérification Komilfo"
content_path = "./supabase/templates/reauthentication.html"
```

Puis `supabase db push` ou `supabase config push`.

## Variables disponibles

- `{{ .ConfirmationURL }}` — lien d'action (tous sauf reauthentication)
- `{{ .Token }}` — code OTP 6 chiffres (reauthentication, magic_link si mode OTP)
- `{{ .SiteURL }}` — URL du site configuré
- `{{ .Email }}` — email destinataire
- `{{ .NewEmail }}` — nouvelle adresse (email_change uniquement)

## DA appliquée

- Jaune brand Komilfo : `#fdd626` (header + CTA)
- Texte titres : `#111827`
- Texte corps : `#4b5563`
- Fond page : `#f4f4f2`
- Lien : `#8a6d0a` (brand-800)
- Tagline footer : *Komilfo — Confort, efficacité, service.*

Tous les styles sont inline pour compatibilité maximale avec les clients mail (Outlook, Gmail, Apple Mail).
