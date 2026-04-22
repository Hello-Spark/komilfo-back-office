"use client";
import React from "react";
import { useDrag } from "react-dnd";
import Badge from "../ui/badge/Badge";
import type { LeadFull } from "@/lib/supabase/types";

export const LEAD_CARD_TYPE = "LEAD_CARD";

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
  });
}

function priorityColor(priority: string): "error" | "warning" | "light" | "info" {
  switch (priority) {
    case "urgent":
      return "error";
    case "high":
      return "warning";
    case "low":
      return "info";
    default:
      return "light";
  }
}

export default function LeadCard({ lead, activityCount, isAdmin, onOpen }: Props) {
  const [{ isDragging }, drag] = useDrag(
    () => ({
      type: LEAD_CARD_TYPE,
      item: { id: lead.id, status: lead.status },
      collect: (monitor) => ({ isDragging: monitor.isDragging() }),
    }),
    [lead.id, lead.status]
  );

  const setDragRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      drag(node);
    },
    [drag]
  );

  return (
    <div
      ref={setDragRef}
      onClick={() => onOpen(lead)}
      className={`rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03] cursor-grab active:cursor-grabbing transition hover:shadow-sm ${
        isDragging ? "opacity-50" : "opacity-100"
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="font-medium text-gray-800 text-theme-sm dark:text-white/90 line-clamp-1">
          {lead.prenom} {lead.nom}
        </p>
        <Badge size="sm" color={priorityColor(lead.priority)}>
          {lead.priority}
        </Badge>
      </div>

      <p className="text-theme-xs text-gray-500 dark:text-gray-400 mb-3 line-clamp-1">
        {lead.ville} · {lead.code_postal}
        {isAdmin && lead.magasin_name ? ` · ${lead.magasin_name}` : ""}
      </p>

      {lead.produits && lead.produits.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {lead.produits.slice(0, 3).map((p) => (
            <Badge key={p.code} size="sm" color="light">
              {p.label}
            </Badge>
          ))}
          {lead.produits.length > 3 && (
            <span className="text-theme-xs text-gray-500 dark:text-gray-400">
              +{lead.produits.length - 3}
            </span>
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-theme-xs text-gray-500 dark:text-gray-400">
          {formatDate(lead.created_at)}
        </span>
        <div className="flex items-center gap-3">
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
              className="h-7 w-7 overflow-hidden rounded-full ring-2 ring-white dark:ring-gray-900 bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-theme-xs font-medium text-gray-700 dark:text-gray-300"
              title={lead.assigned_name}
            >
              {getInitials(lead.assigned_name)}
            </div>
          )}
        </div>
      </div>
    </div>
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
