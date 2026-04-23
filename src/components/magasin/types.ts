export interface MagasinDetails {
  id: string;
  external_id: number | null;
  code: string;
  name: string;
  address: string | null;
  code_postal: string | null;
  ville: string | null;
  region: string | null;
  phone: string | null;
  email: string | null;
  groupe: string | null;
  gerant_nom: string | null;
  gerant_prenom: string | null;
  telephone_magasin: string | null;
  telephone_adherent: string | null;
  active: boolean;
}

export interface MagasinEmail {
  id: string;
  magasin_id: string;
  email: string;
  role: "principal" | "adherent" | "supplementaire_1" | "supplementaire_2";
  notify: boolean;
  created_at: string;
}

export interface TeamMember {
  profile_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: "admin" | "employe_magasin";
  is_primary: boolean;
  source: "manual" | "auto_email_match" | "import";
}

export const EMAIL_ROLE_LABEL: Record<MagasinEmail["role"], string> = {
  principal: "Principal",
  adherent: "Adhérent",
  supplementaire_1: "Supplémentaire",
  supplementaire_2: "Supplémentaire",
};

export function fullName(
  m: Pick<TeamMember, "first_name" | "last_name" | "email">,
): string {
  const full = [m.first_name, m.last_name].filter(Boolean).join(" ").trim();
  return full || m.email;
}
