-- Étend la vue leads_full pour exposer les colonnes Google Ads
-- (gclid/gbraid/wbraid pour le tracking, lead_value/currency pour la valeur
-- envoyée à la conversion).
--
-- security_invoker=true préservé : la vue applique les RLS de l'appelant et
-- non du créateur. C'est la valeur déjà en place avant cette migration.

create or replace view public.leads_full
with (security_invoker = true)
as
select
  l.id,
  l.type,
  l.status,
  l.priority,
  l.echeance,
  l.travaux,
  l.habitat,
  l.message,
  l.contact_creneaux,
  l.code_postal,
  l.ville,
  l.nom,
  l.prenom,
  l.email,
  l.tel,
  l.optin,
  l.optin_at,
  l.src,
  l.campaign,
  l.created_at,
  l.updated_at,
  l.magasin_id,
  m.name as magasin_name,
  m.code as magasin_code,
  l.assigned_to,
  (p.first_name || ' '::text) || p.last_name as assigned_name,
  p.email as assigned_email,
  coalesce(
    (
      select jsonb_agg(jsonb_build_object('code', pr.code, 'label', pr.label) order by pr.sort_order)
      from lead_produits lp
      join produits pr on pr.id = lp.produit_id
      where lp.lead_id = l.id
    ),
    '[]'::jsonb
  ) as produits,
  -- Tracking Google Ads : nécessaires pour relire l'état d'un lead côté UI
  -- et pour debug. Pas exposés dans le drawer pour l'instant, mais dispos.
  l.gclid,
  l.gbraid,
  l.wbraid,
  l.lead_value,
  l.currency
from leads l
left join magasins m on m.id = l.magasin_id
left join profiles p on p.id = l.assigned_to;
