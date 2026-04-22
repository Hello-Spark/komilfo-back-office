"use client";
import dynamic from "next/dynamic";
import { ApexOptions } from "apexcharts";
import type { LeadProductBreakdown } from "@/lib/supabase/queries";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

const PALETTE = [
  "#fdd626",
  "#465fff",
  "#12b76a",
  "#f04438",
  "#7c3aed",
  "#0ba5ec",
  "#f79009",
  "#e255a1",
  "#6b7280",
];

interface Props {
  breakdown: LeadProductBreakdown[];
}

export default function ProductBreakdown({ breakdown }: Props) {
  const data = breakdown.slice(0, 8);
  const total = data.reduce((a, b) => a + b.count, 0);

  if (total === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6 h-full">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
          Répartition par produit
        </h3>
        <p className="mt-6 text-center text-theme-sm text-gray-500 dark:text-gray-400">
          Aucun produit associé à un lead pour le moment.
        </p>
      </div>
    );
  }

  const options: ApexOptions = {
    chart: {
      fontFamily: "Outfit, sans-serif",
      type: "donut",
      toolbar: { show: false },
    },
    colors: PALETTE.slice(0, data.length),
    labels: data.map((d) => d.label),
    legend: { show: false },
    dataLabels: { enabled: false },
    stroke: { width: 0 },
    plotOptions: {
      pie: {
        donut: {
          size: "72%",
          labels: {
            show: true,
            name: { show: true, fontSize: "12px", color: "#6B7280" },
            value: {
              show: true,
              fontSize: "24px",
              fontWeight: 700,
              color: "#1D2939",
              formatter: (v: string) => v,
            },
            total: {
              show: true,
              label: "Total",
              formatter: () => `${total}`,
            },
          },
        },
      },
    },
    tooltip: {
      y: {
        formatter: (v: number) =>
          `${v} lead${v > 1 ? "s" : ""} (${Math.round((v / total) * 100)}%)`,
      },
    },
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6 h-full">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            Répartition par produit
          </h3>
          <p className="mt-1 text-gray-500 text-theme-sm dark:text-gray-400">
            Top {data.length} sur {total} associations
          </p>
        </div>
      </div>

      <div className="flex justify-center">
        <Chart
          options={options}
          series={data.map((d) => d.count)}
          type="donut"
          height={240}
        />
      </div>

      <div className="mt-6 flex flex-col gap-3">
        {data.map((d, i) => (
          <div
            key={d.code}
            className="flex items-center justify-between text-theme-sm"
          >
            <div className="flex items-center gap-2">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: PALETTE[i % PALETTE.length] }}
              />
              <span className="text-gray-600 dark:text-gray-300">
                {d.label}
              </span>
            </div>
            <span className="font-medium text-gray-800 dark:text-white/90">
              {d.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
