"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Profile } from "@/lib/supabase/types";

type Row = Profile & { magasin_name: string | null };

export default function UsersTable({ users }: { users: Row[] }) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const remove = async (id: string, email: string) => {
    if (!confirm(`Supprimer définitivement le compte ${email} ?`)) return;
    setDeletingId(id);
    const res = await fetch(`/api/admin/users?user_id=${id}`, { method: "DELETE" });
    setDeletingId(null);
    if (res.ok) router.refresh();
    else {
      const body = await res.json().catch(() => ({}));
      alert(body.detail ?? body.error ?? "Suppression impossible");
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
        <thead className="bg-gray-50 dark:bg-gray-900/50">
          <tr className="text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
            <th className="px-6 py-3">Nom</th>
            <th className="px-6 py-3">Email</th>
            <th className="px-6 py-3">Type</th>
            <th className="px-6 py-3">Magasin</th>
            <th className="px-6 py-3">Créé le</th>
            <th className="px-6 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
          {users.length === 0 && (
            <tr>
              <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500">
                Aucun utilisateur pour l&apos;instant.
              </td>
            </tr>
          )}
          {users.map((u) => (
            <tr key={u.id} className="text-sm">
              <td className="px-6 py-4 text-gray-800 dark:text-white/90">
                {[u.first_name, u.last_name].filter(Boolean).join(" ") || "—"}
              </td>
              <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{u.email}</td>
              <td className="px-6 py-4">
                <span
                  className={
                    u.role === "admin"
                      ? "inline-flex rounded-full bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
                      : "inline-flex rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                  }
                >
                  {u.role === "admin" ? "Admin" : "Employé Magasin"}
                </span>
              </td>
              <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                {u.magasin_name ?? "—"}
              </td>
              <td className="px-6 py-4 text-gray-500 dark:text-gray-400">
                {new Date(u.created_at).toLocaleDateString("fr-FR")}
              </td>
              <td className="px-6 py-4 text-right">
                <button
                  onClick={() => remove(u.id, u.email)}
                  disabled={deletingId === u.id}
                  className="text-sm text-error-500 hover:text-error-600 disabled:opacity-60"
                >
                  {deletingId === u.id ? "..." : "Supprimer"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
