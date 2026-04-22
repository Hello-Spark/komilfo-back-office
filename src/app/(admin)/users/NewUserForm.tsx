"use client";

import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Combobox from "@/components/form/Combobox";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { Magasin, UserRole } from "@/lib/supabase/types";

export default function NewUserForm({ magasins }: { magasins: Magasin[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState<UserRole>("employe_magasin");
  const [magasinId, setMagasinId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const magasinOptions = useMemo(
    () =>
      magasins.map((m) => ({
        value: m.id,
        label: m.name,
        hint: [m.code_postal, m.ville].filter(Boolean).join(" "),
      })),
    [magasins],
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        first_name: firstName,
        last_name: lastName,
        role,
        magasin_id: role === "employe_magasin" ? magasinId || null : null,
      }),
    });

    const body = await res.json();

    if (!res.ok) {
      setError(body.detail ?? body.error ?? "Erreur inconnue");
      setLoading(false);
      return;
    }

    setMessage(`Compte créé pour ${email}.`);
    setEmail("");
    setPassword("");
    setFirstName("");
    setLastName("");
    setRole("employe_magasin");
    setMagasinId("");
    setLoading(false);
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <Label>Prénom</Label>
          <Input
            type="text"
            placeholder="Prénom"
            defaultValue={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
        </div>
        <div>
          <Label>Nom</Label>
          <Input
            type="text"
            placeholder="Nom"
            defaultValue={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <Label>
            Email<span className="text-error-500">*</span>
          </Label>
          <Input
            type="email"
            placeholder="email@komilfo.fr"
            defaultValue={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <Label>
            Mot de passe initial<span className="text-error-500">*</span>
          </Label>
          <Input
            type="text"
            placeholder="Min. 8 caractères"
            defaultValue={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <Label>
            Type de compte<span className="text-error-500">*</span>
          </Label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
          >
            <option value="employe_magasin">Employé Magasin</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        {role === "employe_magasin" && (
          <div>
            <Label>
              Magasin<span className="text-error-500">*</span>
            </Label>
            <Combobox
              options={magasinOptions}
              value={magasinId}
              onChange={setMagasinId}
              placeholder="Rechercher par nom, code postal, ville…"
              emptyLabel="Aucun magasin trouvé"
            />
          </div>
        )}
      </div>

      {error && <p className="text-sm text-error-500">{error}</p>}
      {message && <p className="text-sm text-success-500">{message}</p>}

      <button
        type="submit"
        disabled={loading}
        className="inline-flex items-center justify-center rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600 disabled:opacity-60"
      >
        {loading ? "Création..." : "Créer le compte"}
      </button>
    </form>
  );
}
