"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useMagasinFilter } from "@/context/MagasinFilterContext";
import type { LeadFull, LeadStatus } from "@/lib/supabase/types";

export interface LeadStatsRow {
  status: LeadStatus;
  total: number;
  last_7d: number;
  last_30d: number;
}

export interface LeadDailyPoint {
  date: string;
  count: number;
}

export interface LeadProductBreakdown {
  code: string;
  label: string;
  count: number;
}

interface DashboardData {
  stats: LeadStatsRow[];
  timeseries: LeadDailyPoint[];
  breakdown: LeadProductBreakdown[];
  recent: LeadFull[];
  loading: boolean;
  error: string | null;
}

/**
 * Fetch + agrégation côté client des 4 datasets du dashboard, filtrés selon
 * les magasins sélectionnés dans la sidebar (MagasinFilterContext).
 *
 * Re-fetch automatique à chaque changement de selectedIds. Garde le dernier
 * dataset pendant le refetch pour éviter un flash vide.
 */
export function useDashboardData(days = 30, recentLimit = 8): DashboardData {
  const supabase = useMemo(() => createClient(), []);
  const { selectedIds, userMagasins, loading: filterLoading } = useMagasinFilter();

  const [stats, setStats] = useState<LeadStatsRow[]>([]);
  const [timeseries, setTimeseries] = useState<LeadDailyPoint[]>([]);
  const [breakdown, setBreakdown] = useState<LeadProductBreakdown[]>([]);
  const [recent, setRecent] = useState<LeadFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Applique le filtre magasin seulement si le user en a (sinon admin sans
  // rattachement → voit tout).
  const shouldFilter = userMagasins.length > 0 && selectedIds.length > 0;

  useEffect(() => {
    // Attendre que le context ait fini sa résolution.
    if (filterLoading) return;

    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);

      const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();

      try {
        // -----------------------------
        // 1) Stats par statut (vue leads_stats_by_status)
        // -----------------------------
        let statsQuery = supabase
          .from("leads_stats_by_status")
          .select("status, total, last_7d, last_30d, magasin_id");
        if (shouldFilter) {
          statsQuery = statsQuery.in("magasin_id", selectedIds);
        }
        const statsRes = await statsQuery;
        if (statsRes.error) throw statsRes.error;
        const grouped: Record<string, LeadStatsRow> = {};
        for (const row of (statsRes.data ?? []) as Array<{
          status: LeadStatus;
          total: number | null;
          last_7d: number | null;
          last_30d: number | null;
        }>) {
          const cur = grouped[row.status] ?? {
            status: row.status,
            total: 0,
            last_7d: 0,
            last_30d: 0,
          };
          cur.total += Number(row.total ?? 0);
          cur.last_7d += Number(row.last_7d ?? 0);
          cur.last_30d += Number(row.last_30d ?? 0);
          grouped[row.status] = cur;
        }
        if (!cancelled) setStats(Object.values(grouped));

        // -----------------------------
        // 2) Timeseries (derniers `days` jours)
        // -----------------------------
        let tsQuery = supabase
          .from("leads")
          .select("created_at")
          .gte("created_at", since);
        if (shouldFilter) {
          tsQuery = tsQuery.in("magasin_id", selectedIds);
        }
        const tsRes = await tsQuery;
        if (tsRes.error) throw tsRes.error;
        const counts: Record<string, number> = {};
        for (let i = 0; i < days; i++) {
          const d = new Date(Date.now() - (days - 1 - i) * 24 * 3600 * 1000);
          counts[d.toISOString().slice(0, 10)] = 0;
        }
        for (const row of (tsRes.data ?? []) as Array<{ created_at: string }>) {
          const k = row.created_at.slice(0, 10);
          if (k in counts) counts[k] += 1;
        }
        if (!cancelled) {
          setTimeseries(
            Object.entries(counts).map(([date, count]) => ({ date, count })),
          );
        }

        // -----------------------------
        // 3) Breakdown produits
        // -----------------------------
        // On fetche lead_produits et on filtre par magasin en passant par
        // l'INNER join sur leads. Si le user a sélectionné des magasins,
        // on chaîne un filtre sur leads.magasin_id via l'embedded select.
        let bdQuery = supabase
          .from("lead_produits")
          .select(
            "produit:produits(code, label, sort_order), lead:leads!inner(magasin_id)",
          );
        if (shouldFilter) {
          bdQuery = bdQuery.in("lead.magasin_id", selectedIds);
        }
        const bdRes = await bdQuery;
        if (bdRes.error) throw bdRes.error;
        const bdMap: Record<string, LeadProductBreakdown & { sort: number }> = {};
        for (const row of (bdRes.data ?? []) as unknown as Array<{
          produit:
            | { code: string; label: string; sort_order: number }
            | { code: string; label: string; sort_order: number }[]
            | null;
        }>) {
          const raw = Array.isArray(row.produit) ? row.produit[0] : row.produit;
          if (!raw) continue;
          const k = raw.code;
          if (!bdMap[k]) {
            bdMap[k] = {
              code: raw.code,
              label: raw.label,
              count: 0,
              sort: raw.sort_order ?? 0,
            };
          }
          bdMap[k].count += 1;
        }
        if (!cancelled) {
          setBreakdown(
            Object.values(bdMap)
              .sort((a, b) => b.count - a.count || a.sort - b.sort)
              .map(({ code, label, count }) => ({ code, label, count })),
          );
        }

        // -----------------------------
        // 4) Leads récents
        // -----------------------------
        let recentQuery = supabase
          .from("leads_full")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(recentLimit);
        if (shouldFilter) {
          recentQuery = recentQuery.in("magasin_id", selectedIds);
        }
        const recentRes = await recentQuery;
        if (recentRes.error) throw recentRes.error;
        if (!cancelled) setRecent((recentRes.data ?? []) as LeadFull[]);
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : "Unknown error";
          setError(msg);
          console.error("[useDashboardData] error", err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // selectedIds stringifié pour déclencher le re-fetch quand le set change
    // sans re-render inutile si juste la référence change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    supabase,
    days,
    recentLimit,
    shouldFilter,
    selectedIds.join(","),
    filterLoading,
  ]);

  return { stats, timeseries, breakdown, recent, loading, error };
}
