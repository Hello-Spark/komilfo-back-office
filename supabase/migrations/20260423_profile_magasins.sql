-- Relation N:N entre profiles (utilisateurs du back-office) et magasins.
--
-- Contexte : un patron peut avoir jusqu'à 5 magasins (ex: groupe « Gr-25 »)
-- sous le même email. La colonne `profiles.magasin_id` unique ne modélise
-- pas cette réalité → table de jointure dédiée.
--
-- Auto-association : à la création d'un profile, on cherche dans
-- magasin_emails tous les magasins où cet email est déclaré et on crée les
-- liens automatiquement. Même logique inverse : si on ajoute un email à un
-- magasin existant et qu'un profile a déjà cet email, on crée le lien.
--
-- `profiles.magasin_id` est conservée pour compatibilité avec le code
-- existant du back-office (queries.ts, notifications, etc.) et joue le rôle
-- de « magasin principal » — à terme, à dropper quand le back-office aura
-- été refactoré pour lire via `profile_magasins`.

create table if not exists public.profile_magasins (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  magasin_id uuid not null references public.magasins(id) on delete cascade,
  is_primary boolean not null default false,
  source text not null default 'manual'
    check (source in ('manual', 'auto_email_match', 'import')),
  created_at timestamptz not null default now(),
  primary key (profile_id, magasin_id)
);

-- Un seul magasin primaire par profile.
create unique index if not exists profile_magasins_one_primary
  on public.profile_magasins (profile_id)
  where is_primary = true;

create index if not exists profile_magasins_magasin_idx
  on public.profile_magasins (magasin_id);

alter table public.profile_magasins enable row level security;

-- Lecture : chaque user voit uniquement ses propres rattachements.
drop policy if exists profile_magasins_own_read on public.profile_magasins;
create policy profile_magasins_own_read
  on public.profile_magasins for select
  using (profile_id = auth.uid());

-- Admin : lecture totale (profiles.role = 'admin').
drop policy if exists profile_magasins_admin_read on public.profile_magasins;
create policy profile_magasins_admin_read
  on public.profile_magasins for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- ============================================================================
-- Migration des données existantes : profiles.magasin_id → profile_magasins
-- ============================================================================

insert into public.profile_magasins (profile_id, magasin_id, is_primary, source)
select id, magasin_id, true, 'import'
from public.profiles
where magasin_id is not null
on conflict (profile_id, magasin_id) do nothing;

-- ============================================================================
-- Fonction d'auto-association : matche email profile ↔ magasin_emails.email
-- ============================================================================

create or replace function public.auto_link_profile_magasins(p_profile_id uuid, p_email citext)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_linked integer := 0;
begin
  if p_email is null or p_email = '' then
    return 0;
  end if;

  with matched as (
    select distinct me.magasin_id
    from public.magasin_emails me
    where me.email = p_email
  ),
  inserted as (
    insert into public.profile_magasins (profile_id, magasin_id, source)
    select p_profile_id, m.magasin_id, 'auto_email_match'
    from matched m
    on conflict (profile_id, magasin_id) do nothing
    returning magasin_id
  )
  select count(*)::int into v_linked from inserted;

  return v_linked;
end;
$$;

-- ============================================================================
-- Trigger : à la création d'un profile, lancer l'auto-association
-- ============================================================================

create or replace function public.profile_auto_link_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.auto_link_profile_magasins(new.id, new.email::citext);
  return new;
end;
$$;

drop trigger if exists profiles_auto_link_magasins on public.profiles;
create trigger profiles_auto_link_magasins
  after insert on public.profiles
  for each row
  execute function public.profile_auto_link_on_insert();

-- Trigger sur update d'email : si un user change son email, on re-matche.
-- (Les anciens liens auto_email_match deviennent peut-être obsolètes — on
-- les laisse volontairement : l'admin peut supprimer manuellement si besoin.)
create or replace function public.profile_auto_link_on_email_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    perform public.auto_link_profile_magasins(new.id, new.email::citext);
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_auto_link_on_email_change on public.profiles;
create trigger profiles_auto_link_on_email_change
  after update of email on public.profiles
  for each row
  execute function public.profile_auto_link_on_email_change();

-- ============================================================================
-- Trigger inverse : ajout d'un email à un magasin → match avec profiles existants
-- ============================================================================

create or replace function public.magasin_email_auto_link_profiles()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profile_magasins (profile_id, magasin_id, source)
  select p.id, new.magasin_id, 'auto_email_match'
  from public.profiles p
  where p.email::citext = new.email
  on conflict (profile_id, magasin_id) do nothing;

  return new;
end;
$$;

drop trigger if exists magasin_emails_auto_link_profiles on public.magasin_emails;
create trigger magasin_emails_auto_link_profiles
  after insert on public.magasin_emails
  for each row
  execute function public.magasin_email_auto_link_profiles();

comment on table public.profile_magasins is
  'Rattachement N:N entre users back-office et magasins. Auto-alimenté via match email lors de la création de compte.';
comment on function public.auto_link_profile_magasins is
  'Cherche tous les magasin_emails avec l''email donné et crée les liens profile_magasins. Retourne le nombre de nouveaux liens créés.';
