"use client";
import dynamic from "next/dynamic";
import { ApexOptions } from "apexcharts";
import type { LeadDailyPoint } from "@/lib/supabase/queries";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

interface Props {
  series: LeadDailyPoint[];
}

export default function LeadsHistogram({ series }: Props) {
  const categories = series.map((p) =>
    new Date(p.date).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
    })
  );
  const values = series.map((p) => p.count);
  const total = values.reduce((a, b) => a + b, 0);
  const max = values.reduce((a, b) => Math.max(a, b), 0);

  const options: ApexOptions = {
    chart: {
      fontFamily: "Outfit, sans-serif",
      type: "bar",
      toolbar: { show: false },
    },
    colors: ["#fdd626"],
    plotOptions: {
      bar: {
        columnWidth: "55%",
        borderRadius: 4,
      },
    },
    dataLabels: { enabled: false },
    stroke: { show: false },
    grid: {
      xaxis: { lines: { show: false } },
      yaxis: { lines: { show: true } },
    },
    xaxis: {
      categories,
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: {
        rotate: -45,
        hideOverlappingLabels: true,
        style: { fontSize: "11px", colors: "#6B7280" },
      },
    },
    yaxis: {
      labels: { style: { fontSize: "12px", colors: ["#6B7280"] } },
      min: 0,
    },
    tooltip: {
      y: { formatter: (v: number) => `${v} lead${v > 1 ? "s" : ""}` },
    },
    legend: { show: false },
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6 h-full">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            Volume de leads
          </h3>
          <p className="mt-1 text-gray-500 text-theme-sm dark:text-gray-400">
            {total} lead{total > 1 ? "s" : ""} sur 30 jours · pic à {max}/jour
          </p>
        </div>
      </div>

      <div className="max-w-full overflow-x-auto custom-scrollbar">
        <Chart
          options={options}
          series={[{ name: "Leads", data: values }]}
          type="bar"
          height={280}
        />
      </div>
    </div>
  );
}
