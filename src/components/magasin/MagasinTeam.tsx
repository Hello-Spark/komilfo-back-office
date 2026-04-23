"use client";

import { useState } from "react";
import { toast } from "sonner";
import { fullName } from "./types";
import type { TeamMember } from "./types";

interface Props {
  magasinId: string;
  members: TeamMember[];
  currentUserId: string;
  canEdit: boolean;
  onInvited: () => void;
  onPrimaryTransferred: () => void;
}

export default function MagasinTeam({
  magasinId,
  members,
  currentUserId,
  canEdit,
  onInvited,
  onPrimaryTransferred,
}: Props) {
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const invite = async () => {
    if (!email.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/magasin/invite-employee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          magasin_id: magasinId,
          email: email.trim(),
          first_name: firstName.trim() || undefined,
          last_name: lastName.trim() || undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.detail ?? body.error ?? `Erreur ${res.status}`);
        return;
      }
      if (body.note === "user_already_exists") {
        toast.success(body.message ?? "Rattachement créé, pas d'invitation renvoyée.");
      } else {
        toast.success("Invitation envoyée par email.");
      }
      setEmail("");
      setFirstName("");
      setLastName("");
      setShowForm(false);
      onInvited();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur réseau");
    } finally {
      setSubmitting(false);
    }
  };

  const transfer = async (newPrimaryId: string) => {
    const target = members.find((m) => m.profile_id === newPrimaryId);
    if (!target) return;
    if (
      !confirm(
        `Transférer le rôle de gérant à ${fullName(target)} ? Vous perdrez vos droits d'édition sur ce magasin.`,
      )
    ) {
      return;
    }
    const res = await fetch("/api/admin/magasin/transfer-primary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ magasin_id: magasinId, new_primary_profile_id: newPrimaryId }),
    });
    const body = await res.json();
    if (!res.ok) {
      toast.error(body.detail ?? body.error ?? `Erreur ${res.status}`);
      return;
    }
    toast.success(`${fullName(target)} est maintenant gérant`);
    onPrimaryTransferred();
  };

  const primary = members.find((m) => m.is_primary);

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">
          Équipe du magasin
        </h2>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {members.length} membre{members.length > 1 ? "s" : ""}
        </span>
      </div>

      {primary && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-[#fdd626]/50 bg-[#fdd626]/10 px-4 py-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#fdd626] text-lg font-bold text-gray-900">
            {(primary.first_name?.[0] ?? primary.email[0] ?? "?").toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-600">
              Gérant — contact principal
            </div>
            <div className="truncate text-sm font-medium text-gray-900">
              {fullName(primary)}
              {primary.profile_id === currentUserId && (
                <span className="ml-2 text-xs text-gray-500">(vous)</span>
              )}
            </div>
            <a
              href={`mailto:${primary.email}`}
              className="block truncate text-xs text-gray-600 hover:underline"
            >
              {primary.email}
            </a>
          </div>
        </div>
      )}

      {members.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-white/[0.02]">
          Aucun employé rattaché pour le moment.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
          {members.map((m) => (
            <li key={m.profile_id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-700 dark:bg-white/[0.05] dark:text-gray-200">
                {(m.first_name?.[0] ?? m.email[0] ?? "?").toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-gray-800 dark:text-white/90">
                  {fullName(m)}
                  {m.profile_id === currentUserId && (
                    <span className="ml-2 text-xs text-gray-400">(vous)</span>
                  )}
                </div>
                <div className="truncate text-xs text-gray-500 dark:text-gray-400">
                  {m.email} · {m.role === "admin" ? "Administrateur" : "Employé"}
                </div>
              </div>
              {m.is_primary ? (
                <span className="rounded-md bg-[#fdd626] px-2 py-1 text-xs font-semibold text-gray-900">
                  Gérant
                </span>
              ) : (
                canEdit && (
                  <button
                    type="button"
                    onClick={() => transfer(m.profile_id)}
                    className="rounded-md px-2.5 py-1 text-xs font-medium text-gray-600 transition hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/[0.05]"
                  >
                    Désigner gérant
                  </button>
                )
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <div className="mt-4 border-t border-gray-100 pt-4 dark:border-gray-800">
          {showForm ? (
            <div className="rounded-lg bg-gray-50 p-3 dark:bg-white/[0.02]">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email *"
                  className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-400 dark:border-gray-700 dark:bg-white/[0.03]"
                />
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Prénom"
                  className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-white/[0.03]"
                />
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Nom"
                  className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-white/[0.03]"
                />
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-md px-3 py-2 text-sm text-gray-600 transition hover:bg-gray-100"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={invite}
                  disabled={submitting || !email.trim()}
                  className="rounded-md bg-[#fdd626] px-3 py-2 text-sm font-semibold text-gray-900 transition hover:bg-[#eec302] disabled:opacity-60"
                >
                  {submitting ? "Envoi…" : "Envoyer l'invitation"}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="text-sm font-medium text-[#8a6d0a] hover:underline"
            >
              + Inviter un employé
            </button>
          )}
        </div>
      )}
    </section>
  );
}
