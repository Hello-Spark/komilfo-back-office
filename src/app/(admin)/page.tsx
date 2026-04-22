import type { Metadata } from "next";
import { redirect } from "next/navigation";
import CrmMetrics from "@/components/crm/CrmMetrics";
import LeadsHistogram from "@/components/crm/LeadsHistogram";
import ProductBreakdown from "@/components/crm/ProductBreakdown";
import RecentLeads from "@/components/crm/RecentLeads";
import {
  getCurrentProfile,
  getLeads,
  getLeadsByProduct,
  getLeadsTimeseries,
} from "@/lib/supabase/queries";

export const metadata: Metadata = {
  title: "Tableau de bord CRM",
  description: "Pipeline des leads Komilfo",
};

export const dynamic = "force-dynamic";

export default async function CrmDashboard() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/signin");

  const [timeseries, breakdown, recent] = await Promise.all([
    getLeadsTimeseries(30),
    getLeadsByProduct(),
    getLeads({ limit: 8 }),
  ]);

  const isAdmin = profile.role === "admin";

  return (
    <div className="grid grid-cols-12 gap-4 md:gap-6">
      <div className="col-span-12">
        <CrmMetrics />
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
    </div>
  );
}
