import type { LeadEcheance, LeadCreneau } from "@/lib/supabase/types";

export function formatPhoneHref(tel: string): string {
  // Strip everything but digits and a leading +.
  const trimmed = tel.trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D+/g, "");
  if (!digits) return "";
  // Default to FR if 10 digits starting with 0
  if (!hasPlus && digits.length === 10 && digits.startsWith("0")) {
    return `+33${digits.slice(1)}`;
  }
  return `${hasPlus ? "+" : ""}${digits}`;
}

export function formatPhoneDisplay(tel: string): string {
  const trimmed = tel.trim();
  // 10-digit FR format: 01 23 45 67 89
  const digits = trimmed.replace(/\D+/g, "");
  if (digits.length === 10 && digits.startsWith("0")) {
    return digits.replace(/(\d{2})(?=\d)/g, "$1 ").trim();
  }
  return trimmed;
}

export const ECHEANCE_LABEL: Record<LeadEcheance, string> = {
  dans_3_mois: "Dans 3 mois",
  dans_annee: "Dans l'année",
  pas_de_date: "Pas de date",
};

export const TRAVAUX_LABEL: Record<string, string> = {
  neuf: "Neuf",
  renovation: "Rénovation",
};

export const HABITAT_LABEL: Record<string, string> = {
  maison: "Maison",
  appartement: "Appartement",
  autres: "Autres",
};

export const CRENEAU_LABEL: Record<LeadCreneau, string> = {
  matin: "Matin",
  apres_midi: "Après-midi",
  soiree: "Soirée",
};

export function formatRelativeDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  if (diffHours < 24) return `il y a ${diffHours} h`;
  if (diffDays === 1) return "hier";
  if (diffDays < 7) return `il y a ${diffDays} j`;

  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: sameYear ? undefined : "numeric",
  });
}

export function formatAbsoluteDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}
