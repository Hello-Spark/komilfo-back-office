import { redirect } from "next/navigation";
import { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/queries";
import UserAddressCard from "@/components/user-profile/UserAddressCard";
import UserInfoCard from "@/components/user-profile/UserInfoCard";
import UserMetaCard from "@/components/user-profile/UserMetaCard";
import type { Magasin } from "@/lib/supabase/types";

export const metadata: Metadata = {
  title: "Mon profil",
  description: "Profil de l'utilisateur connecté — Komilfo CRM",
};

export const dynamic = "force-dynamic";

export default async function Profile() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/signin?redirect=/profile");

  let magasin: Magasin | null = null;
  if (profile.magasin_id) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("magasins")
      .select("*")
      .eq("id", profile.magasin_id)
      .maybeSingle();
    magasin = data;
  }

  return (
    <div>
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
        <h3 className="mb-5 text-lg font-semibold text-gray-800 dark:text-white/90 lg:mb-7">
          Mon profil
        </h3>
        <div className="space-y-6">
          <UserMetaCard profile={profile} magasinName={magasin?.name ?? null} />
          <UserInfoCard profile={profile} />
          <UserAddressCard profile={profile} magasin={magasin} />
        </div>
      </div>
    </div>
  );
}
