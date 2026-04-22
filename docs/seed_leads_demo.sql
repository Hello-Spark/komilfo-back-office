-- Seed de 12 leads de démo couvrant les 5 colonnes UI (new, assigned, contacted, won, lost).
-- Utilise les premiers magasins et produits actifs. Idempotent via ON CONFLICT (email,created_at).
-- À exécuter dans le SQL editor Supabase ou via mcp__supabase__execute_sql.

with m as (
  select id, code from public.magasins where active = true order by code limit 3
),
p as (
  select id, code from public.produits where active = true order by sort_order limit 5
),
leads_seed as (
  insert into public.leads (
    type, status, priority, echeance, travaux, habitat,
    message, contact_creneaux, code_postal, ville, nom, prenom, email, tel,
    optin, optin_at, optin_text, magasin_id, src, campaign, metadata, created_at
  )
  select
    t.type::lead_type,
    t.status::lead_status,
    t.priority::lead_priority,
    case when t.type = 'sav' then null else t.echeance::lead_echeance end,
    case when t.type = 'sav' then null else t.travaux::lead_travaux end,
    case when t.type = 'sav' then null else t.habitat::lead_habitat end,
    t.message,
    t.creneaux::lead_creneau[],
    t.code_postal,
    t.ville,
    t.nom,
    t.prenom,
    t.email,
    t.tel,
    true,
    now() - (t.days_ago || ' days')::interval,
    'J''accepte les CGU',
    (select id from m order by random() limit 1),
    'devis-komilfo.fr',
    'seed-demo',
    '{}'::jsonb,
    now() - (t.days_ago || ' days')::interval
  from (values
    ('devis','new','high','dans_3_mois','renovation','maison',
      'Besoin d''un devis rapide pour remplacer 3 volets roulants abîmés.',
      '{matin}', '75011','Paris','Dupont','Marie','marie.dupont+demo@example.com','0601020301', 1),
    ('devis','new','urgent','dans_3_mois','renovation','maison',
      'Porte d''entrée endommagée après tempête, urgent.',
      '{matin,apres_midi}', '44000','Nantes','Bernard','Luc','luc.bernard+demo@example.com','0601020302', 0),
    ('sav','new','normal','pas_de_date','renovation','appartement',
      'Problème de SAV sur store banne posé il y a 6 mois.',
      '{soiree}', '69003','Lyon','Martin','Sophie','sophie.martin+demo@example.com','0601020303', 2),
    ('devis','assigned','normal','dans_annee','neuf','maison',
      'Construction neuve, besoin fenêtres + volets roulants.',
      '{matin}', '33000','Bordeaux','Petit','Thomas','thomas.petit+demo@example.com','0601020304', 5),
    ('devis','assigned','high','dans_3_mois','renovation','maison',
      'Remplacement complet des ouvrants côté jardin.',
      '{apres_midi}', '59000','Lille','Robert','Claire','claire.robert+demo@example.com','0601020305', 7),
    ('devis','contacted','normal','dans_3_mois','renovation','maison',
      'Devis reçu, attente de validation du budget.',
      '{soiree}', '13001','Marseille','Richard','Julien','julien.richard+demo@example.com','0601020306', 12),
    ('devis','contacted','high','dans_3_mois','renovation','appartement',
      'RDV prévu la semaine prochaine pour signature.',
      '{matin}', '67000','Strasbourg','Moreau','Isabelle','isabelle.moreau+demo@example.com','0601020307', 9),
    ('devis','contacted','normal','dans_annee','renovation','maison',
      'En comparaison avec 2 autres devis.',
      '{matin,apres_midi}', '31000','Toulouse','Simon','Paul','paul.simon+demo@example.com','0601020308', 15),
    ('devis','won','normal','dans_3_mois','renovation','maison',
      'Signé hier, pose prévue dans 4 semaines.',
      '{matin}', '44100','Nantes','Laurent','Nicolas','nicolas.laurent+demo@example.com','0601020309', 20),
    ('devis','won','high','dans_3_mois','neuf','maison',
      'Client fidèle, projet signé.',
      '{apres_midi}', '35000','Rennes','Michel','Claire','claire.michel+demo@example.com','0601020310', 28),
    ('devis','lost','low','dans_annee','renovation','appartement',
      'Concurrent moins cher retenu.',
      '{soiree}', '06000','Nice','Garcia','Lucas','lucas.garcia+demo@example.com','0601020311', 35),
    ('devis','lost','normal','pas_de_date','renovation','maison',
      'Projet reporté, ne donne plus suite.',
      '{matin}', '21000','Dijon','Lefebvre','Chloé','chloe.lefebvre+demo@example.com','0601020312', 42)
  ) as t(type, status, priority, echeance, travaux, habitat, message,
         creneaux, code_postal, ville, nom, prenom, email, tel, days_ago)
  where not exists (
    select 1 from public.leads l where l.email = t.email
  )
  returning id, email
)
insert into public.lead_produits (lead_id, produit_id)
select l.id, pr.id
from leads_seed l
cross join lateral (
  select id from p order by random() limit 2
) pr
on conflict do nothing;
