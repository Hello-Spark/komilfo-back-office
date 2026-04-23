-- =============================================================================
-- Seed : import des magasins + emails depuis le CSV client
-- =============================================================================
--
-- Source : supabase/seeds/magasins_import.csv (124 lignes + header).
-- Pré-requis : migrations 20260423_magasins_enrich.sql + 20260423_magasin_emails.sql
-- appliquées.
--
-- Étape 1 — Créer la table staging :
-- Exécuter ce script une fois pour créer la structure. Idempotent.
--
-- Étape 2 — Importer le CSV dans la staging :
-- Deux options au choix :
--
--   A) Dashboard Supabase → Table Editor → staging_magasins → Import data
--      from CSV → uploader magasins_import.csv.
--
--   B) CLI psql :
--      \copy staging_magasins from 'supabase/seeds/magasins_import.csv' \
--           with (format csv, header true, null '');
--
-- Étape 3 — Lancer la partie « normalise » ci-dessous : merge dans magasins
-- et magasin_emails. Idempotente : rejoue possible sans doublon.
-- =============================================================================

-- Étape 1 : staging
create table if not exists public.staging_magasins (
  external_id integer,
  point_de_vente text,
  groupe_magasins text,
  ville text,
  nom text,
  prenom text,
  mail_principal text,
  mail_adherent text,
  mail_supplementaire_1 text,
  mail_supplementaire_2 text,
  telephone_magasin text,
  telephone_adherent text
);

truncate table public.staging_magasins;

-- =============================================================================
-- >>> STOP ICI. Importer le CSV (étape 2) puis relancer le script après
-- =============================================================================

-- Étape 3a : upsert magasins depuis staging
insert into public.magasins (
  external_id,
  code,
  name,
  ville,
  groupe,
  gerant_nom,
  gerant_prenom,
  telephone_magasin,
  telephone_adherent,
  active
)
select
  s.external_id,
  'KMF-' || lpad(s.external_id::text, 4, '0'),  -- code interne dérivé de l'external_id
  btrim(s.point_de_vente),
  nullif(btrim(s.ville), ''),
  nullif(btrim(s.groupe_magasins), ''),
  nullif(btrim(s.nom), ''),
  nullif(btrim(s.prenom), ''),
  nullif(btrim(s.telephone_magasin), ''),
  nullif(btrim(s.telephone_adherent), ''),
  true
from public.staging_magasins s
where s.external_id is not null
  and btrim(coalesce(s.point_de_vente, '')) <> ''
on conflict (external_id)
  where external_id is not null
do update set
  name = excluded.name,
  ville = excluded.ville,
  groupe = excluded.groupe,
  gerant_nom = excluded.gerant_nom,
  gerant_prenom = excluded.gerant_prenom,
  telephone_magasin = excluded.telephone_magasin,
  telephone_adherent = excluded.telephone_adherent,
  updated_at = now();

-- Étape 3b : emails de notification depuis staging
-- On éclate les 4 colonnes email en 4 lignes, role distinct. `notify` vaut
-- true par défaut. Les emails vides sont filtrés. Idempotent via ON CONFLICT.
with sources as (
  select m.id as magasin_id, s.mail_principal as email, 'principal'::public.magasin_email_role as role
  from public.staging_magasins s
  join public.magasins m on m.external_id = s.external_id
  where btrim(coalesce(s.mail_principal, '')) <> ''

  union all

  select m.id, s.mail_adherent, 'adherent'::public.magasin_email_role
  from public.staging_magasins s
  join public.magasins m on m.external_id = s.external_id
  where btrim(coalesce(s.mail_adherent, '')) <> ''

  union all

  select m.id, s.mail_supplementaire_1, 'supplementaire_1'::public.magasin_email_role
  from public.staging_magasins s
  join public.magasins m on m.external_id = s.external_id
  where btrim(coalesce(s.mail_supplementaire_1, '')) <> ''

  union all

  select m.id, s.mail_supplementaire_2, 'supplementaire_2'::public.magasin_email_role
  from public.staging_magasins s
  join public.magasins m on m.external_id = s.external_id
  where btrim(coalesce(s.mail_supplementaire_2, '')) <> ''
)
insert into public.magasin_emails (magasin_id, email, role, notify)
select
  magasin_id,
  btrim(lower(email))::public.citext,
  role,
  true
from sources
where btrim(email) ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'  -- sanity check email
on conflict (magasin_id, email) do update set
  role = excluded.role,
  notify = true,
  updated_at = now();

-- Vérif post-import
select
  (select count(*) from public.magasins where external_id is not null) as magasins_imported,
  (select count(*) from public.magasin_emails) as emails_imported,
  (select count(distinct email) from public.magasin_emails) as emails_distinct,
  (select count(*) from public.magasins where groupe is not null) as magasins_avec_groupe;

-- Nettoyage (optionnel) : drop la staging une fois l'import validé.
-- drop table public.staging_magasins;
