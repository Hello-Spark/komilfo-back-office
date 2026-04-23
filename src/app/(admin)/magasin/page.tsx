"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useMagasinFilter } from "@/context/MagasinFilterContext";
import { useCurrentProfile } from "@/lib/supabase/useCurrentProfile";
import MagasinInfos from "@/components/magasin/MagasinInfos";
import MagasinEmails from "@/components/magasin/MagasinEmails";
import MagasinTeam from "@/components/magasin/MagasinTeam";
import type {
  MagasinDetails,
  MagasinEmail,
  TeamMember,
} from "@/components/magasin/types";

/**
 * Page de gestion d'un magasin. Utilise le selecteur sidebar pour
 * déterminer le magasin courant :
 *   - 1 seul magasin sélectionné → on le gère
 *   - plusieurs → l'utilisateur en choisit un via un mini-picker en haut
 * Les droits d'édition sont conditionnés à `is_primary` (RLS côté DB).
 */
export default function MagasinPage() {
  const supabase = useMemo(() => createClient(), []);
  const { profile } = useCurrentProfile();
  const { userMagasins, selectedIds, loading: filterLoading } = useMagasinFilter();

  // Le magasin affiché est le 1er sélectionné par défaut. Si plusieurs
  // sélectionnés, un picker apparaît pour choisir.
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (activeId && selectedIds.includes(activeId)) return;
    setActiveId(selectedIds[0] ?? userMagasins[0]?.id ?? null);
  }, [selectedIds, userMagasins, activeId]);

  const [magasin, setMagasin] = useState<MagasinDetails | null>(null);
  const [emails, setEmails] = useState<MagasinEmail[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);

  const loadAll = useCallback(async () => {
    if (!activeId) return;
    setLoading(true);
    const [magasinRes, emailsRes, teamRes] = await Promise.all([
      supabase.from("magasins").select("*").eq("id", activeId).maybeSingle(),
      supabase
        .from("magasin_emails")
        .select("*")
        .eq("magasin_id", activeId)
        .order("created_at", { ascending: true }),
      supabase
        .from("profile_magasins")
        .select(
          "is_primary, source, profile:profiles(id, email, first_name, last_name, role)",
        )
        .eq("magasin_id", activeId),
    ]);
    if (magasinRes.error) console.error(magasinRes.error);
    if (emailsRes.error) console.error(emailsRes.error);
    if (teamRes.error) console.error(teamRes.error);

    setMagasin((magasinRes.data as MagasinDetails | null) ?? null);
    setEmails((emailsRes.data ?? []) as MagasinEmail[]);

    const teamRows = (teamRes.data ?? []) as unknown as Array<{
      is_primary: boolean;
      source: TeamMember["source"];
      profile:
        | {
            id: string;
            email: string;
            first_name: string | null;
            last_name: string | null;
            role: TeamMember["role"];
          }
        | Array<{
            id: string;
            email: string;
            first_name: string | null;
            last_name: string | null;
            role: TeamMember["role"];
          }>
        | null;
    }>;
    setMembers(
      teamRows
        .map((r) => {
          const p = Array.isArray(r.profile) ? r.profile[0] : r.profile;
          if (!p) return null;
          return {
            profile_id: p.id,
            email: p.email,
            first_name: p.first_name,
            last_name: p.last_name,
            role: p.role,
            is_primary: r.is_primary,
            source: r.source,
          } satisfies TeamMember;
        })
        .filter((m): m is TeamMember => m != null)
        .sort((a, b) => {
          if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
          return (a.first_name ?? a.email).localeCompare(b.first_name ?? b.email);
        }),
    );
    setLoading(false);
  }, [supabase, activeId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Droits : le current user est is_primary du magasin actif ?
  const canEdit = useMemo(() => {
    if (!profile) return false;
    return members.some((m) => m.profile_id === profile.id && m.is_primary);
  }, [members, profile]);

  if (filterLoading || loading || !profile) {
    return <div className="text-sm text-gray-500">Chargement…</div>;
  }

  if (userMagasins.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-600 dark:border-gray-700 dark:bg-white/[0.02] dark:text-gray-300">
        Aucun magasin rattaché à votre compte.
      </div>
    );
  }

  if (!magasin) {
    return <div className="text-sm text-gray-500">Magasin introuvable.</div>;
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Picker si plus d'un sélectionné dans la sidebar */}
      {selectedIds.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-white/[0.03]">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Gérer :
          </span>
          {userMagasins
            .filter((m) => selectedIds.includes(m.id))
            .map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setActiveId(m.id)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  m.id === activeId
                    ? "bg-[#fdd626] text-gray-900"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-white/[0.05] dark:text-gray-200 dark:hover:bg-white/[0.08]"
                }`}
              >
                {m.name}
              </button>
            ))}
        </div>
      )}

      {/* Header */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Point de vente
            </div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white/90">
              {magasin.name}
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {[magasin.ville, magasin.region].filter(Boolean).join(" · ") || "—"}
              {magasin.groupe ? ` · Groupe ${magasin.groupe}` : ""}
            </p>
          </div>
          {!canEdit && (
            <div className="rounded-md bg-gray-100 px-3 py-2 text-xs text-gray-600 dark:bg-white/[0.05]">
              Consultation uniquement — seul le gérant peut modifier.
            </div>
          )}
        </div>
      </div>

      <MagasinInfos
        magasin={magasin}
        canEdit={canEdit}
        onUpdated={(m) => setMagasin(m)}
      />

      <MagasinEmails
        magasinId={magasin.id}
        emails={emails}
        canEdit={canEdit}
        onChange={setEmails}
      />

      <MagasinTeam
        magasinId={magasin.id}
        members={members}
        currentUserId={profile.id}
        canEdit={canEdit}
        onInvited={loadAll}
        onPrimaryTransferred={loadAll}
      />
    </div>
  );
}
