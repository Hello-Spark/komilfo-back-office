"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";

export interface MagasinOption {
  id: string;
  name: string;
  ville: string | null;
  groupe: string | null;
}

interface MagasinFilterContextValue {
  /** Magasins rattachés au user connecté via profile_magasins. */
  userMagasins: MagasinOption[];
  /** IDs actuellement sélectionnés (filtre actif). */
  selectedIds: string[];
  /** Filtre actif : au moins un magasin coché ET pas tous. */
  isFiltering: boolean;
  /** True si tous les magasins du user sont sélectionnés. */
  isAllSelected: boolean;
  /** Filtre visible dans la sidebar : au moins 2 magasins rattachés. */
  hasMultipleMagasins: boolean;
  /** Toggle un magasin dans la sélection. */
  toggle: (id: string) => void;
  /** Sélectionne tous les magasins du user. */
  selectAll: () => void;
  /** Sélectionne uniquement ce magasin. */
  selectOnly: (id: string) => void;
  /** True tant que le fetch initial n'est pas terminé. */
  loading: boolean;
}

const MagasinFilterContext = createContext<MagasinFilterContextValue | undefined>(
  undefined,
);

const STORAGE_KEY = "komilfo.selectedMagasinIds";

export function MagasinFilterProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [userMagasins, setUserMagasins] = useState<MagasinOption[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch les magasins du user au mount + restore selection depuis localStorage.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes.user?.id;
      if (!userId) {
        if (!cancelled) setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("profile_magasins")
        .select("magasin:magasins(id, name, ville, groupe)")
        .eq("profile_id", userId);

      if (cancelled) return;
      if (error) {
        console.error("[MagasinFilter] fetch error", error);
        setLoading(false);
        return;
      }

      // Supabase type generator représente la FK comme array même quand
      // la cardinalité est 1:1 — on normalise ici.
      const rows = (data ?? []) as unknown as Array<{
        magasin: MagasinOption | MagasinOption[] | null;
      }>;
      const options = rows
        .map((r) => (Array.isArray(r.magasin) ? r.magasin[0] ?? null : r.magasin))
        .filter((m): m is MagasinOption => m != null)
        .sort((a, b) => a.name.localeCompare(b.name, "fr"));

      setUserMagasins(options);

      // Restore la dernière sélection si valide, sinon tout.
      let initial: string[] = options.map((m) => m.id);
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as string[];
          const validIds = parsed.filter((id) => options.some((m) => m.id === id));
          if (validIds.length > 0) initial = validIds;
        }
      } catch {
        /* localStorage dispo pas partout (SSR, restrictions) — fallback silencieux */
      }

      setSelectedIds(initial);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  // Persist chaque changement.
  useEffect(() => {
    if (loading) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedIds));
    } catch {
      /* no-op */
    }
  }, [selectedIds, loading]);

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        const next = prev.filter((x) => x !== id);
        // Ne jamais tomber à 0 — sinon l'UI masque tout, ambigu avec "tous".
        return next.length === 0 ? prev : next;
      }
      return [...prev, id];
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(userMagasins.map((m) => m.id));
  }, [userMagasins]);

  const selectOnly = useCallback((id: string) => {
    setSelectedIds([id]);
  }, []);

  const isAllSelected =
    userMagasins.length > 0 && selectedIds.length === userMagasins.length;
  const isFiltering = selectedIds.length > 0 && !isAllSelected;
  const hasMultipleMagasins = userMagasins.length > 1;

  const value: MagasinFilterContextValue = {
    userMagasins,
    selectedIds,
    isFiltering,
    isAllSelected,
    hasMultipleMagasins,
    toggle,
    selectAll,
    selectOnly,
    loading,
  };

  return (
    <MagasinFilterContext.Provider value={value}>
      {children}
    </MagasinFilterContext.Provider>
  );
}

export function useMagasinFilter(): MagasinFilterContextValue {
  const ctx = useContext(MagasinFilterContext);
  if (!ctx) {
    throw new Error("useMagasinFilter must be used within MagasinFilterProvider");
  }
  return ctx;
}

/**
 * Filtre un tableau de leads selon les magasins sélectionnés. Si le user
 * n'a pas de magasin rattaché (admin sans rattachement explicite), le
 * tableau est retourné tel quel — on ne cache rien.
 */
export function filterLeadsByMagasins<T extends { magasin_id: string | null }>(
  leads: T[],
  selectedIds: string[],
  userMagasins: MagasinOption[],
): T[] {
  if (userMagasins.length === 0) return leads;
  if (selectedIds.length === 0) return leads;
  const set = new Set(selectedIds);
  return leads.filter((l) => l.magasin_id != null && set.has(l.magasin_id));
}
