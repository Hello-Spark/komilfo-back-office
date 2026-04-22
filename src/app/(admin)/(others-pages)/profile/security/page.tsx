import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/supabase/queries";
import { getMfaStatus } from "@/lib/supabase/mfa";
import MfaManager from "@/components/auth/MfaManager";

export const metadata: Metadata = {
  title: "Sécurité",
  description: "Authentification à deux facteurs — Komilfo CRM",
};

export const dynamic = "force-dynamic";

export default async function SecurityPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/signin?redirect=/profile/security");

  const mfa = await getMfaStatus();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/profile"
          className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
        >
          ← Retour au profil
        </Link>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
        <h3 className="mb-1 text-lg font-semibold text-gray-800 dark:text-white/90">
          Sécurité
        </h3>
        <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
          Gérez l&apos;authentification à deux facteurs (2FA) de votre compte.
        </p>

        <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 dark:border-gray-800 dark:bg-gray-900/50">
          <h4 className="mb-4 font-semibold text-gray-800 dark:text-white/90">
            Authentification à deux facteurs (TOTP)
          </h4>
          <MfaManager
            hasVerifiedTotp={mfa.hasVerifiedTotp}
            currentLevel={mfa.currentLevel}
          />
        </div>
      </div>
    </div>
  );
}
