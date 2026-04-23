-- =============================================================================
-- Seed : import des communes (référentiel INSEE ↔ CP ↔ magasin)
-- =============================================================================
--
-- Source : supabase/seeds/communes_import.csv (~40k lignes + header).
-- Pré-requis : migration 20260423_communes_routing.sql appliquée ET magasins
-- déjà importés (20260423_import_magasins.sql).
--
-- Stats d'import (vu sur le CSV source, avril 2026) :
--   39 950 lignes total
--     -  746 sans code INSEE           → ignorées
--     - 11 896 sans ID Magasin         → ignorées (communes « non couvertes »)
--     - 25 160 communes uniques        → insérées dans public.communes
--
-- Les 746 communes sans INSEE pourront être enrichies ultérieurement via
-- geo.api.gouv.fr (nom + CP → INSEE). Les 11896 communes sans couverture
-- magasin restent absentes du référentiel : un lead pour ces CPs verra un
-- dropdown vide → UX à traiter (fallback message « non couvert »).
--
-- Étape 1 — Créer la staging (exécuter ce script).
-- Étape 2 — Importer le CSV via Table Editor OU :
--   \copy staging_communes from 'supabase/seeds/communes_import.csv' \
--        with (format csv, header true, null '');
-- Étape 3 — Rejouer la partie « normalise ». Idempotente.
-- =============================================================================

-- Étape 1 : staging
create table if not exists public.staging_communes (
  code_insee_raw text,
  nom_commune text,
  code_postal text,
  id_magasin text,
  magasin_attribue text,
  departement text,
  region text
);

truncate table public.staging_communes;

-- =============================================================================
-- >>> STOP ICI. Importer le CSV puis relancer le script
-- =============================================================================

-- Étape 3 : normalisation + insert dans communes
-- - left-pad INSEE à 5 chiffres (le CSV fournit '9013' au lieu de '09013' pour
--   les départements 1 à 9)
-- - filtre lignes invalides (INSEE vide, magasin vide ou 'non couvert')
-- - join avec magasins.external_id pour résoudre magasin_id (uuid)
-- - déduplique sur code_insee (la source contient des triplets identiques)
-- - upsert idempotent via ON CONFLICT
with filtered as (
  select
    lpad(btrim(s.code_insee_raw), 5, '0') as code_insee,
    btrim(s.nom_commune) as nom,
    btrim(s.code_postal) as code_postal,
    s.id_magasin::integer as external_id,
    nullif(btrim(s.departement), '') as departement,
    nullif(btrim(s.region), '') as region
  from public.staging_communes s
  where btrim(coalesce(s.code_insee_raw, '')) <> ''
    and s.id_magasin ~ '^[0-9]+$'
    and btrim(coalesce(s.nom_commune, '')) <> ''
    and btrim(coalesce(s.code_postal, '')) ~ '^[0-9]{5}$'
),
with_magasin as (
  select distinct on (f.code_insee)
    f.code_insee,
    f.nom,
    f.code_postal,
    m.id as magasin_id,
    f.departement,
    f.region
  from filtered f
  join public.magasins m on m.external_id = f.external_id
  order by f.code_insee, f.nom  -- déterministe sur les doublons
)
insert into public.communes (code_insee, nom, code_postal, magasin_id, departement, region)
select code_insee, nom, code_postal, magasin_id, departement, region
from with_magasin
on conflict (code_insee) do update set
  nom = excluded.nom,
  code_postal = excluded.code_postal,
  magasin_id = excluded.magasin_id,
  departement = excluded.departement,
  region = excluded.region,
  updated_at = now();

-- Vérif post-import
select
  (select count(*) from public.communes) as communes_total,
  (select count(distinct magasin_id) from public.communes) as magasins_avec_zone,
  (select count(distinct code_postal) from public.communes) as cp_couverts,
  (select count(*) from public.staging_communes) as staging_rows;

-- Nettoyage (optionnel) : drop la staging une fois l'import validé.
-- drop table public.staging_communes;
