"use client";
import React from "react";
import { useDrop } from "react-dnd";
import LeadCard, { LEAD_CARD_TYPE } from "./LeadCard";
import {
  LEAD_COLUMN_ACCENT,
  LEAD_COLUMN_LABEL,
  type LeadColumn as LeadColumnId,
  statusForColumn,
} from "./status";
import type { LeadFull, LeadStatus } from "@/lib/supabase/types";

interface Props {
  column: LeadColumnId;
  leads: LeadFull[];
  activityCounts: Record<string, number>;
  isAdmin: boolean;
  onDrop: (leadId: string, newStatus: LeadStatus) => void;
  onOpen: (lead: LeadFull) => void;
}

export default function LeadColumn({
  column,
  leads,
  activityCounts,
  isAdmin,
  onDrop,
  onOpen,
}: Props) {
  const [{ isOver }, drop] = useDrop(
    () => ({
      accept: LEAD_CARD_TYPE,
      drop: (item: { id: string; status: LeadStatus }) => {
        const target = statusForColumn(column);
        if (item.status === target) return;
        onDrop(item.id, target);
      },
      collect: (monitor) => ({ isOver: monitor.isOver() }),
    }),
    [column, onDrop]
  );

  const setDropRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      drop(node);
    },
    [drop]
  );

  return (
    <div
      ref={setDropRef}
      className={`flex w-72 shrink-0 flex-col max-h-[calc(100dvh-16rem)] rounded-2xl border bg-gray-50 dark:bg-gray-900/40 transition ${
        isOver
          ? "border-brand-500 bg-brand-50/50 dark:border-brand-500 dark:bg-brand-500/5"
          : "border-gray-200 dark:border-gray-800"
      }`}
    >
      <div className="shrink-0 flex items-center justify-between px-4 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <span
            className={`inline-block w-2 h-2 rounded-full ${LEAD_COLUMN_ACCENT[column]}`}
          />
          <h3 className="font-semibold text-gray-800 dark:text-white/90">
            {LEAD_COLUMN_LABEL[column]}
          </h3>
          <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-gray-200 text-theme-xs text-gray-700 dark:bg-gray-700 dark:text-gray-300">
            {leads.length}
          </span>
        </div>
      </div>

      <div className="min-h-0 overflow-y-auto px-4 pb-4">
        <div className="flex flex-col gap-3">
          {leads.length === 0 ? (
            <p className="rounded-lg border border-dashed border-gray-300 bg-white py-6 text-center text-theme-xs text-gray-400 dark:border-gray-700 dark:bg-transparent">
              Aucun lead
            </p>
          ) : (
            leads.map((lead) => (
              <LeadCard
                key={lead.id}
                lead={lead}
                activityCount={activityCounts[lead.id] ?? 0}
                isAdmin={isAdmin}
                onOpen={onOpen}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
