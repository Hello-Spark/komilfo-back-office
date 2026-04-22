import type { LeadStatus } from "@/lib/supabase/types";

export type LeadColumn = "new" | "assigned" | "contacted" | "won" | "lost";

export const LEAD_COLUMN_ORDER: LeadColumn[] = [
  "new",
  "assigned",
  "contacted",
  "won",
  "lost",
];

export const LEAD_COLUMN_LABEL: Record<LeadColumn, string> = {
  new: "Nouveau",
  assigned: "Tentative de contact",
  contacted: "Contacté / En cours",
  won: "Gagné",
  lost: "Perdu",
};

export const LEAD_COLUMN_ACCENT: Record<LeadColumn, string> = {
  new: "bg-blue-light-500",
  assigned: "bg-warning-500",
  contacted: "bg-brand-500",
  won: "bg-success-500",
  lost: "bg-error-500",
};

export const LEAD_COLUMN_BADGE_COLOR: Record<
  LeadColumn,
  "info" | "warning" | "primary" | "success" | "error"
> = {
  new: "info",
  assigned: "warning",
  contacted: "primary",
  won: "success",
  lost: "error",
};

const DB_TO_UI: Record<LeadStatus, LeadColumn> = {
  new: "new",
  assigned: "assigned",
  contacted: "contacted",
  qualified: "contacted",
  quoted: "contacted",
  won: "won",
  lost: "lost",
  closed: "lost",
};

export function columnForStatus(status: LeadStatus): LeadColumn {
  return DB_TO_UI[status];
}

export function statusForColumn(column: LeadColumn): LeadStatus {
  return column;
}

export const LEAD_UI_STATUSES: LeadStatus[] = [
  "new",
  "assigned",
  "contacted",
  "won",
  "lost",
];
