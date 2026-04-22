"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ActivityType, LeadStatus } from "@/lib/supabase/types";
import { LEAD_COLUMN_LABEL, columnForStatus } from "../status";
import { formatRelativeDate, formatAbsoluteDate } from "./utils";

interface ActivityRow {
  id: string;
  lead_id: string;
  user_id: string | null;
  type: ActivityType;
  title: string;
  body: string | null;
  details: Record<string, unknown>;
  created_at: string;
  user: { first_name: string | null; last_name: string | null } | null;
}

interface Props {
  leadId: string;
  isAdmin: boolean;
}

const TYPE_DOT: Record<ActivityType, string> = {
  status_change: "bg-brand-500",
  note: "bg-gray-400 dark:bg-gray-500",
  assignment: "bg-blue-light-500",
  call: "bg-success-500",
  email: "bg-blue-light-500",
  meeting: "bg-warning-500",
  quote_sent: "bg-warning-500",
  document: "bg-gray-500",
};

const TYPE_LABEL: Record<ActivityType, string> = {
  status_change: "Changement de statut",
  note: "Note",
  assignment: "Assignation",
  call: "Appel",
  email: "Email",
  meeting: "RDV",
  quote_sent: "Devis envoyé",
  document: "Document",
};

function authorName(a: ActivityRow): string {
  if (!a.user && !a.user_id) return "Système";
  const first = a.user?.first_name ?? "";
  const last = a.user?.last_name ?? "";
  const full = `${first} ${last}`.trim();
  return full || "Utilisateur";
}

function statusLabelFromCandidate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const col = columnForStatus(value as LeadStatus);
  if (col) return LEAD_COLUMN_LABEL[col];
  return value;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function num(v: unknown): number | null {
  return typeof v === "number" && !Number.isNaN(v) ? v : null;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatEuro(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount);
}

const CALL_OUTCOME_LABEL: Record<string, string> = {
  reached: "A répondu",
  no_answer: "Pas de réponse",
  voicemail: "Messagerie",
  busy: "Occupé",
  wrong_number: "Mauvais numéro",
};

interface DetailLine {
  text: string;
  tone?: "neutral" | "success" | "warning" | "error";
}

function renderDetails(
  type: ActivityType,
  details: Record<string, unknown>
): DetailLine[] {
  const lines: DetailLine[] = [];
  switch (type) {
    case "status_change": {
      const from = statusLabelFromCandidate(details.from);
      const to = statusLabelFromCandidate(details.to);
      if (from && to) lines.push({ text: `De ${from} vers ${to}` });
      else if (to) lines.push({ text: `Vers ${to}` });
      break;
    }
    case "call": {
      const outcome = str(details.outcome);
      const dur = num(details.duration_min);
      const bits: string[] = [];
      if (outcome) bits.push(CALL_OUTCOME_LABEL[outcome] ?? outcome);
      if (dur) bits.push(`${dur} min`);
      if (bits.length) {
        lines.push({
          text: bits.join(" · "),
          tone:
            outcome === "reached"
              ? "success"
              : outcome === "no_answer" || outcome === "voicemail" || outcome === "busy"
              ? "warning"
              : outcome === "wrong_number"
              ? "error"
              : "neutral",
        });
      }
      break;
    }
    case "email": {
      const subject = str(details.subject);
      const bits: string[] = [];
      if (subject) bits.push(`« ${subject} »`);
      if (bits.length) lines.push({ text: bits.join(" · ") });
      break;
    }
    case "meeting": {
      const startsAt = str(details.starts_at);
      const location = str(details.location);
      if (startsAt) lines.push({ text: formatDateTime(startsAt) });
      if (location) lines.push({ text: location });
      break;
    }
    case "quote_sent": {
      const amount = num(details.amount_ht);
      const ref = str(details.quote_ref);
      const bits: string[] = [];
      if (amount !== null) bits.push(`${formatEuro(amount)} HT`);
      if (ref) bits.push(`Réf. ${ref}`);
      if (bits.length) lines.push({ text: bits.join(" · ") });
      break;
    }
    case "document": {
      const filename = str(details.filename);
      const url = str(details.url);
      if (filename) lines.push({ text: filename });
      if (url) lines.push({ text: url });
      break;
    }
    default:
      break;
  }
  return lines;
}

const EDITABLE_TYPES: ActivityType[] = [
  "note",
  "call",
  "email",
  "meeting",
  "quote_sent",
  "document",
];

export default function ActivityTimeline({ leadId, isAdmin }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!cancelled) setCurrentUserId(user?.id ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data, error: err } = await supabase
        .from("lead_activities")
        .select(
          "id, lead_id, user_id, type, title, body, details, created_at, user:profiles(first_name, last_name)"
        )
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false });
      if (cancelled) return;
      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }
      setActivities((data ?? []) as unknown as ActivityRow[]);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [leadId, supabase]);

  useEffect(() => {
    const channel = supabase
      .channel(`lead-activities-${leadId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "lead_activities",
          filter: `lead_id=eq.${leadId}`,
        },
        async (payload) => {
          const row = payload.new as ActivityRow;
          let enriched: ActivityRow = { ...row, user: null };
          if (row.user_id) {
            const { data } = await supabase
              .from("profiles")
              .select("first_name, last_name")
              .eq("id", row.user_id)
              .maybeSingle();
            if (data) {
              enriched = {
                ...enriched,
                user: data as {
                  first_name: string | null;
                  last_name: string | null;
                },
              };
            }
          }
          if (!mountedRef.current) return;
          setActivities((prev) => {
            if (prev.some((a) => a.id === enriched.id)) return prev;
            return [enriched, ...prev];
          });
          setFreshIds((prev) => {
            const next = new Set(prev);
            next.add(enriched.id);
            return next;
          });
          window.setTimeout(() => {
            if (!mountedRef.current) return;
            setFreshIds((prev) => {
              const next = new Set(prev);
              next.delete(enriched.id);
              return next;
            });
          }, 1200);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "lead_activities",
          filter: `lead_id=eq.${leadId}`,
        },
        (payload) => {
          const row = payload.new as ActivityRow;
          if (!mountedRef.current) return;
          setActivities((prev) =>
            prev.map((a) => (a.id === row.id ? { ...a, ...row, user: a.user } : a))
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "lead_activities",
          filter: `lead_id=eq.${leadId}`,
        },
        (payload) => {
          const row = payload.old as { id: string };
          if (!mountedRef.current) return;
          setActivities((prev) => prev.filter((a) => a.id !== row.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [leadId, supabase]);

  const canMutate = (a: ActivityRow): boolean => {
    if (!EDITABLE_TYPES.includes(a.type)) return false;
    if (!a.user_id) return false;
    if (isAdmin) return true;
    return !!currentUserId && a.user_id === currentUserId;
  };

  const startEdit = (a: ActivityRow) => {
    setEditingId(a.id);
    setEditDraft(a.body ?? "");
    setConfirmDeleteId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft("");
  };

  const saveEdit = async (a: ActivityRow) => {
    const trimmed = editDraft.trim();
    if (!trimmed) return;
    setBusyId(a.id);
    const { error: err } = await supabase
      .from("lead_activities")
      .update({ body: trimmed })
      .eq("id", a.id);
    if (!err) {
      // Optimistic local update; realtime will confirm.
      setActivities((prev) =>
        prev.map((x) => (x.id === a.id ? { ...x, body: trimmed } : x))
      );
      setEditingId(null);
      setEditDraft("");
    } else {
      setError(err.message);
    }
    setBusyId(null);
  };

  const handleDelete = async (a: ActivityRow) => {
    setBusyId(a.id);
    const { error: err } = await supabase
      .from("lead_activities")
      .delete()
      .eq("id", a.id);
    if (!err) {
      setActivities((prev) => prev.filter((x) => x.id !== a.id));
      setConfirmDeleteId(null);
    } else {
      setError(err.message);
    }
    setBusyId(null);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-theme-sm text-gray-500 dark:text-gray-400">
        <span className="h-2 w-2 animate-pulse rounded-full bg-brand-500" />
        Chargement de l&apos;activité...
      </div>
    );
  }

  if (error) {
    return (
      <p className="rounded-lg border border-error-200 bg-error-50 px-3 py-2 text-theme-xs text-error-600 dark:border-error-500/30 dark:bg-error-500/10">
        {error}
      </p>
    );
  }

  if (activities.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-6 text-center text-theme-sm text-gray-500 dark:border-gray-700 dark:bg-white/[0.02] dark:text-gray-400">
        Aucune activité pour le moment. Ajoutez la première ci-dessous.
      </p>
    );
  }

  return (
    <ol className="relative">
      <span
        className="absolute left-[7px] top-1 h-full w-px bg-gray-200 dark:bg-gray-800"
        aria-hidden="true"
      />
      {activities.map((a) => {
        const detailLines = renderDetails(a.type, a.details);
        const isFresh = freshIds.has(a.id);
        const editable = canMutate(a);
        const isEditing = editingId === a.id;
        const isConfirming = confirmDeleteId === a.id;
        const busy = busyId === a.id;
        return (
          <li
            key={a.id}
            className={`relative pl-6 pb-5 last:pb-0 transition duration-500 ${
              isFresh ? "animate-[fadeIn_600ms_ease-out]" : ""
            }`}
          >
            <span
              className={`absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full ring-4 ring-white dark:ring-gray-900 ${TYPE_DOT[a.type]}`}
              aria-hidden="true"
            />
            <div
              className={`group rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-white/[0.02] ${
                isFresh
                  ? "border-brand-500 shadow-sm shadow-brand-500/20 dark:border-brand-500/60"
                  : ""
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-theme-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {TYPE_LABEL[a.type]}
                  </p>
                  <p className="mt-0.5 text-theme-sm font-medium text-gray-800 dark:text-white/90">
                    {a.title}
                  </p>
                </div>
                <time
                  dateTime={a.created_at}
                  title={formatAbsoluteDate(a.created_at)}
                  className="shrink-0 text-theme-xs text-gray-500 dark:text-gray-400"
                >
                  {formatRelativeDate(a.created_at)}
                </time>
              </div>
              {detailLines.length > 0 && (
                <div className="mt-1 space-y-0.5">
                  {detailLines.map((line, idx) => (
                    <p
                      key={idx}
                      className={`text-theme-xs ${
                        line.tone === "success"
                          ? "text-success-600 dark:text-success-400"
                          : line.tone === "warning"
                          ? "text-warning-600 dark:text-warning-400"
                          : line.tone === "error"
                          ? "text-error-600 dark:text-error-400"
                          : "text-gray-600 dark:text-gray-400"
                      }`}
                    >
                      {line.text}
                    </p>
                  ))}
                </div>
              )}

              {isEditing ? (
                <div className="mt-2">
                  <textarea
                    value={editDraft}
                    onChange={(e) => setEditDraft(e.target.value)}
                    rows={3}
                    autoFocus
                    className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-theme-sm text-gray-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                  />
                  <div className="mt-2 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={cancelEdit}
                      disabled={busy}
                      className="rounded-lg px-2 py-1 text-theme-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={() => saveEdit(a)}
                      disabled={busy || !editDraft.trim()}
                      className="rounded-lg bg-brand-500 px-3 py-1 text-theme-xs font-semibold text-gray-900 transition hover:bg-brand-600 disabled:opacity-50"
                    >
                      {busy ? "..." : "Enregistrer"}
                    </button>
                  </div>
                </div>
              ) : (
                a.body && (
                  <p className="mt-2 whitespace-pre-wrap text-theme-sm text-gray-700 dark:text-gray-300">
                    {a.body}
                  </p>
                )
              )}

              <div className="mt-2 flex items-center justify-between">
                <p className="text-theme-xs text-gray-500 dark:text-gray-500">
                  par {authorName(a)}
                </p>
                {editable && !isEditing && !isConfirming && (
                  <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                    <button
                      type="button"
                      onClick={() => startEdit(a)}
                      className="rounded-md px-2 py-0.5 text-theme-xs text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.05] dark:hover:text-gray-200"
                    >
                      Modifier
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(a.id)}
                      className="rounded-md px-2 py-0.5 text-theme-xs text-error-600 hover:bg-error-50 dark:hover:bg-error-500/10"
                    >
                      Supprimer
                    </button>
                  </div>
                )}
              </div>

              {isConfirming && (
                <div className="mt-2 flex items-center justify-between gap-2 rounded-md border border-error-200 bg-error-50 px-2 py-1.5 text-theme-xs text-error-600 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-400">
                  <span>Supprimer cette note ?</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(null)}
                      disabled={busy}
                      className="rounded-md px-2 py-0.5 text-gray-600 hover:bg-white dark:text-gray-300 dark:hover:bg-white/[0.05]"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(a)}
                      disabled={busy}
                      className="rounded-md bg-error-500 px-2 py-0.5 font-semibold text-white transition hover:bg-error-600 disabled:opacity-50"
                    >
                      {busy ? "..." : "Confirmer"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
