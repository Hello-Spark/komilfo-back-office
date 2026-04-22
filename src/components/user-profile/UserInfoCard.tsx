"use client";
import React from "react";
import type { Profile } from "@/lib/supabase/types";

interface Props {
  profile: Profile;
}

export default function UserInfoCard({ profile }: Props) {
  return (
    <div className="p-5 border border-gray-200 rounded-2xl dark:border-gray-800 lg:p-6">
      <div>
        <h4 className="text-lg font-semibold text-gray-800 dark:text-white/90 lg:mb-6">
          Informations personnelles
        </h4>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-7 2xl:gap-x-32">
          <div>
            <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
              Prénom
            </p>
            <p className="text-sm font-medium text-gray-800 dark:text-white/90">
              {profile.first_name || "—"}
            </p>
          </div>

          <div>
            <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
              Nom
            </p>
            <p className="text-sm font-medium text-gray-800 dark:text-white/90">
              {profile.last_name || "—"}
            </p>
          </div>

          <div>
            <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
              Email
            </p>
            <p className="text-sm font-medium text-gray-800 dark:text-white/90">
              {profile.email}
            </p>
          </div>

          <div>
            <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
              Téléphone
            </p>
            <p className="text-sm font-medium text-gray-800 dark:text-white/90">
              {profile.phone || "—"}
            </p>
          </div>

          <div>
            <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
              Membre depuis
            </p>
            <p className="text-sm font-medium text-gray-800 dark:text-white/90">
              {new Date(profile.created_at).toLocaleDateString("fr-FR")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
