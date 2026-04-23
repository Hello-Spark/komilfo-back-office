"use client";
import React, { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import LeadListItem from "./LeadListItem";
import LeadDrawer from "./LeadDrawer";
import LeadFilters, {
  type DateRange,
  filterLeadsByRange,
} from "./LeadFilters";
import {
  LEAD_COLUMN_ORDER,
  LEAD_COLUMN_LABEL,
  columnForStatus,
  type LeadColumn as LeadColumnId,
} from "./status";
import { useLeadsRealtime } from "@/hooks/useLeadsRealtime";
import {
  filterLeadsByMagasins,
  useMagasinFilter,
} from "@/context/MagasinFilterContext";
import type { LeadFull } from "@/lib/supabase/types";

type Filter = "all" | LeadColumnId;

interface Props {
  initialLeads: LeadFull[];
  isAdmin: boolean;
}

export default function LeadList({ initialLeads, isAdmin }: Props) {
  const { leads: rawLeads, activityCounts, error, updateStatus, logEvent, assign } =
    useLeadsRealtime(initialLeads);
  const { selectedIds, userMagasins } = useMagasinFilter();
  const leads = useMemo(
    () => filterLeadsByMagasins(rawLeads, selectedIds, userMagasins),
    [rawLeads, selectedIds, userMagasins],
  );
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>({
    preset: "all",
    from: null,
    to: null,
  });

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Sync URL ?lead=<id> -> selected drawer (palette / deep-link)
  useEffect(() => {
    const urlLeadId = searchParams.get("lead");
    if (urlLeadId && urlLeadId !== selectedId) {
      setSelectedId(urlLeadId);
    }
  }, [searchParams, selectedId]);

  const selected = useMemo(
    () => leads.find((l) => l.id === selectedId) ?? null,
    [leads, selectedId]
  );

  const openLead = (id: string) => {
    setSelectedId(id);
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("lead", id);
    router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
  };

  const closeLead = () => {
    setSelectedId(null);
    const sp = new URLSearchParams(searchParams.toString());
    sp.delete("lead");
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const dateFilteredLeads = useMemo(
    () => filterLeadsByRange(leads, dateRange),
    [leads, dateRange],
  );

  const leadsByColumn = useMemo(() => {
    const map: Record<LeadColumnId, LeadFull[]> = {
      new: [],
      assigned: [],
      contacted: [],
      won: [],
      lost: [],
    };
    dateFilteredLeads.forEach((lead) => {
      const col = columnForStatus(lead.status);
      if (col) map[col].push(lead);
    });
    return map;
  }, [dateFilteredLeads]);

  const visibleLeads = useMemo(() => {
    if (filter === "all") return dateFilteredLeads;
    return leadsByColumn[filter];
  }, [filter, dateFilteredLeads, leadsByColumn]);

  const filters: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: "Tous", count: dateFilteredLeads.length },
    ...LEAD_COLUMN_ORDER.map((col) => ({
      key: col,
      label: LEAD_COLUMN_LABEL[col],
      count: leadsByColumn[col].length,
    })),
  ];

  return (
    <>
      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
        <div className="flex flex-col gap-4 mb-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white/90">
              Liste des leads
            </h2>
            <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
              {dateFilteredLeads.length} lead
              {dateFilteredLeads.length > 1 ? "s" : ""}
              {dateRange.preset !== "all"
                ? ` dans la plage sélectionnée (sur ${leads.length})`
                : " au total"}
            </p>
          </div>
          <div className="flex flex-col gap-2 lg:items-end">
            <LeadFilters
              range={dateRange}
              onChange={setDateRange}
              leadsForExport={visibleLeads}
              totalCount={leads.length}
            />
            {error && (
              <p className="rounded-lg bg-error-50 px-3 py-2 text-theme-xs text-error-600 dark:bg-error-500/10 dark:text-error-400">
                {error}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-1 mb-6 border-b border-gray-200 dark:border-gray-800">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-theme-sm font-medium border-b-2 -mb-px transition ${
                filter === f.key
                  ? "border-brand-500 text-brand-600 dark:text-brand-400"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
            >
              {f.label}
              <span
                className={`inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full text-theme-xs ${
                  filter === f.key
                    ? "bg-brand-50 text-brand-700 dark:bg-brand-500/20 dark:text-brand-400"
                    : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                }`}
              >
                {f.count}
              </span>
            </button>
          ))}
        </div>

        {visibleLeads.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-300 bg-gray-50 py-12 text-center text-theme-sm text-gray-500 dark:border-gray-700 dark:bg-white/[0.02] dark:text-gray-400">
            Aucun lead pour le moment.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {visibleLeads.map((lead) => (
              <LeadListItem
                key={lead.id}
                lead={lead}
                activityCount={activityCounts[lead.id] ?? 0}
                isAdmin={isAdmin}
                onOpen={(l) => openLead(l.id)}
              />
            ))}
          </div>
        )}
      </div>

      <LeadDrawer
        lead={selected}
        isAdmin={isAdmin}
        onClose={closeLead}
        onStatusChange={updateStatus}
        onLogEvent={logEvent}
        onAssign={assign}
      />
    </>
  );
}
