"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Label from "@/components/form/Label";
import Switch from "@/components/form/switch/Switch";

interface Settings {
  id: number;
  enabled: boolean;
  customer_id: string | null;
  login_customer_id: string | null;
  conversion_action_id: string | null;
  conversion_label: string | null;
  default_value: number;
  currency: string;
  send_enhanced_conversions: boolean;
}

interface Props {
  initialSettings: Settings | null;
}

const baseInputClasses =
  "h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800";

export default function GoogleAdsSettingsForm({ initialSettings }: Props) {
  const router = useRouter();
  const s = initialSettings;
  const [enabled, setEnabled] = useState(s?.enabled ?? false);
  const [customerId, setCustomerId] = useState(s?.customer_id ?? "");
  const [loginCustomerId, setLoginCustomerId] = useState(
    s?.login_customer_id ?? "",
  );
  const [conversionActionId, setConversionActionId] = useState(
    s?.conversion_action_id ?? "",
  );
  const [conversionLabel, setConversionLabel] = useState(s?.conversion_label ?? "");
  const [defaultValue, setDefaultValue] = useState<string>(
    s?.default_value !== undefined && s?.default_value !== null
      ? String(s.default_value)
      : "0",
  );
  const [currency, setCurrency] = useState(s?.currency ?? "EUR");
  const [sendEnhanced, setSendEnhanced] = useState(
    s?.send_enhanced_conversions ?? true,
  );

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);

    const res = await fetch("/api/admin/google-ads-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enabled,
        customer_id: customerId,
        login_customer_id: loginCustomerId || null,
        conversion_action_id: conversionActionId,
        conversion_label: conversionLabel,
        default_value: Number(defaultValue) || 0,
        currency,
        send_enhanced_conversions: sendEnhanced,
      }),
    });

    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      setError(body.detail ?? body.error ?? "Erreur inconnue");
      setSaving(false);
      return;
    }

    setMessage("Paramètres enregistrés.");
    setSaving(false);
    router.refresh();
  };

  return (
    <form
      onSubmit={handleSave}
      className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900"
    >
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            Configuration
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Renseigne le compte Google Ads et la conversion offline à utiliser.
          </p>
        </div>
        <Switch
          label={enabled ? "Activé" : "Désactivé"}
          defaultChecked={enabled}
          onChange={setEnabled}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="customer_id">Customer ID Google Ads</Label>
          <input
            id="customer_id"
            type="text"
            placeholder="1234567890"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            className={baseInputClasses}
          />
          <p className="mt-1.5 text-xs text-gray-500">
            Numéro du compte (sans tirets). Visible en haut à droite dans Google Ads.
          </p>
        </div>

        <div>
          <Label htmlFor="login_customer_id">Login Customer ID (MCC)</Label>
          <input
            id="login_customer_id"
            type="text"
            placeholder="optionnel"
            value={loginCustomerId}
            onChange={(e) => setLoginCustomerId(e.target.value)}
            className={baseInputClasses}
          />
          <p className="mt-1.5 text-xs text-gray-500">
            À renseigner uniquement si l&apos;accès se fait via un compte MCC parent.
          </p>
        </div>

        <div>
          <Label htmlFor="conversion_action_id">Conversion Action ID</Label>
          <input
            id="conversion_action_id"
            type="text"
            placeholder="987654321"
            value={conversionActionId}
            onChange={(e) => setConversionActionId(e.target.value)}
            className={baseInputClasses}
          />
          <p className="mt-1.5 text-xs text-gray-500">
            Trouvable dans Google Ads → Outils → Conversions, en cliquant sur la
            conversion (champ &quot;ID&quot;).
          </p>
        </div>

        <div>
          <Label htmlFor="conversion_label">Conversion Label</Label>
          <input
            id="conversion_label"
            type="text"
            placeholder="abc123XYZ"
            value={conversionLabel}
            onChange={(e) => setConversionLabel(e.target.value)}
            className={baseInputClasses}
          />
          <p className="mt-1.5 text-xs text-gray-500">
            Pour mémoire — non envoyé à l&apos;API. Sert d&apos;aide-mémoire pour relier
            au tag côté site.
          </p>
        </div>

        <div>
          <Label htmlFor="default_value">Valeur par défaut</Label>
          <input
            id="default_value"
            type="number"
            min="0"
            step="0.01"
            placeholder="0"
            value={defaultValue}
            onChange={(e) => setDefaultValue(e.target.value)}
            className={baseInputClasses}
          />
          <p className="mt-1.5 text-xs text-gray-500">
            Utilisée si le lead n&apos;a pas de valeur spécifique au moment du gagné.
          </p>
        </div>

        <div>
          <Label htmlFor="currency">Devise</Label>
          <input
            id="currency"
            type="text"
            placeholder="EUR"
            maxLength={3}
            value={currency}
            onChange={(e) => setCurrency(e.target.value.toUpperCase())}
            className={baseInputClasses}
          />
          <p className="mt-1.5 text-xs text-gray-500">
            Code ISO 4217 sur 3 lettres (EUR, USD…).
          </p>
        </div>
      </div>

      <div className="mt-5 border-t border-gray-200 pt-5 dark:border-gray-800">
        <Switch
          label="Envoyer les enhanced conversions (email + téléphone hashés)"
          defaultChecked={sendEnhanced}
          onChange={setSendEnhanced}
        />
        <p className="mt-2 text-xs text-gray-500">
          Recommandé : permet à Google de matcher la conversion même quand le
          GCLID est expiré ou absent. Les données sont hashées en SHA-256 avant
          envoi.
        </p>
      </div>

      <div className="mt-5 flex items-center justify-between gap-4">
        <div className="text-sm">
          {message && <span className="text-success-600">{message}</span>}
          {error && <span className="text-error-600">{error}</span>}
        </div>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-semibold text-gray-900 transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </form>
  );
}
