"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { MagasinDetails } from "./types";
import { toast } from "sonner";

interface Props {
  magasin: MagasinDetails;
  canEdit: boolean;
  onUpdated: (m: MagasinDetails) => void;
}

export default function MagasinInfos({ magasin, canEdit, onUpdated }: Props) {
  const supabase = createClient();
  const [form, setForm] = useState({
    name: magasin.name,
    address: magasin.address ?? "",
    ville: magasin.ville ?? "",
    region: magasin.region ?? "",
    telephone_magasin: magasin.telephone_magasin ?? "",
    telephone_adherent: magasin.telephone_adherent ?? "",
    gerant_prenom: magasin.gerant_prenom ?? "",
    gerant_nom: magasin.gerant_nom ?? "",
  });
  const [saving, setSaving] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  const submit = async () => {
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      address: form.address.trim() || null,
      ville: form.ville.trim() || null,
      region: form.region.trim() || null,
      telephone_magasin: form.telephone_magasin.trim() || null,
      telephone_adherent: form.telephone_adherent.trim() || null,
      gerant_prenom: form.gerant_prenom.trim() || null,
      gerant_nom: form.gerant_nom.trim() || null,
    };
    const { data, error } = await supabase
      .from("magasins")
      .update(payload)
      .eq("id", magasin.id)
      .select("*")
      .single();
    setSaving(false);
    if (error) {
      toast.error(`Erreur : ${error.message}`);
      return;
    }
    if (data) {
      onUpdated(data as MagasinDetails);
      toast.success("Informations mises à jour");
    }
  };

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">
          Informations du magasin
        </h2>
        {!canEdit && (
          <span className="rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-500 dark:bg-white/[0.05]">
            Lecture seule
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Nom du point de vente" value={form.name} onChange={set("name")} readOnly={!canEdit} />
        <Field label="Ville" value={form.ville} onChange={set("ville")} readOnly={!canEdit} />
        <Field label="Adresse" value={form.address} onChange={set("address")} readOnly={!canEdit} />
        <Field label="Région" value={form.region} onChange={set("region")} readOnly={!canEdit} />
        <Field label="Téléphone magasin" value={form.telephone_magasin} onChange={set("telephone_magasin")} readOnly={!canEdit} />
        <Field label="Téléphone gérant" value={form.telephone_adherent} onChange={set("telephone_adherent")} readOnly={!canEdit} />
        <Field label="Prénom gérant" value={form.gerant_prenom} onChange={set("gerant_prenom")} readOnly={!canEdit} />
        <Field label="Nom gérant" value={form.gerant_nom} onChange={set("gerant_nom")} readOnly={!canEdit} />
      </div>

      {canEdit && (
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="rounded-lg bg-[#fdd626] px-4 py-2 text-sm font-semibold text-gray-900 transition hover:bg-[#eec302] disabled:opacity-60"
          >
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      )}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  readOnly,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  readOnly: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {label}
      </span>
      <input
        type="text"
        value={value}
        onChange={onChange}
        readOnly={readOnly}
        className={`w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm outline-none focus:border-gray-400 dark:border-gray-700 dark:bg-white/[0.03] dark:text-white/90 ${
          readOnly ? "cursor-not-allowed bg-gray-50 dark:bg-white/[0.02]" : ""
        }`}
      />
    </label>
  );
}
