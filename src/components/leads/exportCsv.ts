import type { LeadFull } from "@/lib/supabase/types";
import {
  ECHEANCE_LABEL,
  TRAVAUX_LABEL,
  HABITAT_LABEL,
  CRENEAU_LABEL,
} from "./drawer/utils";

const STATUS_LABEL: Record<string, string> = {
  new: "Nouveau",
  assigned: "Assigné",
  contacted: "Contacté",
  qualified: "Qualifié",
  quoted: "Devis envoyé",
  won: "Gagné",
  lost: "Perdu",
  closed: "Clôturé",
};

const PRIORITY_LABEL: Record<string, string> = {
  urgent: "Urgent",
  high: "Prioritaire",
  normal: "Normal",
  low: "Faible",
};

function escapeCsvField(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  // Always quote to handle commas, quotes, newlines, semicolons consistently.
  const escaped = s.replace(/"/g, '""');
  return `"${escaped}"`;
}

function formatDateTimeFr(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

const COLUMNS: { header: string; value: (l: LeadFull) => unknown }[] = [
  { header: "ID", value: (l) => l.id },
  { header: "Créé le", value: (l) => formatDateTimeFr(l.created_at) },
  { header: "Type", value: (l) => (l.type === "devis" ? "Devis" : "SAV") },
  { header: "Statut", value: (l) => STATUS_LABEL[l.status] ?? l.status },
  { header: "Priorité", value: (l) => PRIORITY_LABEL[l.priority] ?? l.priority },
  { header: "Prénom", value: (l) => l.prenom },
  { header: "Nom", value: (l) => l.nom },
  { header: "Email", value: (l) => l.email },
  { header: "Téléphone", value: (l) => l.tel },
  { header: "Code postal", value: (l) => l.code_postal },
  { header: "Ville", value: (l) => l.ville },
  { header: "Magasin", value: (l) => l.magasin_name ?? "" },
  { header: "Code magasin", value: (l) => l.magasin_code ?? "" },
  { header: "Assigné à", value: (l) => l.assigned_name ?? "" },
  { header: "Email assigné", value: (l) => l.assigned_email ?? "" },
  {
    header: "Échéance",
    value: (l) => (l.echeance ? ECHEANCE_LABEL[l.echeance] ?? l.echeance : ""),
  },
  {
    header: "Travaux",
    value: (l) => (l.travaux ? TRAVAUX_LABEL[l.travaux] ?? l.travaux : ""),
  },
  {
    header: "Habitat",
    value: (l) => (l.habitat ? HABITAT_LABEL[l.habitat] ?? l.habitat : ""),
  },
  {
    header: "Produits",
    value: (l) =>
      l.produits?.length ? l.produits.map((p) => p.label).join(" ; ") : "",
  },
  {
    header: "Créneaux de rappel",
    value: (l) =>
      l.contact_creneaux?.length
        ? l.contact_creneaux.map((c) => CRENEAU_LABEL[c] ?? c).join(" ; ")
        : "",
  },
  { header: "Source", value: (l) => l.src ?? "" },
  { header: "Campagne", value: (l) => l.campaign ?? "" },
  { header: "Message", value: (l) => (l.message ?? "").replace(/\r?\n/g, " ") },
];

export function leadsToCsv(leads: LeadFull[]): string {
  const header = COLUMNS.map((c) => escapeCsvField(c.header)).join(",");
  const rows = leads.map((l) =>
    COLUMNS.map((c) => escapeCsvField(c.value(l))).join(","),
  );
  // UTF-8 BOM so Excel opens accents correctly.
  return "﻿" + [header, ...rows].join("\r\n");
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
