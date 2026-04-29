"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ReplayResult {
  ok: boolean;
  pending_total?: number;
  processed?: number;
  success?: number;
  errors?: number;
  skipped?: number;
  truncated?: boolean;
  error?: string;
  detail?: string;
}

export default function ReplayConversionsButton({
  disabled,
}: {
  disabled?: boolean;
}) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ReplayResult | null>(null);

  const handleClick = async () => {
    setRunning(true);
    setResult(null);
    const res = await fetch("/api/admin/google-ads-conversions/replay", {
      method: "POST",
    });
    const body = (await res.json().catch(() => ({}))) as ReplayResult;
    setResult({ ...body, ok: res.ok && body.ok !== false });
    setRunning(false);
    if (res.ok) router.refresh();
  };

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-sm text-gray-600 dark:text-gray-400">
        Renvoie les conversions des leads gagnés des 90 derniers jours qui n&apos;ont
        pas encore eu d&apos;envoi en succès. Utile après une coupure d&apos;auth ou un
        problème API ponctuel.
      </div>
      <div className="flex flex-col items-end gap-1">
        <button
          type="button"
          onClick={handleClick}
          disabled={running || disabled}
          className="rounded-lg border border-brand-500 px-4 py-2 text-sm font-semibold text-brand-600 transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-60 dark:text-brand-400 dark:hover:bg-brand-500/10"
        >
          {running ? "Envoi en cours…" : "Renvoyer les conversions manquantes"}
        </button>
        {result && <ReplaySummary result={result} />}
      </div>
    </div>
  );
}

function ReplaySummary({ result }: { result: ReplayResult }) {
  if (!result.ok && result.error) {
    return (
      <span className="text-xs text-error-600">
        Erreur : {result.detail ?? result.error}
      </span>
    );
  }

  if ((result.pending_total ?? 0) === 0) {
    return (
      <span className="text-xs text-gray-500">
        Aucune conversion à renvoyer.
      </span>
    );
  }

  return (
    <span className="text-xs text-gray-600 dark:text-gray-400">
      {result.success ?? 0} succès · {result.errors ?? 0} erreur(s) ·{" "}
      {result.skipped ?? 0} ignoré(s)
      {result.truncated ? " — batch tronqué, relance pour continuer" : ""}
    </span>
  );
}
