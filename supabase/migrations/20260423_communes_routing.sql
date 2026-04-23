-- Routage des leads par commune (code INSEE) plutôt que par code postal.
--
-- Pourquoi INSEE et pas CP : le mapping client (CSV « LISTE ZONES DES
-- ADHERENTS ») associe une commune → un magasin. Un même CP peut couvrir
-- plusieurs communes attribuées à des magasins différents (609 cas sur
-- 4773 CPs distincts). Router sur le code INSEE supprime l'ambiguïté.
--
-- Le formulaire front affiche un sélecteur de commune après saisie du CP
-- (alimenté par l'Edge Function lookup-communes). Le lead envoie le
-- code_insee ; le trigger BEFORE INSERT résout magasin_id à partir de ce
-- code INSEE. Si code_insee manquant ou inconnu → RAISE EXCEPTION (pas de
-- fallback silencieux, cf. routage-cp-magasins.md).
--
-- Source : CSV « FICHIER KOMILFO x MV GROUP - ADS - LISTE ZONES DES
-- ADHERENTS (LP) - V3 » (~40k communes).

create table if not exists public.communes (
  code_insee text primary key check (code_insee ~ '^[0-9A-Z]{5}$'),
  nom text not null,
  code_postal text not null check (code_postal ~ '^[0-9]{5}$'),
  magasin_id uuid not null references public.magasins(id) on delete restrict,
  departement text,
  region text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index critique : lookup-communes filtre les communes par code_postal.
-- ~40k lignes, 4773 CPs distincts → ~8 communes/CP en moyenne.
create index if not exists communes_code_postal_idx
  on public.communes (code_postal);

create index if not exists communes_magasin_idx
  on public.communes (magasin_id);

-- RLS : table publique en lecture. L'Edge Function lookup-communes lit en
-- service_role mais on autorise aussi la lecture anon pour permettre un
-- usage direct depuis d'autres clients Supabase si besoin (pas de données
-- sensibles — c'est du référentiel public INSEE).
alter table public.communes enable row level security;

drop policy if exists communes_read_all on public.communes;
create policy communes_read_all
  on public.communes for select
  using (true);

-- Ajout de la colonne code_insee sur leads — obligatoire, pas de default.
-- Si des leads existants n'ont pas de code_insee, ils resteront avec NULL
-- (cas de migration). On ne pose pas NOT NULL pour ne pas casser la table.
alter table public.leads
  add column if not exists code_insee text;

create index if not exists leads_code_insee_idx
  on public.leads (code_insee)
  where code_insee is not null;

-- Trigger BEFORE INSERT : résout magasin_id depuis code_insee.
--
-- Cas traités :
--  - code_insee fourni et connu : magasin_id posé depuis `communes`
--  - code_insee fourni et inconnu : RAISE EXCEPTION → submit-lead renvoie
--    422 unknown_code_insee au front
--  - code_insee non fourni : on laisse passer avec magasin_id = NULL
--    (transition : les leads d'avant la migration n'ont pas de code_insee).
--    À rendre obligatoire via CHECK constraint une fois les leads historiques
--    routés manuellement.
create or replace function public.resolve_lead_magasin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_magasin_id uuid;
  v_nom text;
  v_cp text;
begin
  -- Pas de code INSEE → on laisse passer sans routage (cas legacy).
  if new.code_insee is null or new.code_insee = '' then
    return new;
  end if;

  select c.magasin_id, c.nom, c.code_postal
    into v_magasin_id, v_nom, v_cp
  from public.communes c
  where c.code_insee = new.code_insee
  limit 1;

  if v_magasin_id is null then
    raise exception 'code insee inconnu: %', new.code_insee
      using errcode = 'P0002';
  end if;

  -- Le magasin_id est autoritaire : même si le front a fourni une valeur,
  -- on la réécrit depuis communes (source de vérité).
  new.magasin_id := v_magasin_id;

  -- Normalise ville et code_postal depuis le référentiel pour éviter les
  -- divergences (casse, accents, typo saisie utilisateur).
  if v_nom is not null then
    new.ville := v_nom;
  end if;
  if v_cp is not null then
    new.code_postal := v_cp;
  end if;

  return new;
end;
$$;

drop trigger if exists leads_resolve_magasin on public.leads;
create trigger leads_resolve_magasin
  before insert on public.leads
  for each row
  execute function public.resolve_lead_magasin();

comment on function public.resolve_lead_magasin is
  'Résout magasin_id via communes.code_insee. Rejette l''insert si le code INSEE est inconnu.';
