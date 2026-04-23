"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import CrmMetrics from "@/components/crm/CrmMetrics";
import LeadsHistogram from "@/components/crm/LeadsHistogram";
import ProductBreakdown from "@/components/crm/ProductBreakdown";
import RecentLeads from "@/components/crm/RecentLeads";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useCurrentProfile } from "@/lib/supabase/useCurrentProfile";
import { useMagasinFilter } from "@/context/MagasinFilterContext";

export default function CrmDashboard() {
  const router = useRouter();
  const { profile, loading: profileLoading } = useCurrentProfile();
  const { isFiltering, selectedIds, userMagasins } = useMagasinFilter();
  const { stats, timeseries, breakdown, recent, loading, error } =
    useDashboardData(30, 8);

  useEffect(() => {
    if (!profileLoading && !profile) router.replace("/signin");
  }, [profileLoading, profile, router]);

  if (profileLoading || !profile) {
    return <div className="p-6 text-sm text-gray-500">Chargement…</div>;
  }

  const isAdmin = profile.role === "admin";

  // Indicateur discret — simple pill inline pour rappeler que le filtre
  // est actif sans prendre de place ni détourner le regard des chiffres.
  const filterHint = isFiltering ? (
    <div className="col-span-12 -mb-2 flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
        <path
          d="M1.5 2.5h9l-3.5 4.5v3l-2 1v-4l-3.5-4.5z"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </svg>
      Filtré · {selectedIds.length}/{userMagasins.length} magasin
      {userMagasins.length > 1 ? "s" : ""}
    </div>
  ) : null;

  return (
    <div className="grid grid-cols-12 gap-4 md:gap-6">
      {filterHint}

      <div className="col-span-12">
        <CrmMetrics stats={stats} />
      </div>

      <div className="col-span-12 xl:col-span-8">
        <LeadsHistogram series={timeseries} />
      </div>

      <div className="col-span-12 xl:col-span-4">
        <ProductBreakdown breakdown={breakdown} />
      </div>

      <div className="col-span-12">
        <RecentLeads leads={recent} isAdmin={isAdmin} />
      </div>

      {error && (
        <div className="col-span-12 rounded-lg border border-error-300 bg-error-50 px-4 py-2 text-sm text-error-700 dark:border-error-700 dark:bg-error-500/10 dark:text-error-300">
          Erreur de chargement des statistiques : {error}
        </div>
      )}

      {loading && (
        <div className="col-span-12 text-center text-xs text-gray-400">
          Actualisation…
        </div>
      )}
    </div>
  );
}
