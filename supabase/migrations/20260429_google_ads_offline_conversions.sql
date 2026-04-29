-- Offline conversion tracking pour Google Ads.
-- Au passage d'un lead en "won", on uploade une click conversion via l'API
-- Google Ads (GCLID + enhanced conversions PII hashées). La config (customer
-- id, conversion action, valeur par défaut) est éditable depuis le BO.

-- ============================================================================
-- 1. Colonnes de tracking sur leads
-- ============================================================================
-- gclid/gbraid/wbraid : capturés côté form public (?gclid=…) et persistés
-- avec le lead. Indispensables pour les click conversions.
-- lead_value/currency : valeur du deal pour optimiser le bidding (Smart Bidding
-- a besoin de valeurs par lead). Si null à l'envoi → on retombe sur la valeur
-- par défaut configurée dans google_ads_settings.

alter table public.leads
  add column if not exists gclid text,
  add column if not exists gbraid text,
  add column if not exists wbraid text,
  add column if not exists lead_value numeric(10, 2),
  add column if not exists currency text;

-- Index partiel : on ne lookup que les leads qui ont un gclid (la grosse
-- majorité n'en aura pas, source organique/direct).
create index if not exists idx_leads_gclid
  on public.leads (gclid)
  where gclid is not null;

comment on column public.leads.gclid is
  'Google Click ID capturé à l''arrivée sur le site (param ?gclid=). Utilisé '
  'pour l''upload de click conversions vers Google Ads. Expire après 90 jours.';
comment on column public.leads.lead_value is
  'Valeur estimée du lead (€). Utilisée comme conversion_value lors de l''upload '
  'Google Ads. Si null, fallback sur google_ads_settings.default_value.';

-- ============================================================================
-- 2. Settings Google Ads (singleton)
-- ============================================================================
-- Une seule ligne, identifiée par id = 1. Pattern singleton classique :
-- check constraint pour empêcher l'insertion de plusieurs lignes.

create table if not exists public.google_ads_settings (
  id smallint primary key default 1,
  enabled boolean not null default false,
  customer_id text,                       -- compte Google Ads (sans tirets), ex "1234567890"
  login_customer_id text,                 -- MCC parent si applicable
  conversion_action_id text,              -- ID numérique de la conversion action
  conversion_label text,                  -- label texte (info, ex "abc123XYZ"), affichage uniquement
  default_value numeric(10, 2) not null default 0,
  currency text not null default 'EUR',
  send_enhanced_conversions boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  constraint google_ads_settings_singleton check (id = 1)
);

comment on table public.google_ads_settings is
  'Singleton (id=1) — configuration de l''upload des conversions offline vers Google Ads.';

alter table public.google_ads_settings enable row level security;

-- Admin only
drop policy if exists google_ads_settings_admin_select on public.google_ads_settings;
create policy google_ads_settings_admin_select on public.google_ads_settings
  for select to authenticated
  using (private.is_admin());

drop policy if exists google_ads_settings_admin_modify on public.google_ads_settings;
create policy google_ads_settings_admin_modify on public.google_ads_settings
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

revoke all on public.google_ads_settings from anon;

-- Seed la ligne singleton
insert into public.google_ads_settings (id) values (1)
  on conflict (id) do nothing;

-- updated_at trigger
create or replace function public.touch_google_ads_settings_updated_at()
returns trigger
language plpgsql
set search_path = 'public', 'pg_temp'
as $func$
begin
  new.updated_at := now();
  return new;
end;
$func$;

drop trigger if exists trg_google_ads_settings_updated_at on public.google_ads_settings;
create trigger trg_google_ads_settings_updated_at
  before update on public.google_ads_settings
  for each row execute function public.touch_google_ads_settings_updated_at();

-- ============================================================================
-- 3. Logs des envois de conversions
-- ============================================================================
-- Trace chaque tentative d'upload vers Google Ads pour debug et retry manuel.
-- On stocke request/response pour pouvoir relire ce qui a été envoyé.

create table if not exists public.google_ads_conversion_logs (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  status text not null check (status in ('success', 'error', 'skipped')),
  identifier_used text not null check (identifier_used in ('gclid', 'gbraid', 'wbraid', 'enhanced_only', 'none')),
  conversion_value numeric(10, 2),
  currency text,
  conversion_action text,                 -- resource name complet envoyé
  order_id text,                          -- = lead_id, pour dédup côté Google
  request_payload jsonb,
  response_payload jsonb,
  error_message text,
  triggered_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_google_ads_conversion_logs_lead
  on public.google_ads_conversion_logs (lead_id, created_at desc);
create index if not exists idx_google_ads_conversion_logs_status
  on public.google_ads_conversion_logs (status, created_at desc);

comment on table public.google_ads_conversion_logs is
  'Trace des uploads de conversions vers Google Ads. Source de vérité pour '
  'debug et re-tentatives manuelles.';

alter table public.google_ads_conversion_logs enable row level security;

drop policy if exists google_ads_logs_admin_select on public.google_ads_conversion_logs;
create policy google_ads_logs_admin_select on public.google_ads_conversion_logs
  for select to authenticated
  using (private.is_admin());

-- Pas de policy INSERT/UPDATE/DELETE en authenticated : seul service_role
-- (depuis la route API) écrit dans cette table.

revoke all on public.google_ads_conversion_logs from anon;
revoke all on public.google_ads_conversion_logs from authenticated;
grant select on public.google_ads_conversion_logs to authenticated;

-- ============================================================================
-- 4. Vue leads_full : pas de modification nécessaire si elle est en SELECT *
-- ============================================================================
-- Si la vue leads_full est définie en `select l.* from leads l ...` les
-- nouvelles colonnes (gclid, lead_value, currency) y apparaissent
-- automatiquement après recréation. Sinon, recréer manuellement avec les
-- nouveaux champs. À vérifier post-migration via :
--   select column_name from information_schema.columns
--   where table_schema = 'public' and table_name = 'leads_full';
