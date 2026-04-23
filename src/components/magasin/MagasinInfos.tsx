"use client";

import type { MagasinDetails } from "./types";

interface Props {
  magasin: MagasinDetails;
}

/**
 * Infos du magasin en lecture seule. Les données sont importées depuis le
 * référentiel Komilfo (CSV) et ne sont pas modifiables depuis l'app —
 * pour éviter toute divergence avec la source de vérité côté siège.
 */
export default function MagasinInfos({ magasin }: Props) {
  const rows: Array<{ label: string; value: string }> = [
    { label: "Nom du point de vente", value: magasin.name },
    { label: "Ville", value: magasin.ville ?? "—" },
    { label: "Adresse", value: magasin.address ?? "—" },
    { label: "Région", value: magasin.region ?? "—" },
    { label: "Téléphone magasin", value: magasin.telephone_magasin ?? "—" },
    { label: "Téléphone gérant", value: magasin.telephone_adherent ?? "—" },
    {
      label: "Gérant",
      value:
        [magasin.gerant_prenom, magasin.gerant_nom]
          .filter(Boolean)
          .join(" ")
          .trim() || "—",
    },
    { label: "Groupe", value: magasin.groupe ?? "—" },
  ];

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">
          Informations du magasin
        </h2>
        <span className="text-xs text-gray-400">
          Référentiel Komilfo — contactez le siège pour une correction
        </span>
      </div>

      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-2">
        {rows.map((r) => (
          <div key={r.label} className="min-w-0">
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {r.label}
            </dt>
            <dd className="mt-1 truncate text-sm text-gray-800 dark:text-white/90">
              {r.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
