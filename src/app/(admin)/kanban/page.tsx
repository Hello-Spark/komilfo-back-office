import type { Metadata } from "next";
import { redirect } from "next/navigation";
import LeadBoard from "@/components/leads/LeadBoard";
import { getCurrentProfile, getLeads } from "@/lib/supabase/queries";

export const metadata: Metadata = {
  title: "Kanban",
  description: "Pipeline des leads",
};

export const dynamic = "force-dynamic";

export default async function KanbanPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/signin");

  const leads = await getLeads({ limit: 500 });

  return <LeadBoard initialLeads={leads} isAdmin={profile.role === "admin"} />;
}
