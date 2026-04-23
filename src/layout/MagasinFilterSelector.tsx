"use client";

import React, { useEffect, useRef, useState } from "react";
import { useMagasinFilter } from "@/context/MagasinFilterContext";
import { useSidebar } from "@/context/SidebarContext";

/**
 * Sélecteur de magasins affiché en bas de la sidebar, visible uniquement
 * quand le user est rattaché à ≥ 2 magasins. Filtre les listes de leads
 * dans l'app via le context MagasinFilter.
 *
 * Persistance : la sélection est gardée en localStorage (clé gérée par le
 * context).
 */
export default function MagasinFilterSelector() {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();
  const {
    userMagasins,
    selectedIds,
    hasMultipleMagasins,
    isAllSelected,
    toggle,
    selectAll,
    selectOnly,
    loading,
  } = useMagasinFilter();

  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Ferme le panneau si clic à l'extérieur.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const expanded = isExpanded || isHovered || isMobileOpen;

  if (loading || !hasMultipleMagasins) return null;

  // Label bouton : nombre de magasins ou nom si 1 sélectionné.
  const currentSelected =
    selectedIds.length === 1
      ? userMagasins.find((m) => m.id === selectedIds[0])?.name ?? "—"
      : isAllSelected
        ? "Tous mes magasins"
        : `${selectedIds.length} magasin${selectedIds.length > 1 ? "s" : ""}`;

  return (
    <div
      ref={containerRef}
      className="mt-auto mb-4 border-t border-gray-200 pt-4 dark:border-gray-800"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`group flex w-full items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-left text-sm transition hover:border-gray-300 hover:bg-gray-50 dark:border-gray-800 dark:bg-white/[0.03] dark:hover:bg-white/[0.05] ${
          !expanded ? "justify-center" : ""
        }`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span
          aria-hidden="true"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#fdd626] text-gray-900"
        >
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path
              d="M3 8l7-5 7 5v9a1 1 0 0 1-1 1h-4v-6H8v6H4a1 1 0 0 1-1-1V8z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        {expanded && (
          <>
            <span className="flex-1 min-w-0">
              <span className="block text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Magasin{userMagasins.length > 1 ? "s" : ""}
              </span>
              <span className="block truncate text-sm font-medium text-gray-800 dark:text-white/90">
                {currentSelected}
              </span>
            </span>
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              aria-hidden="true"
              className={`shrink-0 text-gray-400 transition ${open ? "rotate-180" : ""}`}
            >
              <path
                d="m3.5 5.5 3.5 3.5 3.5-3.5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </>
        )}
      </button>

      {open && expanded && (
        <div
          role="listbox"
          aria-label="Sélection des magasins"
          className="absolute bottom-20 left-4 right-4 z-50 max-h-[60vh] overflow-y-auto rounded-lg border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-800 dark:bg-gray-900"
        >
          <div className="flex items-center justify-between border-b border-gray-100 pb-2 mb-1 dark:border-gray-800">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {userMagasins.length} magasin{userMagasins.length > 1 ? "s" : ""} rattaché{userMagasins.length > 1 ? "s" : ""}
            </span>
            {!isAllSelected && (
              <button
                type="button"
                onClick={() => {
                  selectAll();
                }}
                className="text-xs font-medium text-[#8a6d0a] hover:underline"
              >
                Tout sélectionner
              </button>
            )}
          </div>
          <ul className="flex flex-col">
            {userMagasins.map((m) => {
              const checked = selectedIds.includes(m.id);
              return (
                <li key={m.id}>
                  <div className="flex items-center gap-2 rounded-md px-2 py-2 hover:bg-gray-50 dark:hover:bg-white/[0.03]">
                    <label className="flex flex-1 cursor-pointer items-center gap-2 min-w-0">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(m.id)}
                        className="h-4 w-4 shrink-0 cursor-pointer accent-[#fdd626]"
                      />
                      <span className="flex-1 min-w-0">
                        <span className="block truncate text-sm font-medium text-gray-800 dark:text-white/90">
                          {m.name}
                        </span>
                        {(m.ville || m.groupe) && (
                          <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                            {[m.ville, m.groupe].filter(Boolean).join(" · ")}
                          </span>
                        )}
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={() => selectOnly(m.id)}
                      className="shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium text-gray-500 opacity-0 transition hover:bg-gray-100 hover:text-gray-700 group-hover:opacity-100 dark:hover:bg-white/[0.05] dark:hover:text-gray-300"
                      title="Voir uniquement ce magasin"
                    >
                      Seul
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
