"use client";
import React, { useEffect, useRef, useState } from "react";
import {
  LEAD_COLUMN_ORDER,
  LEAD_COLUMN_LABEL,
  LEAD_COLUMN_ACCENT,
  columnForStatus,
  statusForColumn,
  type LeadColumn,
} from "../status";
import type { LeadStatus } from "@/lib/supabase/types";

function Chevron({ rotated }: { rotated: boolean }) {
  return (
    <svg
      width={12}
      height={12}
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
      style={{
        flexShrink: 0,
        transform: rotated ? "rotate(180deg)" : "rotate(0deg)",
        transition: "transform 200ms ease",
      }}
    >
      <path
        d="m3 4.5 3 3 3-3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface Props {
  status: LeadStatus;
  onChange: (newStatus: LeadStatus, note?: string) => Promise<void> | void;
}

const PILL_BG: Record<LeadColumn, string> = {
  new: "bg-blue-light-50 text-blue-light-500 hover:bg-blue-light-100 dark:bg-blue-light-500/15 dark:text-blue-light-400 dark:hover:bg-blue-light-500/25",
  assigned:
    "bg-warning-50 text-warning-600 hover:bg-warning-100 dark:bg-warning-500/15 dark:text-orange-400 dark:hover:bg-warning-500/25",
  contacted:
    "bg-brand-50 text-gray-900 hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-400 dark:hover:bg-brand-500/25",
  won: "bg-success-50 text-success-600 hover:bg-success-100 dark:bg-success-500/15 dark:text-success-500 dark:hover:bg-success-500/25",
  lost: "bg-error-50 text-error-600 hover:bg-error-100 dark:bg-error-500/15 dark:text-error-500 dark:hover:bg-error-500/25",
};

export default function StatusSelector({ status, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<LeadColumn | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const currentColumn = columnForStatus(status);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setPending(null);
        setNote("");
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const handleSelect = (col: LeadColumn) => {
    if (col === currentColumn) {
      setOpen(false);
      return;
    }
    setPending(col);
    setNote("");
  };

  const handleConfirm = async (withNote: boolean) => {
    if (!pending) return;
    const target = statusForColumn(pending);
    setSaving(true);
    try {
      await onChange(target, withNote ? note.trim() || undefined : undefined);
      setOpen(false);
      setPending(null);
      setNote("");
    } finally {
      setSaving(false);
    }
  };

  const pillBg = currentColumn
    ? PILL_BG[currentColumn]
    : "bg-gray-100 text-gray-700 dark:bg-white/5 dark:text-white/80";

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-theme-xs font-medium leading-5 transition ${pillBg}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Changer le statut du lead"
      >
        <span>
          {currentColumn ? LEAD_COLUMN_LABEL[currentColumn] : status}
        </span>
        <Chevron rotated={open} />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-800 dark:bg-gray-900"
        >
          {!pending ? (
            <ul className="py-1">
              {LEAD_COLUMN_ORDER.map((col) => {
                const active = col === currentColumn;
                return (
                  <li key={col}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => handleSelect(col)}
                      className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-theme-sm transition hover:bg-gray-50 dark:hover:bg-white/[0.04] ${
                        active
                          ? "font-semibold text-gray-900 dark:text-white"
                          : "text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      <span
                        className={`h-2.5 w-2.5 shrink-0 rounded-full ${LEAD_COLUMN_ACCENT[col]}`}
                        aria-hidden="true"
                      />
                      <span className="flex-1">{LEAD_COLUMN_LABEL[col]}</span>
                      {active && (
                        <span className="text-theme-xs text-gray-400">
                          Actuel
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="p-3">
              <p className="mb-2 text-theme-xs text-gray-500 dark:text-gray-400">
                Passer à{" "}
                <span className="font-semibold text-gray-700 dark:text-gray-200">
                  {LEAD_COLUMN_LABEL[pending]}
                </span>
              </p>
              <label className="sr-only" htmlFor="status-note">
                Note optionnelle
              </label>
              <textarea
                id="status-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Note optionnelle (ex : appel passé, RDV pris...)"
                rows={3}
                className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-theme-sm text-gray-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              />
              <div className="mt-3 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPending(null);
                    setNote("");
                  }}
                  className="rounded-lg px-2 py-1 text-theme-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  disabled={saving}
                >
                  Annuler
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleConfirm(false)}
                    disabled={saving}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-theme-xs font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    Sans note
                  </button>
                  <button
                    type="button"
                    onClick={() => handleConfirm(true)}
                    disabled={saving}
                    className="rounded-lg bg-brand-500 px-3 py-1.5 text-theme-xs font-semibold text-gray-900 transition hover:bg-brand-600 disabled:opacity-50"
                  >
                    {saving ? "..." : "Valider"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
