"use client";
import React, { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/lib/supabase/types";
import { getInitials } from "./utils";

interface AssignableProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  role: UserRole;
}

interface Props {
  assignedId: string | null;
  assignedName: string | null;
  onAssign: (profileId: string | null) => Promise<void> | void;
}

function profileFullName(p: AssignableProfile): string {
  return [p.first_name, p.last_name].filter(Boolean).join(" ") || "(sans nom)";
}

export default function AssigneeSelector({
  assignedId,
  assignedName,
  onAssign,
}: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<AssignableProfile[]>([]);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const openDropdown = async () => {
    setOpen(true);
    if (loaded || loading) return;
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: err } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, role")
        .eq("active", true)
        .order("first_name", { ascending: true });
      if (err) throw err;
      setProfiles((data ?? []) as AssignableProfile[]);
      setLoaded(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur de chargement";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handlePick = async (profileId: string | null) => {
    setSaving(true);
    try {
      await onAssign(profileId);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const filtered = query
    ? profiles.filter((p) =>
        profileFullName(p).toLowerCase().includes(query.toLowerCase())
      )
    : profiles;

  return (
    <div ref={rootRef} className="relative">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-theme-sm font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-300">
            {assignedName ? getInitials(assignedName) : "?"}
          </div>
          <div className="min-w-0">
            <p className="truncate text-theme-sm font-medium text-gray-800 dark:text-white/90">
              {assignedName ?? "Personne"}
            </p>
            <p className="text-theme-xs text-gray-500 dark:text-gray-400">
              {assignedName ? "Commercial assigné" : "Lead non assigné"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => (open ? setOpen(false) : openDropdown())}
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-theme-xs font-medium text-gray-700 transition hover:border-brand-500 hover:bg-brand-50 dark:border-gray-700 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:border-brand-500/60 dark:hover:bg-brand-500/10"
          aria-haspopup="listbox"
          aria-expanded={open}
          disabled={saving}
        >
          Changer
        </button>
      </div>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-800 dark:bg-gray-900"
        >
          <div className="border-b border-gray-100 p-2 dark:border-gray-800">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher..."
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-theme-sm text-gray-700 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            />
          </div>
          <div className="max-h-64 overflow-y-auto">
            {loading && (
              <p className="px-3 py-3 text-theme-sm text-gray-500">
                Chargement...
              </p>
            )}
            {error && (
              <p className="px-3 py-3 text-theme-sm text-error-500">{error}</p>
            )}
            {!loading && !error && (
              <ul className="py-1">
                <li>
                  <button
                    type="button"
                    role="option"
                    aria-selected={assignedId === null}
                    onClick={() => handlePick(null)}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-theme-sm text-gray-600 transition hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-white/[0.04]"
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-theme-xs text-gray-500 dark:bg-gray-800 dark:text-gray-500">
                      —
                    </div>
                    <span>Désassigner</span>
                  </button>
                </li>
                {filtered.map((p) => {
                  const name = profileFullName(p);
                  const active = p.id === assignedId;
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={active}
                        onClick={() => handlePick(p.id)}
                        className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-theme-sm transition hover:bg-gray-50 dark:hover:bg-white/[0.04] ${
                          active
                            ? "bg-brand-50 font-semibold text-gray-900 dark:bg-brand-500/10 dark:text-white"
                            : "text-gray-700 dark:text-gray-300"
                        }`}
                      >
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-theme-xs font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                          {getInitials(name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="truncate">{name}</p>
                          <p className="truncate text-theme-xs text-gray-500 dark:text-gray-400">
                            {p.role === "admin" ? "Admin" : "Commercial"}
                          </p>
                        </div>
                      </button>
                    </li>
                  );
                })}
                {filtered.length === 0 && loaded && (
                  <li className="px-3 py-3 text-theme-sm text-gray-500 dark:text-gray-400">
                    Aucun résultat
                  </li>
                )}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
