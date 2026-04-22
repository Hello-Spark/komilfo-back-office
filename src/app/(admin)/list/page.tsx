import type { Metadata } from "next";
import { redirect } from "next/navigation";
import LeadList from "@/components/leads/LeadList";
import { getCurrentProfile, getLeads } from "@/lib/supabase/queries";
import { LEAD_UI_STATUSES } from "@/components/leads/status";

export const metadata: Metadata = {
  title: "Liste",
  description: "Liste des leads",
};

export const dynamic = "force-dynamic";

export default async function ListPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/signin");

  const allLeads = await getLeads({ limit: 500 });
  const leads = allLeads.filter((l) => LEAD_UI_STATUSES.includes(l.status));

  return <LeadList initialLeads={leads} isAdmin={profile.role === "admin"} />;
}
