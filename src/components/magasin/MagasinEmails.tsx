"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { MagasinEmail } from "./types";

interface Props {
  magasinId: string;
  emails: MagasinEmail[];
  canEdit: boolean;
  onChange: (next: MagasinEmail[]) => void;
}

// Tous les emails sont au même niveau hiérarchique — pas de distinction
// adhérent / supplémentaire côté UI. On garde la colonne `role` en DB pour
// ne pas casser le back-end existant, mais on l'écrit `notification` à
// l'insert et on ignore sa valeur au display.

export default function MagasinEmails({
  magasinId,
  emails,
  canEdit,
  onChange,
}: Props) {
  const supabase = createClient();
  const [newEmail, setNewEmail] = useState("");
  const [adding, setAdding] = useState(false);

  const addEmail = async () => {
    const email = newEmail.trim().toLowerCase();
    if (!email) return;
    setAdding(true);
    const { data, error } = await supabase
      .from("magasin_emails")
      .insert({
        magasin_id: magasinId,
        email,
        // Rôle conservé techniquement — on stocke en fallback rotatif pour ne
        // pas violer l'enum. Le front ne l'utilise pas pour l'affichage.
        role: pickAvailableRole(emails),
        notify: true,
      })
      .select("*")
      .single();
    setAdding(false);
    if (error) {
      toast.error(
        error.message.includes("duplicate")
          ? "Cet email est déjà listé"
          : error.message,
      );
      return;
    }
    if (data) {
      onChange([...emails, data as MagasinEmail]);
      setNewEmail("");
      toast.success("Email ajouté");
    }
  };

  const toggleNotify = async (id: string, current: boolean) => {
    const { error } = await supabase
      .from("magasin_emails")
      .update({ notify: !current })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    onChange(emails.map((e) => (e.id === id ? { ...e, notify: !current } : e)));
  };

  const deleteEmail = async (id: string) => {
    if (!confirm("Supprimer définitivement cet email de notification ?")) return;
    const { error } = await supabase.from("magasin_emails").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    onChange(emails.filter((e) => e.id !== id));
    toast.success("Email supprimé");
  };

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">
          Emails de notification
        </h2>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {emails.filter((e) => e.notify).length}/{emails.length} actif
          {emails.length > 1 ? "s" : ""}
        </span>
      </div>
      <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
        Chaque email listé recevra les nouvelles demandes clients dès qu&apos;un
        lead est créé sur ce magasin.
      </p>

      {emails.length === 0 ? (
        <p className="mb-4 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-white/[0.02]">
          Aucun email configuré. Les nouveaux leads ne déclencheront pas de
          notification tant qu&apos;au moins un email n&apos;est pas ajouté.
        </p>
      ) : (
        <ul className="mb-4 divide-y divide-gray-100 dark:divide-gray-800">
          {emails.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-gray-800 dark:text-white/90">
                  {e.email}
                </div>
                {!e.notify && (
                  <div className="mt-0.5 text-xs text-gray-400">
                    Notifications désactivées
                  </div>
                )}
              </div>

              <label className="flex cursor-pointer items-center gap-2 rounded-md border border-gray-200 px-2.5 py-1 text-xs dark:border-gray-700">
                <input
                  type="checkbox"
                  checked={e.notify}
                  onChange={() => toggleNotify(e.id, e.notify)}
                  disabled={!canEdit}
                  className="h-3.5 w-3.5 accent-[#fdd626]"
                />
                Notifier
              </label>

              {canEdit && (
                <button
                  type="button"
                  onClick={() => deleteEmail(e.id)}
                  className="rounded-md px-2 py-1 text-xs text-red-600 transition hover:bg-red-50 dark:hover:bg-red-500/10"
                  aria-label="Supprimer"
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <div className="flex flex-wrap items-end gap-2 rounded-lg bg-gray-50 p-3 dark:bg-white/[0.02]">
          <label className="min-w-0 flex-1">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
              Nouvel email
            </span>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="ex : contact@magasin.fr"
              onKeyDown={(e) => {
                if (e.key === "Enter" && newEmail.trim()) addEmail();
              }}
              className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-400 dark:border-gray-700 dark:bg-white/[0.03]"
            />
          </label>
          <button
            type="button"
            onClick={addEmail}
            disabled={adding || !newEmail.trim()}
            className="rounded-md bg-[#fdd626] px-3 py-2 text-sm font-semibold text-gray-900 transition hover:bg-[#eec302] disabled:opacity-60"
          >
            {adding ? "…" : "Ajouter"}
          </button>
        </div>
      )}
    </section>
  );
}

/**
 * Rôles pour lesquels une ligne n'existe pas encore sur ce magasin — on
 * prend le premier libre pour éviter de violer une contrainte d'unicité
 * accidentelle. Tous traités comme "notification" côté UI.
 */
function pickAvailableRole(emails: MagasinEmail[]): MagasinEmail["role"] {
  const used = new Set(emails.map((e) => e.role));
  const order: MagasinEmail["role"][] = [
    "principal",
    "adherent",
    "supplementaire_1",
    "supplementaire_2",
  ];
  return order.find((r) => !used.has(r)) ?? "supplementaire_2";
}
