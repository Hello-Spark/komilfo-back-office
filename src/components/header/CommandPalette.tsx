"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useCurrentProfile } from "@/lib/supabase/useCurrentProfile";
import type { LeadStatus, LeadType } from "@/lib/supabase/types";

interface LeadHit {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  tel: string;
  ville: string;
  type: LeadType;
  status: LeadStatus;
  created_at: string;
}

type Item =
  | { kind: "nav"; id: string; label: string; hint?: string; href: string }
  | { kind: "lead"; id: string; lead: LeadHit };

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function CommandPalette({ open, onClose }: Props) {
  const router = useRouter();
  const { profile } = useCurrentProfile();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [results, setResults] = useState<LeadHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [highlighted, setHighlighted] = useState(0);

  // Reset & focus on open
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setDebounced("");
    setResults([]);
    setHighlighted(0);
    const t = setTimeout(() => inputRef.current?.focus(), 10);
    return () => clearTimeout(t);
  }, [open]);

  // Debounce 200ms
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 200);
    return () => clearTimeout(t);
  }, [query]);

  // Fetch leads
  useEffect(() => {
    if (!open) return;
    const q = debounced;
    if (!q) {
      setResults([]);
      setSearching(false);
      return;
    }
    // Sanitize: PostgREST .or() uses commas as separators; strip them + %
    const safe = q.replace(/[,%]/g, "").slice(0, 64);
    if (!safe) {
      setResults([]);
      return;
    }

    let cancelled = false;
    setSearching(true);
    const supabase = createClient();
    supabase
      .from("leads")
      .select("id, nom, prenom, email, tel, ville, type, status, created_at")
      .or(
        [
          `nom.ilike.%${safe}%`,
          `prenom.ilike.%${safe}%`,
          `email.ilike.%${safe}%`,
          `tel.ilike.%${safe}%`,
          `ville.ilike.%${safe}%`,
        ].join(","),
      )
      .order("created_at", { ascending: false })
      .limit(10)
      .then(({ data }) => {
        if (cancelled) return;
        setResults((data as LeadHit[] | null) ?? []);
        setSearching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, debounced]);

  // Nav items (filtered by query)
  const navItems = useMemo<
    { id: string; label: string; hint?: string; href: string }[]
  >(() => {
    const items = [
      { id: "nav:dashboard", label: "Tableau de bord", href: "/" },
      { id: "nav:list", label: "Liste des leads", href: "/list" },
      { id: "nav:kanban", label: "Kanban", href: "/kanban" },
    ];
    if (profile?.role === "admin") {
      items.push({ id: "nav:users", label: "Utilisateurs", href: "/users" });
    }
    items.push({ id: "nav:profile", label: "Mon profil", href: "/profile" });

    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter((i) => i.label.toLowerCase().includes(q));
  }, [query, profile?.role]);

  // Flat list of all items for keyboard navigation
  const flatItems = useMemo<Item[]>(() => {
    const list: Item[] = navItems.map((n) => ({ kind: "nav", ...n }));
    results.forEach((l) => list.push({ kind: "lead", id: `lead:${l.id}`, lead: l }));
    return list;
  }, [navItems, results]);

  // Clamp highlight when list changes
  useEffect(() => {
    setHighlighted((i) => Math.min(i, Math.max(flatItems.length - 1, 0)));
  }, [flatItems.length]);

  const commit = (item: Item) => {
    if (item.kind === "nav") router.push(item.href);
    else router.push(`/list?lead=${item.lead.id}`);
    onClose();
  };

  // Keyboard
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlighted((i) => Math.min(i + 1, flatItems.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlighted((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const item = flatItems[highlighted];
        if (item) commit(item);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, flatItems, highlighted]);

  // Scroll highlighted into view
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-idx="${highlighted}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [highlighted]);

  if (!open) return null;

  const showNav = navItems.length > 0;
  const showLeads = query.trim().length > 0;

  return (
    <div
      className="fixed inset-0 z-999999 flex items-start justify-center bg-black/50 px-4 pt-[15vh]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-dark"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-800">
          <svg
            className="text-gray-400"
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
          >
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M3.04 9.37C3.04 5.88 5.88 3.04 9.37 3.04c3.5 0 6.34 2.84 6.34 6.33 0 3.5-2.84 6.34-6.34 6.34-3.5 0-6.34-2.84-6.34-6.34ZM9.37 1.54c-4.33 0-7.83 3.5-7.83 7.83 0 4.33 3.5 7.83 7.83 7.83 1.89 0 3.63-.67 4.98-1.79l2.82 2.82c.3.3.77.3 1.06 0 .3-.29.3-.77 0-1.06l-2.82-2.82a7.82 7.82 0 0 0 1.85-5.05c0-4.33-3.5-7.83-7.83-7.83Z"
              fill="currentColor"
            />
          </svg>
          <input
            ref={inputRef}
            type="text"
            autoComplete="off"
            spellCheck={false}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un lead ou une commande…"
            className="flex-1 bg-transparent text-sm text-gray-800 placeholder:text-gray-400 focus:outline-hidden dark:text-white/90 dark:placeholder:text-white/30"
          />
          <kbd className="hidden items-center gap-0.5 rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] text-gray-500 sm:inline-flex dark:border-gray-700 dark:bg-white/5 dark:text-gray-400">
            ESC
          </kbd>
        </div>

        <ul
          ref={listRef}
          className="max-h-[50vh] overflow-y-auto py-2"
          role="listbox"
        >
          {showNav && (
            <li className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              Navigation
            </li>
          )}
          {navItems.map((n, idx) => {
            const isHi = idx === highlighted;
            return (
              <li
                key={n.id}
                data-idx={idx}
                role="option"
                aria-selected={isHi}
                onMouseEnter={() => setHighlighted(idx)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  commit({ kind: "nav", ...n });
                }}
                className={`mx-2 flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm ${
                  isHi
                    ? "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
                    : "text-gray-700 dark:text-gray-300"
                }`}
              >
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                  <path
                    d="M10 3l7 6v8H3v-8l7-6z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="flex-1">{n.label}</span>
                {isHi && <span className="text-xs opacity-60">↵</span>}
              </li>
            );
          })}

          {showLeads && (
            <>
              <li className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                Leads {searching && <span className="ml-1 opacity-60">…</span>}
              </li>

              {!searching && results.length === 0 && debounced && (
                <li className="mx-2 px-3 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                  Aucun lead ne correspond à « {debounced} ».
                </li>
              )}

              {results.map((l, idx) => {
                const flatIdx = navItems.length + idx;
                const isHi = flatIdx === highlighted;
                const name = [l.prenom, l.nom].filter(Boolean).join(" ") || l.email;
                return (
                  <li
                    key={l.id}
                    data-idx={flatIdx}
                    role="option"
                    aria-selected={isHi}
                    onMouseEnter={() => setHighlighted(flatIdx)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      commit({ kind: "lead", id: `lead:${l.id}`, lead: l });
                    }}
                    className={`mx-2 flex cursor-pointer items-start gap-3 rounded-md px-3 py-2 ${
                      isHi
                        ? "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
                        : "text-gray-700 dark:text-gray-300"
                    }`}
                  >
                    <span
                      className={`mt-0.5 inline-flex h-5 min-w-[44px] items-center justify-center rounded-full px-1.5 text-[10px] font-semibold uppercase tracking-wider ${
                        l.type === "devis"
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                          : "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                      }`}
                    >
                      {l.type === "devis" ? "Devis" : "SAV"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{name}</div>
                      <div className="truncate text-xs text-gray-500 dark:text-gray-400">
                        {l.email} · {l.ville || "—"} ·{" "}
                        {new Date(l.created_at).toLocaleDateString("fr-FR")}
                      </div>
                    </div>
                    {isHi && (
                      <span className="mt-1 text-xs opacity-60">↵</span>
                    )}
                  </li>
                );
              })}
            </>
          )}

          {!showLeads && navItems.length === 0 && (
            <li className="mx-2 px-3 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
              Tapez pour rechercher un lead…
            </li>
          )}
        </ul>

        <div className="flex items-center justify-between border-t border-gray-200 px-4 py-2 text-[11px] text-gray-500 dark:border-gray-800 dark:text-gray-400">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <kbd className="rounded border border-gray-200 bg-gray-50 px-1 dark:border-gray-700 dark:bg-white/5">
                ↑
              </kbd>
              <kbd className="rounded border border-gray-200 bg-gray-50 px-1 dark:border-gray-700 dark:bg-white/5">
                ↓
              </kbd>{" "}
              naviguer
            </span>
            <span className="inline-flex items-center gap-1">
              <kbd className="rounded border border-gray-200 bg-gray-50 px-1 dark:border-gray-700 dark:bg-white/5">
                ↵
              </kbd>{" "}
              ouvrir
            </span>
          </div>
          <span className="inline-flex items-center gap-1">
            <kbd className="rounded border border-gray-200 bg-gray-50 px-1 dark:border-gray-700 dark:bg-white/5">
              ⌘
            </kbd>
            <kbd className="rounded border border-gray-200 bg-gray-50 px-1 dark:border-gray-700 dark:bg-white/5">
              K
            </kbd>
          </span>
        </div>
      </div>
    </div>
  );
}
