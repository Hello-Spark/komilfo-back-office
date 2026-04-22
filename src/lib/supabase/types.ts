export type UserRole = 'admin' | 'employe_magasin';
export type LeadType = 'devis' | 'sav';
export type LeadStatus =
  | 'new'
  | 'assigned'
  | 'contacted'
  | 'qualified'
  | 'quoted'
  | 'won'
  | 'lost'
  | 'closed';
export type LeadPriority = 'low' | 'normal' | 'high' | 'urgent';
export type LeadEcheance = 'dans_3_mois' | 'dans_annee' | 'pas_de_date';
export type LeadTravaux = 'neuf' | 'renovation';
export type LeadHabitat = 'maison' | 'appartement' | 'autres';
export type LeadCreneau = 'matin' | 'apres_midi' | 'soiree';
export type ActivityType =
  | 'status_change'
  | 'assignment'
  | 'note'
  | 'call'
  | 'email'
  | 'meeting'
  | 'quote_sent'
  | 'document';

export interface Magasin {
  id: string;
  code: string;
  name: string;
  address: string | null;
  code_postal: string | null;
  ville: string | null;
  region: string | null;
  phone: string | null;
  email: string | null;
  latitude: number | null;
  longitude: number | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: UserRole;
  magasin_id: string | null;
  phone: string | null;
  avatar_url: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Produit {
  id: string;
  code: string;
  label: string;
  form_value: string;
  sort_order: number;
  active: boolean;
  created_at: string;
}

export interface Lead {
  id: string;
  type: LeadType;
  status: LeadStatus;
  priority: LeadPriority;
  echeance: LeadEcheance | null;
  travaux: LeadTravaux | null;
  habitat: LeadHabitat | null;
  message: string | null;
  contact_creneaux: LeadCreneau[];
  code_postal: string;
  ville: string;
  nom: string;
  prenom: string;
  email: string;
  tel: string;
  optin: boolean;
  optin_at: string | null;
  optin_text: string | null;
  magasin_id: string | null;
  assigned_to: string | null;
  src: string | null;
  campaign: string | null;
  location_host: string | null;
  location_href: string | null;
  user_agent: string | null;
  ip_address: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface LeadFull extends Lead {
  magasin_name: string | null;
  magasin_code: string | null;
  assigned_name: string | null;
  assigned_email: string | null;
  produits: { code: string; label: string }[];
}

export interface LeadActivity {
  id: string;
  lead_id: string;
  user_id: string | null;
  type: ActivityType;
  title: string;
  body: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

export type NotificationType = 'lead_new' | 'lead_won' | 'lead_assigned';

export interface Notification {
  id: string;
  user_id: string;
  magasin_id: string | null;
  lead_id: string | null;
  type: NotificationType;
  title: string;
  body: string | null;
  metadata: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}
