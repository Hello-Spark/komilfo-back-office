# Routage automatique des leads par code postal

## Contexte

Le client Komilfo dispose d'un fichier CSV d'environ **30 000 lignes** associant un code postal à un magasin du réseau. Objectif : attribuer automatiquement un lead au bon magasin en fonction du CP saisi dans un formulaire.

Le formulaire sera à terme intégré sur le site **Drupal** du client, sous forme de code custom qui appellera directement l'API Supabase à la soumission.

## Architecture retenue

### Table de mapping

Une table dédiée `cp_magasins` :

```sql
create table public.cp_magasins (
  code_postal text primary key,
  magasin_id  uuid not null references public.magasins(id) on delete restrict
);
```

- 30k lignes : trivial pour Postgres, lookup O(1) via la PK.
- Import via l'UI Supabase (Table Editor → Import CSV) ou `COPY` en CLI.

### Trigger `BEFORE INSERT` sur `leads`

À la création d'un lead, le `magasin_id` est résolu côté base de données à partir du `code_postal` fourni. Le client (Drupal) n'a aucune logique de routage à maintenir.

## Comparaison des deux approches

Deux options étaient sur la table :

1. **Lookup côté client (Drupal)** : le code custom fait un `SELECT` sur `cp_magasins` puis un `INSERT` sur `leads` avec le `magasin_id` déjà résolu. → **2 appels réseau**.
2. **Trigger DB** : le code custom fait juste un `INSERT` avec le CP, Postgres remplit `magasin_id` automatiquement. → **1 appel réseau**.

### Vitesse

**Trigger gagne.** 1 aller-retour réseau au lieu de 2. Le lookup dans Postgres (PK index sur `code_postal`) prend quelques microsecondes, invisible face aux ~50-150 ms de latence réseau d'un second appel depuis Drupal.

### Performance

**Trigger gagne.** Moins de charge réseau, moins de connexions ouvertes, logique exécutée là où vivent les données. 30k lignes indexées, c'est anecdotique pour Postgres.

### Sécurité

**Trigger gagne largement.**

- **Côté client** : la clé `anon` utilisée par le formulaire doit avoir `SELECT` sur `cp_magasins` **et** `INSERT` sur `leads`. Comme la clé anon est visible dans le JS public :
  - n'importe qui peut aspirer le mapping CP→magasin (pas ultra sensible mais exposition inutile),
  - rien n'empêche un attaquant de forger un `INSERT` avec un `magasin_id` arbitraire. Il faut alors re-verrouiller via RLS ou CHECK côté serveur, ce qui duplique la logique.
- **Trigger** : la clé anon n'a besoin que d'`INSERT` sur `leads`. `cp_magasins` reste totalement fermée. Le `magasin_id` est décidé par la DB, impossible à forger ou bypasser côté client. **Source de vérité unique.**

### Maintenance

**Trigger gagne.** Quand un CP change de magasin (nouveau point de vente, redécoupage de zones), il suffit de modifier `cp_magasins`. Zéro déploiement Drupal, zéro coordination avec le site web.

## Tableau récapitulatif

| Critère         | Lookup côté client (Drupal) | Trigger DB     |
| --------------- | --------------------------- | -------------- |
| Appels réseau   | 2                           | 1              |
| Latence         | ~100-300 ms                 | ~50-150 ms     |
| Clé anon expose | `cp_magasins` + `leads`     | `leads` seul   |
| Bypass possible | Oui (forger `magasin_id`)   | Non            |
| Logique de routage | Dupliquée (Drupal + DB)  | DB uniquement  |
| Maintenance CP  | Déploiement Drupal requis   | `UPDATE` SQL   |

## Exception : affichage du magasin avant soumission

Si le formulaire doit afficher **avant soumission** le magasin attribué (ex: « votre demande sera traitée par Komilfo Lyon 3 »), alors :

- Lookup côté client **pour l'affichage uniquement**.
- Trigger DB **quand même** pour l'insert (défense en profondeur).

## Comportement si CP inconnu

Le CP étant un champ obligatoire du formulaire et le mapping étant censé couvrir l'ensemble du territoire, un CP absent de `cp_magasins` est considéré comme une **anomalie de données** (mapping incomplet), pas comme un cas nominal.

→ Le trigger **rejette l'insert** via `RAISE EXCEPTION`. Pas de lead orphelin silencieux, pas de `magasin_id` NULL à traiter a posteriori. Si l'erreur se produit, c'est `cp_magasins` qu'il faut compléter.

## Prochaines étapes

1. Créer la migration : table `cp_magasins` + index + RLS (lecture réservée authenticated/service_role).
2. Écrire la fonction trigger (avec `RAISE EXCEPTION` si CP inconnu) + policy d'`INSERT` anon sur `leads`.
3. Importer le CSV de 30k lignes.
4. Tester avec un CP connu et un CP inconnu (doit échouer proprement).
