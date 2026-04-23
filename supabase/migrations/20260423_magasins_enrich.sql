-- Enrichit la table magasins avec les champs du CSV client :
--   ID de source externe, groupe (plusieurs magasins d'un même patron),
--   coordonnées du gérant, téléphones. Idempotent : IF NOT EXISTS partout
--   pour permettre le rejeu.
--
-- Source : CSV « FICHIER KOMILFO x MV GROUP - ADS - COORDONNEES ENVOI MV REPORT+LP »
--
-- Les emails de notification du magasin vont dans une table dédiée
-- `magasin_emails` (cf. migration suivante) — un magasin a de 1 à 4 emails,
-- donc modéliser en colonnes serait rigide et ferait des NULLs partout.

alter table public.magasins
  add column if not exists external_id integer,
  add column if not exists groupe text,
  add column if not exists gerant_nom text,
  add column if not exists gerant_prenom text,
  add column if not exists telephone_magasin text,
  add column if not exists telephone_adherent text;

-- external_id = ID numérique du CSV (102, 103, 104, ...). Unique par magasin.
-- NULL autorisé pendant la phase de migration (magasins créés à la main sans
-- correspondance CSV).
create unique index if not exists magasins_external_id_uniq
  on public.magasins (external_id)
  where external_id is not null;

-- Le groupe n'a pas de table dédiée pour l'instant : texte libre ('Gr-02').
-- Si plus tard on veut tracer les groupes proprement (stats, permissions),
-- on normalisera dans une table `magasin_groupes`.
create index if not exists magasins_groupe_idx
  on public.magasins (groupe)
  where groupe is not null;

comment on column public.magasins.external_id is
  'ID du magasin dans la source de référence CSV client. Permet de faire le join avec communes à l''import.';
comment on column public.magasins.groupe is
  'Groupe de magasins partageant un même patron (ex: "Gr-25"). Null si magasin indépendant.';
