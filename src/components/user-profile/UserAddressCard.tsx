"use client";
import React from "react";
import type { Magasin, Profile } from "@/lib/supabase/types";

interface Props {
  profile: Profile;
  magasin: Magasin | null;
}

export default function UserAddressCard({ profile, magasin }: Props) {
  return (
    <div className="p-5 border border-gray-200 rounded-2xl dark:border-gray-800 lg:p-6">
      <h4 className="text-lg font-semibold text-gray-800 dark:text-white/90 lg:mb-6">
        Compte & rattachement
      </h4>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-7 2xl:gap-x-32">
        <div>
          <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
            Type de compte
          </p>
          <p className="text-sm font-medium text-gray-800 dark:text-white/90">
            {profile.role === "admin" ? "Admin" : "Employé Magasin"}
          </p>
        </div>

        <div>
          <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
            Statut
          </p>
          <p className="text-sm font-medium text-gray-800 dark:text-white/90">
            {profile.active ? "Actif" : "Désactivé"}
          </p>
        </div>

        <div>
          <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
            Magasin rattaché
          </p>
          <p className="text-sm font-medium text-gray-800 dark:text-white/90">
            {magasin ? `${magasin.name} (${magasin.code})` : "—"}
          </p>
        </div>

        <div>
          <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
            Ville du magasin
          </p>
          <p className="text-sm font-medium text-gray-800 dark:text-white/90">
            {magasin ? `${magasin.code_postal ?? ""} ${magasin.ville ?? ""}`.trim() || "—" : "—"}
          </p>
        </div>
      </div>

      {profile.role !== "admin" && (
        <p className="mt-6 text-xs text-gray-500 dark:text-gray-400">
          Le rattachement magasin et le type de compte sont gérés par un administrateur.
        </p>
      )}
    </div>
  );
}
