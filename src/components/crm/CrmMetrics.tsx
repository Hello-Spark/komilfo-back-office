import React from "react";
import Badge from "../ui/badge/Badge";
import { ArrowDownIcon, ArrowUpIcon, BoxIconLine, GroupIcon } from "@/icons";
import { getLeadStatsByStatus } from "@/lib/supabase/queries";
import type { LeadStatus } from "@/lib/supabase/types";

function sumFor(
  stats: Awaited<ReturnType<typeof getLeadStatsByStatus>>,
  statuses: LeadStatus[],
  key: "total" | "last_7d" | "last_30d"
): number {
  return stats
    .filter((r) => statuses.includes(r.status))
    .reduce((acc, r) => acc + r[key], 0);
}

function delta(current: number, previous: number): { pct: number; up: boolean } {
  if (previous === 0) {
    return { pct: current > 0 ? 100 : 0, up: current >= 0 };
  }
  const pct = ((current - previous) / previous) * 100;
  return { pct: Math.abs(Math.round(pct * 10) / 10), up: current >= previous };
}

export default async function CrmMetrics() {
  const stats = await getLeadStatsByStatus();

  const active = sumFor(stats, ["new", "assigned", "contacted"], "total");
  const wonAll = sumFor(stats, ["won"], "total");
  const won30 = sumFor(stats, ["won"], "last_30d");
  const wonPrev30 = wonAll - won30;
  const wonDelta = delta(won30, wonPrev30);

  const new7 = sumFor(stats, ["new"], "last_7d");
  const assigned7 = sumFor(stats, ["assigned"], "last_7d");
  const contacted7 = sumFor(stats, ["contacted"], "last_7d");
  const new30 = sumFor(stats, ["new"], "last_30d");

  const newPrev = new30 - new7;
  const newDelta = delta(new7, Math.max(0, newPrev / 3));

  const closed30 = wonAll + sumFor(stats, ["lost"], "total");
  const conversion = closed30 > 0 ? Math.round((wonAll / closed30) * 1000) / 10 : 0;

  const cards: Array<{
    label: string;
    value: string;
    delta: string;
    trend: "up" | "down" | "flat";
    icon: React.ReactNode;
  }> = [
    {
      label: "Leads actifs",
      value: active.toString(),
      delta: `${new7 + assigned7 + contacted7} nouveaux (7j)`,
      trend: "flat",
      icon: <GroupIcon className="text-gray-800 size-6 dark:text-white/90" />,
    },
    {
      label: "Leads gagnés (30j)",
      value: won30.toString(),
      delta: `${wonDelta.pct}%`,
      trend: wonDelta.up ? "up" : "down",
      icon: <BoxIconLine className="text-gray-800 dark:text-white/90" />,
    },
    {
      label: "Taux de conversion",
      value: `${conversion}%`,
      delta: `${newDelta.pct}% vs 30j`,
      trend: newDelta.up ? "up" : "down",
      icon: <GroupIcon className="text-gray-800 size-6 dark:text-white/90" />,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 md:gap-6">
      {cards.map((m) => (
        <div
          key={m.label}
          className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6"
        >
          <div className="flex items-center justify-center w-12 h-12 bg-gray-100 rounded-xl dark:bg-gray-800">
            {m.icon}
          </div>

          <div className="flex items-end justify-between mt-5">
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {m.label}
              </span>
              <h4 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
                {m.value}
              </h4>
            </div>
            <Badge
              color={
                m.trend === "up"
                  ? "success"
                  : m.trend === "down"
                  ? "error"
                  : "light"
              }
            >
              {m.trend === "up" ? (
                <ArrowUpIcon />
              ) : m.trend === "down" ? (
                <ArrowDownIcon />
              ) : null}
              {m.delta}
            </Badge>
          </div>
        </div>
      ))}
    </div>
  );
}
