"use client";
import React from "react";
import Badge from "../ui/badge/Badge";
import {
  LEAD_COLUMN_BADGE_COLOR,
  LEAD_COLUMN_LABEL,
  columnForStatus,
} from "./status";
import type { LeadFull } from "@/lib/supabase/types";

interface Props {
  lead: LeadFull;
  activityCount: number;
  isAdmin: boolean;
  onOpen: (lead: LeadFull) => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function LeadListItem({
  lead,
  activityCount,
  isAdmin,
  onOpen,
}: Props) {
  const column = columnForStatus(lead.status);

  return (
    <button
      type="button"
      onClick={() => onOpen(lead)}
      className="w-full flex items-center gap-4 rounded-xl border border-gray-200 bg-white px-4 py-3 text-left hover:bg-gray-50 dark:border-gray-800 dark:bg-white/[0.03] dark:hover:bg-white/[0.05] transition"
    >
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-800 text-theme-sm dark:text-white/90 truncate">
          {lead.prenom} {lead.nom}
        </p>
        <p className="mt-0.5 text-theme-xs text-gray-500 dark:text-gray-400 truncate">
          {lead.ville} · {lead.code_postal}
          {isAdmin && lead.magasin_name ? ` · ${lead.magasin_name}` : ""}
        </p>
      </div>

      <div className="hidden md:flex flex-wrap gap-1 max-w-[200px]">
        {lead.produits?.slice(0, 2).map((p) => (
          <Badge key={p.code} size="sm" color="light">
            {p.label}
          </Badge>
        ))}
        {lead.produits && lead.produits.length > 2 && (
          <span className="text-theme-xs text-gray-500 dark:text-gray-400 self-center">
            +{lead.produits.length - 2}
          </span>
        )}
      </div>

      <div className="hidden lg:block">
        {column && (
          <Badge size="sm" color={LEAD_COLUMN_BADGE_COLOR[column]}>
            {LEAD_COLUMN_LABEL[column]}
          </Badge>
        )}
      </div>

      <div className="hidden sm:block">
        <Badge
          size="sm"
          color={
            lead.priority === "urgent"
              ? "error"
              : lead.priority === "high"
              ? "warning"
              : "light"
          }
        >
          {lead.priority}
        </Badge>
      </div>

      <div className="hidden md:block min-w-[90px] text-theme-xs text-gray-500 dark:text-gray-400">
        {formatDate(lead.created_at)}
      </div>

      <div className="flex items-center gap-1 text-theme-xs text-gray-500 dark:text-gray-400">
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          className="stroke-current"
        >
          <path
            d="M12.25 6.625c0 2.52-2.352 4.563-5.25 4.563-.67 0-1.31-.11-1.895-.308L2.8 11.375l.625-2.012A4.375 4.375 0 0 1 1.75 6.625C1.75 4.105 4.102 2.063 7 2.063s5.25 2.042 5.25 4.562Z"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
        </svg>
        {activityCount}
      </div>

      {lead.assigned_name && (
        <div
          className="h-8 w-8 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-theme-xs font-medium text-gray-700 dark:text-gray-300"
          title={lead.assigned_name}
        >
          {getInitials(lead.assigned_name)}
        </div>
      )}
    </button>
  );
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
}
