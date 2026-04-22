-- Notifie les utilisateurs d'un magasin à chaque nouveau lead.
-- Chaîne : INSERT leads -> trigger -> pg_net.http_post -> Edge Function notify-new-lead -> Brevo.
--
-- Config runtime (hors migration, car secrets) :
--   select vault.create_secret('<url>',    'notify_new_lead_edge_function_url', '…');
--   select vault.create_secret('<secret>', 'notify_new_lead_webhook_secret',    '…');

create extension if not exists pg_net with schema extensions;

create or replace function public.handle_new_lead_notification()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  v_edge_url text;
  v_secret   text;
begin
  select decrypted_secret into v_edge_url
  from vault.decrypted_secrets
  where name = 'notify_new_lead_edge_function_url'
  limit 1;

  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'notify_new_lead_webhook_secret'
  limit 1;

  if v_edge_url is null or v_edge_url = '' then
    raise warning '[notify-new-lead] vault secret notify_new_lead_edge_function_url missing, skipping notification for lead %', new.id;
    return new;
  end if;

  if v_secret is null or v_secret = '' then
    raise warning '[notify-new-lead] vault secret notify_new_lead_webhook_secret missing, skipping notification for lead %', new.id;
    return new;
  end if;

  perform net.http_post(
    url := v_edge_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', v_secret
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'leads',
      'schema', 'public',
      'record', to_jsonb(new),
      'old_record', null
    ),
    timeout_milliseconds := 5000
  );

  return new;
end;
$$;

comment on function public.handle_new_lead_notification is
  'Déclenche l''Edge Function notify-new-lead via pg_net après chaque INSERT sur leads. Lit l''URL et le shared secret depuis Supabase Vault (secrets notify_new_lead_edge_function_url et notify_new_lead_webhook_secret).';

drop trigger if exists on_lead_insert_notify_magasin on public.leads;

create trigger on_lead_insert_notify_magasin
  after insert on public.leads
  for each row
  execute function public.handle_new_lead_notification();
