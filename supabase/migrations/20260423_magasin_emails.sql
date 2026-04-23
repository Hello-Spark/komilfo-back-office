-- Emails de notification d'un magasin. Un magasin a typiquement 2 à 4 emails
-- (principal du magasin, adhérent/gérant, suppléants). Stockés dans une
-- table dédiée plutôt qu'en colonnes pour éviter les NULLs et permettre
-- d'en ajouter sans migration.
--
-- Utilisé par l'Edge Function notify-new-lead pour déterminer les
-- destinataires quand un nouveau lead tombe sur le magasin. Découplé de
-- `profiles` : un magasin peut recevoir des notifications sans qu'aucun
-- compte user ne soit créé (cas initial fréquent avant onboarding).

-- Extension citext : comparaison email case-insensitive sans ambiguïté.
create extension if not exists citext with schema public;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'magasin_email_role') then
    create type public.magasin_email_role as enum (
      'principal',        -- mail principal à notifier
      'adherent',         -- mail adhérent/gérant
      'supplementaire_1', -- 1er mail supplémentaire
      'supplementaire_2'  -- 2e mail supplémentaire
    );
  end if;
end$$;

create table if not exists public.magasin_emails (
  id uuid primary key default gen_random_uuid(),
  magasin_id uuid not null references public.magasins(id) on delete cascade,
  email public.citext not null,
  role public.magasin_email_role not null,
  notify boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (magasin_id, email)
);

create index if not exists magasin_emails_magasin_idx
  on public.magasin_emails (magasin_id);

-- Index sur email : un même email peut être rattaché à plusieurs magasins
-- (patron multi-magasin). Sert au trigger d'auto-association user→magasins
-- à la création de compte.
create index if not exists magasin_emails_email_idx
  on public.magasin_emails (email);

-- Trigger updated_at standard.
create or replace function public.touch_magasin_emails_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists magasin_emails_touch_updated_at on public.magasin_emails;
create trigger magasin_emails_touch_updated_at
  before update on public.magasin_emails
  for each row execute function public.touch_magasin_emails_updated_at();

-- RLS : lecture réservée au service_role. Un compte user normal ne doit pas
-- voir la liste des emails des autres magasins.
alter table public.magasin_emails enable row level security;

-- Pas de policy pour authenticated → seul service_role y accède (bypass RLS).
-- Si plus tard on veut permettre à un admin de lire, on ajoutera une policy
-- dédiée `role = 'admin'`.

comment on table public.magasin_emails is
  'Emails destinataires des notifications par magasin. 1 à 4 lignes par magasin.';
comment on column public.magasin_emails.notify is
  'Si false, l''email est gardé en référence mais ne reçoit plus de notifications.';
