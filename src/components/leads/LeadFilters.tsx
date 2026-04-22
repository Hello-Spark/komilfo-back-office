"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { LeadFull } from "@/lib/supabase/types";
import { leadsToCsv, downloadCsv } from "./exportCsv";

export type DatePreset =
  | "all"
  | "today"
  | "last_7"
  | "last_week"
  | "this_month"
  | "last_month"
  | "custom";

export interface DateRange {
  preset: DatePreset;
  from: string | null; // YYYY-MM-DD
  to: string | null;
}

const PRESET_LABEL: Record<DatePreset, string> = {
  all: "Toutes les dates",
  today: "Aujourd'hui",
  last_7: "7 derniers jours",
  last_week: "Semaine dernière",
  this_month: "Ce mois",
  last_month: "Le mois dernier",
  custom: "Personnalisé",
};

const PRESET_ORDER: DatePreset[] = [
  "all",
  "today",
  "last_7",
  "last_week",
  "this_month",
  "last_month",
  "custom",
];

function iso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function resolveRange(preset: DatePreset): { from: string | null; to: string | null } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (preset) {
    case "all":
      return { from: null, to: null };
    case "today":
      return { from: iso(today), to: iso(today) };
    case "last_7": {
      const from = new Date(today);
      from.setDate(from.getDate() - 6);
      return { from: iso(from), to: iso(today) };
    }
    case "last_week": {
      // ISO: Monday = 1, Sunday = 7. getDay() returns 0 for Sunday.
      const dow = today.getDay() === 0 ? 7 : today.getDay();
      const mondayThis = new Date(today);
      mondayThis.setDate(today.getDate() - (dow - 1));
      const mondayPrev = new Date(mondayThis);
      mondayPrev.setDate(mondayThis.getDate() - 7);
      const sundayPrev = new Date(mondayPrev);
      sundayPrev.setDate(mondayPrev.getDate() + 6);
      return { from: iso(mondayPrev), to: iso(sundayPrev) };
    }
    case "this_month": {
      const from = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from: iso(from), to: iso(today) };
    }
    case "last_month": {
      const from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const to = new Date(today.getFullYear(), today.getMonth(), 0);
      return { from: iso(from), to: iso(to) };
    }
    case "custom":
      return { from: null, to: null };
  }
}

export function filterLeadsByRange(leads: LeadFull[], range: DateRange): LeadFull[] {
  if (range.preset === "all" || (!range.from && !range.to)) return leads;

  const fromMs = range.from ? new Date(`${range.from}T00:00:00`).getTime() : null;
  const toMs = range.to ? new Date(`${range.to}T23:59:59.999`).getTime() : null;

  return leads.filter((l) => {
    const ts = new Date(l.created_at).getTime();
    if (fromMs !== null && ts < fromMs) return false;
    if (toMs !== null && ts > toMs) return false;
    return true;
  });
}

interface Props {
  range: DateRange;
  onChange: (range: DateRange) => void;
  leadsForExport: LeadFull[];
  totalCount: number;
}

export default function LeadFilters({
  range,
  onChange,
  leadsForExport,
  totalCount,
}: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const pickPreset = (p: DatePreset) => {
    if (p === "custom") {
      onChange({ preset: "custom", from: range.from, to: range.to });
    } else {
      const r = resolveRange(p);
      onChange({ preset: p, from: r.from, to: r.to });
    }
  };

  const updateCustom = (field: "from" | "to", value: string) => {
    onChange({ ...range, preset: "custom", [field]: value || null });
  };

  const buttonLabel = useMemo(() => {
    if (range.preset === "custom") {
      if (range.from && range.to) {
        return `${formatFr(range.from)} → ${formatFr(range.to)}`;
      }
      if (range.from) return `≥ ${formatFr(range.from)}`;
      if (range.to) return `≤ ${formatFr(range.to)}`;
      return "Personnalisé";
    }
    return PRESET_LABEL[range.preset];
  }, [range]);

  const handleExport = () => {
    const csv = leadsToCsv(leadsForExport);
    const suffix =
      range.preset === "all"
        ? "tous"
        : range.preset === "custom"
          ? `${range.from ?? "debut"}_${range.to ?? "fin"}`
          : range.preset;
    downloadCsv(`leads_${suffix}_${iso(new Date())}.csv`, csv);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div ref={containerRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-theme-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-white/[0.03]"
        >
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
            <path
              d="M6 3v2M14 3v2M3 8h14M4 5h12a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>{buttonLabel}</span>
          <svg
            className={`transition-transform ${open ? "rotate-180" : ""}`}
            width="14"
            height="14"
            viewBox="0 0 20 20"
            fill="none"
          >
            <path
              d="M5 7.5l5 5 5-5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {open && (
          <div className="absolute left-0 top-full z-40 mt-2 w-72 rounded-xl border border-gray-200 bg-white p-2 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark">
            <ul className="py-1">
              {PRESET_ORDER.map((p) => (
                <li key={p}>
                  <button
                    type="button"
                    onClick={() => {
                      pickPreset(p);
                      if (p !== "custom") setOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm ${
                      range.preset === p
                        ? "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
                        : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/[0.03]"
                    }`}
                  >
                    {PRESET_LABEL[p]}
                    {range.preset === p && <span className="text-xs">✓</span>}
                  </button>
                </li>
              ))}
            </ul>
            {range.preset === "custom" && (
              <div className="mt-2 border-t border-gray-100 px-2 pt-3 dark:border-gray-800">
                <label className="mb-1 block text-theme-xs text-gray-500 dark:text-gray-400">
                  Du
                </label>
                <input
                  type="date"
                  value={range.from ?? ""}
                  onChange={(e) => updateCustom("from", e.target.value)}
                  className="mb-2 h-10 w-full rounded-md border border-gray-200 bg-transparent px-3 text-sm text-gray-800 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                />
                <label className="mb-1 block text-theme-xs text-gray-500 dark:text-gray-400">
                  Au
                </label>
                <input
                  type="date"
                  value={range.to ?? ""}
                  onChange={(e) => updateCustom("to", e.target.value)}
                  className="h-10 w-full rounded-md border border-gray-200 bg-transparent px-3 text-sm text-gray-800 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                />
              </div>
            )}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={handleExport}
        disabled={leadsForExport.length === 0}
        className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-theme-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 disabled:opacity-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-white/[0.03]"
        title={
          leadsForExport.length === 0
            ? "Aucun lead à exporter dans la plage sélectionnée"
            : `Exporter ${leadsForExport.length} lead${leadsForExport.length > 1 ? "s" : ""} en CSV`
        }
      >
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
          <path
            d="M10 3v10m0 0l-4-4m4 4l4-4M3 17h14"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Exporter CSV
        <span className="text-theme-xs text-gray-500 dark:text-gray-400">
          ({leadsForExport.length}
          {leadsForExport.length !== totalCount ? ` / ${totalCount}` : ""})
        </span>
      </button>
    </div>
  );
}

function formatFr(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}
