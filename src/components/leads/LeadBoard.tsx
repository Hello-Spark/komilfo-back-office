"use client";
import React, { useMemo, useState } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import LeadColumn from "./LeadColumn";
import LeadDrawer from "./LeadDrawer";
import {
  LEAD_COLUMN_ORDER,
  columnForStatus,
  type LeadColumn as LeadColumnId,
} from "./status";
import { useLeadsRealtime } from "@/hooks/useLeadsRealtime";
import type { LeadFull } from "@/lib/supabase/types";

interface Props {
  initialLeads: LeadFull[];
  isAdmin: boolean;
}

export default function LeadBoard({ initialLeads, isAdmin }: Props) {
  const { leads, activityCounts, error, updateStatus, logEvent, assign } =
    useLeadsRealtime(initialLeads);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = useMemo(
    () => leads.find((l) => l.id === selectedId) ?? null,
    [leads, selectedId]
  );

  const leadsByColumn = useMemo(() => {
    const map: Record<LeadColumnId, LeadFull[]> = {
      new: [],
      assigned: [],
      contacted: [],
      won: [],
      lost: [],
    };
    leads.forEach((lead) => {
      const col = columnForStatus(lead.status);
      if (col) map[col].push(lead);
    });
    return map;
  }, [leads]);

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
        <div className="shrink-0 flex flex-col gap-3 mb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white/90">
              Pipeline Leads
            </h2>
            <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
              {leads.length} lead{leads.length > 1 ? "s" : ""} · glissez une
              carte pour changer de statut
            </p>
          </div>
          {error && (
            <p className="rounded-lg bg-error-50 px-3 py-2 text-theme-xs text-error-600 dark:bg-error-500/10 dark:text-error-400">
              {error}
            </p>
          )}
        </div>

        <div className="-mx-4 md:-mx-6 overflow-x-auto">
          <div className="flex items-start min-w-max gap-4 px-4 md:gap-6 md:px-6">
            {LEAD_COLUMN_ORDER.map((col) => (
              <LeadColumn
                key={col}
                column={col}
                leads={leadsByColumn[col]}
                activityCounts={activityCounts}
                isAdmin={isAdmin}
                onDrop={updateStatus}
                onOpen={(lead) => setSelectedId(lead.id)}
              />
            ))}
          </div>
        </div>
      </div>

      <LeadDrawer
        lead={selected}
        isAdmin={isAdmin}
        onClose={() => setSelectedId(null)}
        onStatusChange={updateStatus}
        onLogEvent={logEvent}
        onAssign={assign}
      />
    </DndProvider>
  );
}
