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

  // Indicateur visible quand un sous-ensemble est actif (pour éviter la
  // confusion « mes chiffres ne correspondent pas » après changement de
  // filtre).
  const filterBanner = isFiltering ? (
    <div className="col-span-12 rounded-lg border border-dashed border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:border-amber-800/60 dark:bg-amber-500/10 dark:text-amber-200">
      Les statistiques ci-dessous sont filtrées sur{" "}
      <strong>{selectedIds.length}</strong> magasin
      {selectedIds.length > 1 ? "s" : ""} sur {userMagasins.length}.
    </div>
  ) : null;

  return (
    <div className="grid grid-cols-12 gap-4 md:gap-6">
      {filterBanner}

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
