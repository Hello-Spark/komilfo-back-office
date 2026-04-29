"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { LeadFull, LeadStatus, ActivityType } from "@/lib/supabase/types";

type ActivityCount = Record<string, number>;

export interface LogEventInput {
  type: ActivityType;
  title: string;
  body?: string | null;
  details?: Record<string, unknown>;
}

interface UseLeadsRealtime {
  leads: LeadFull[];
  activityCounts: ActivityCount;
  loading: boolean;
  error: string | null;
  updateStatus: (leadId: string, newStatus: LeadStatus, note?: string) => Promise<void>;
  addNote: (leadId: string, body: string) => Promise<void>;
  logEvent: (leadId: string, event: LogEventInput) => Promise<void>;
  assign: (leadId: string, profileId: string | null) => Promise<void>;
}

const LEADS_FULL_SELECT = "*";

export function useLeadsRealtime(initialLeads: LeadFull[]): UseLeadsRealtime {
  const supabase = useMemo(() => createClient(), []);
  const [leads, setLeads] = useState<LeadFull[]>(initialLeads);
  const [activityCounts, setActivityCounts] = useState<ActivityCount>({});
  const [loading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const leadsRef = useRef<LeadFull[]>(leads);
  useEffect(() => {
    leadsRef.current = leads;
  }, [leads]);

  const fetchLeadFull = useCallback(
    async (id: string): Promise<LeadFull | null> => {
      const { data, error: err } = await supabase
        .from("leads_full")
        .select(LEADS_FULL_SELECT)
        .eq("id", id)
        .maybeSingle();
      if (err) {
        setError(err.message);
        return null;
      }
      return (data as LeadFull | null) ?? null;
    },
    [supabase]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadCounts() {
      const ids = leadsRef.current.map((l) => l.id);
      if (ids.length === 0) return;
      const { data, error: err } = await supabase
        .from("lead_activities")
        .select("lead_id")
        .in("lead_id", ids);
      if (err || cancelled) return;
      const counts: ActivityCount = {};
      (data ?? []).forEach((row: { lead_id: string }) => {
        counts[row.lead_id] = (counts[row.lead_id] ?? 0) + 1;
      });
      setActivityCounts(counts);
    }

    loadCounts();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  useEffect(() => {
    const channel = supabase
      .channel("leads-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "leads" },
        async (payload) => {
          const row = payload.new as { id: string };
          const full = await fetchLeadFull(row.id);
          if (!full) return;
          setLeads((prev) => {
            if (prev.some((l) => l.id === full.id)) return prev;
            return [full, ...prev];
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "leads" },
        async (payload) => {
          const row = payload.new as { id: string };
          const full = await fetchLeadFull(row.id);
          if (!full) return;
          setLeads((prev) => {
            const exists = prev.some((l) => l.id === full.id);
            if (!exists) return [full, ...prev];
            return prev.map((l) => (l.id === full.id ? full : l));
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "leads" },
        (payload) => {
          const row = payload.old as { id: string };
          setLeads((prev) => prev.filter((l) => l.id !== row.id));
          setActivityCounts((prev) => {
            const next = { ...prev };
            delete next[row.id];
            return next;
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "lead_activities" },
        (payload) => {
          const row = payload.new as { lead_id: string };
          setActivityCounts((prev) => ({
            ...prev,
            [row.lead_id]: (prev[row.lead_id] ?? 0) + 1,
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, fetchLeadFull]);

  const logActivity = useCallback(
    async (
      leadId: string,
      type: ActivityType,
      title: string,
      body: string | null,
      details: Record<string, unknown> = {}
    ) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { error: err } = await supabase.from("lead_activities").insert({
        lead_id: leadId,
        user_id: user?.id ?? null,
        type,
        title,
        body,
        details,
      });
      if (err) setError(err.message);
    },
    [supabase]
  );

  const updateStatus = useCallback(
    async (leadId: string, newStatus: LeadStatus, note?: string) => {
      const prev = leadsRef.current.find((l) => l.id === leadId);
      if (!prev) return;
      const fromStatus = prev.status;
      if (fromStatus === newStatus) return;

      setLeads((list) =>
        list.map((l) => (l.id === leadId ? { ...l, status: newStatus } : l))
      );

      const { error: err } = await supabase
        .from("leads")
        .update({ status: newStatus })
        .eq("id", leadId);
      if (err) {
        setLeads((list) =>
          list.map((l) => (l.id === leadId ? { ...l, status: fromStatus } : l))
        );
        setError(err.message);
        return;
      }

      // Le trigger DB `log_lead_status_change` insère automatiquement l'activité
      // `status_change`. On ajoute juste une note séparée si le user en a fourni une.
      if (note && note.trim()) {
        await logActivity(leadId, "note", "Note ajoutée", note.trim());
      }

      // Conversion offline Google Ads : fire-and-forget. La route gère le
      // skip si la config est désactivée ou incomplète, et logge tout dans
      // google_ads_conversion_logs pour debug. Une erreur ici ne doit pas
      // perturber l'UI : on l'écrit silencieusement en console.
      if (newStatus === "won") {
        fetch(`/api/admin/leads/${leadId}/google-ads-conversion`, {
          method: "POST",
        })
          .then(async (res) => {
            if (!res.ok) {
              const body = await res.json().catch(() => ({}));
              console.warn("[google-ads] upload failed", body);
            }
          })
          .catch((e) => console.warn("[google-ads] upload error", e));
      }
    },
    [supabase, logActivity]
  );

  const addNote = useCallback(
    async (leadId: string, body: string) => {
      if (!body.trim()) return;
      await logActivity(leadId, "note", "Note ajoutée", body.trim());
    },
    [logActivity]
  );

  const logEvent = useCallback(
    async (leadId: string, event: LogEventInput) => {
      await logActivity(
        leadId,
        event.type,
        event.title,
        event.body ?? null,
        event.details ?? {}
      );
    },
    [logActivity]
  );

  const assign = useCallback(
    async (leadId: string, profileId: string | null) => {
      // Le trigger DB `log_lead_status_change` insère aussi l'activité `assignment`.
      const { error: err } = await supabase
        .from("leads")
        .update({ assigned_to: profileId })
        .eq("id", leadId);
      if (err) setError(err.message);
    },
    [supabase]
  );

  return {
    leads,
    activityCounts,
    loading,
    error,
    updateStatus,
    addNote,
    logEvent,
    assign,
  };
}
