"use client";
import Checkbox from "@/components/form/input/Checkbox";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { EyeCloseIcon, EyeIcon } from "@/icons";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";

type MagasinPreview = { name: string; ville: string | null; groupe: string | null };
type PreviewState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "matched"; magasins: MagasinPreview[] }
  | { status: "unmatched" };

type LookupResult = {
  email: string;
  matched: boolean;
  magasins: MagasinPreview[];
};

function looksLikeEmail(value: string) {
  const trimmed = value.trim();
  const at = trimmed.indexOf("@");
  if (at < 1 || at === trimmed.length - 1) return false;
  return trimmed.slice(at + 1).includes(".");
}

export default function SignUpForm() {
  const router = useRouter();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [cguAccepted, setCguAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [lookup, setLookup] = useState<LookupResult | null>(null);

  // Email normalisé + flag de validité dérivés au rendu — évite les setState
  // synchrones dans l'effect (react-hooks/set-state-in-effect).
  const normalizedEmail = email.trim().toLowerCase();
  const emailReady = looksLikeEmail(email);

  // Debounced lookup : seuls les résultats async atterrissent dans le state.
  useEffect(() => {
    if (!emailReady) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/auth/preview-magasin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: normalizedEmail }),
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        if (!res.ok) return;
        const json = (await res.json()) as {
          matched: boolean;
          magasins: MagasinPreview[];
        };
        if (controller.signal.aborted) return;
        setLookup({
          email: normalizedEmail,
          matched: json.matched,
          magasins: json.magasins,
        });
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          // Silencieux : on laisse l'UI sur "checking" plutôt que d'afficher
          // une erreur pour un check non bloquant.
        }
      }
    }, 400);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [normalizedEmail, emailReady]);

  // État du feedback dérivé : idle si email invalide, checking tant que le
  // résultat ne correspond pas à l'email courant, sinon matched/unmatched.
  const preview: PreviewState = !emailReady
    ? { status: "idle" }
    : !lookup || lookup.email !== normalizedEmail
      ? { status: "checking" }
      : lookup.matched
        ? { status: "matched", magasins: lookup.magasins }
        : { status: "unmatched" };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (!cguAccepted) {
      setError("Veuillez accepter les conditions pour créer un compte.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { first_name: firstName, last_name: lastName },
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    const magasinNote =
      preview.status === "matched"
        ? ` Vous serez automatiquement rattaché à ${preview.magasins.length === 1 ? "votre magasin" : `${preview.magasins.length} magasins`} après confirmation.`
        : " Un administrateur Komilfo vous rattachera à votre magasin une fois votre compte validé.";

    if (data.session) {
      router.push("/");
      router.refresh();
      return;
    }

    setMessage(
      `Compte créé. Vérifiez votre boîte mail pour confirmer votre adresse.${magasinNote}`,
    );
    setLoading(false);
  };

  return (
    <div className="flex flex-col flex-1 lg:w-1/2 w-full overflow-y-auto no-scrollbar">
      <div className="flex flex-col justify-center flex-1 w-full max-w-md mx-auto">
        <div className="mb-5 sm:mb-8">
          <h1 className="mb-2 font-semibold text-gray-800 text-title-sm dark:text-white/90 sm:text-title-md">
            Créer un compte
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Réservé au personnel Komilfo. Le rôle et le rattachement magasin seront
            configurés par un administrateur.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <Label>
                  Prénom<span className="text-error-500">*</span>
                </Label>
                <Input
                  type="text"
                  placeholder="Prénom"
                  defaultValue={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>
              <div>
                <Label>
                  Nom<span className="text-error-500">*</span>
                </Label>
                <Input
                  type="text"
                  placeholder="Nom"
                  defaultValue={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label>
                Email<span className="text-error-500">*</span>
              </Label>
              <Input
                type="email"
                placeholder="vous@komilfo.fr"
                defaultValue={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <MagasinPreviewCard state={preview} />
            </div>
            <div>
              <Label>
                Mot de passe<span className="text-error-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  placeholder="Minimum 8 caractères"
                  type={showPassword ? "text" : "password"}
                  defaultValue={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <span
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute z-30 -translate-y-1/2 cursor-pointer right-4 top-1/2"
                >
                  {showPassword ? (
                    <EyeIcon className="fill-gray-500 dark:fill-gray-400" />
                  ) : (
                    <EyeCloseIcon className="fill-gray-500 dark:fill-gray-400" />
                  )}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Checkbox
                className="w-5 h-5"
                checked={cguAccepted}
                onChange={setCguAccepted}
              />
              <p className="inline-block font-normal text-gray-500 dark:text-gray-400">
                En créant un compte vous acceptez les{" "}
                <span className="text-gray-800 dark:text-white/90">
                  conditions d&apos;utilisation
                </span>{" "}
                et la{" "}
                <span className="text-gray-800 dark:text-white">
                  politique de confidentialité
                </span>
                .
              </p>
            </div>

            {error && (
              <p className="text-sm text-error-500" role="alert">
                {error}
              </p>
            )}
            {message && (
              <p className="text-sm text-success-500" role="status">
                {message}
              </p>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center justify-center w-full px-4 py-3 text-sm font-medium text-gray-900 transition rounded-lg bg-brand-500 shadow-theme-xs hover:bg-brand-600 disabled:opacity-60"
              >
                {loading ? "Création..." : "Créer mon compte"}
              </button>
            </div>
          </div>
        </form>

        <div className="mt-5">
          <p className="text-sm font-normal text-center text-gray-700 dark:text-gray-400 sm:text-start">
            Vous avez déjà un compte ?{" "}
            <Link
              href="/signin"
              className="text-brand-500 hover:text-brand-600 dark:text-brand-400"
            >
              Se connecter
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function MagasinPreviewCard({ state }: { state: PreviewState }) {
  if (state.status === "idle") return null;

  if (state.status === "checking") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="mt-2 flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
      >
        <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
        Vérification du rattachement magasin...
      </div>
    );
  }

  if (state.status === "matched") {
    const multiple = state.magasins.length > 1;
    return (
      <div
        role="status"
        aria-live="polite"
        className="mt-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2.5 dark:border-brand-800 dark:bg-brand-950/40"
      >
        <div className="flex items-center gap-2 text-sm font-medium text-brand-900 dark:text-brand-200">
          <svg
            className="h-4 w-4 flex-shrink-0"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          {multiple
            ? `${state.magasins.length} magasins trouvés pour cet email`
            : "Magasin trouvé pour cet email"}
        </div>
        <ul className="mt-1.5 space-y-0.5 text-xs text-brand-800 dark:text-brand-300">
          {state.magasins.map((m, i) => (
            <li key={`${m.name}-${i}`}>
              <span className="font-medium">{m.name}</span>
              {m.ville ? ` — ${m.ville}` : ""}
              {m.groupe ? ` · ${m.groupe}` : ""}
            </li>
          ))}
        </ul>
        <p className="mt-1.5 text-xs text-brand-700 dark:text-brand-400">
          Votre compte sera rattaché automatiquement après confirmation.
        </p>
      </div>
    );
  }

  // unmatched
  return (
    <div
      role="status"
      aria-live="polite"
      className="mt-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 dark:border-gray-700 dark:bg-gray-800"
    >
      <div className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
        <svg
          className="h-4 w-4 flex-shrink-0 mt-0.5 text-gray-400"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden
        >
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
            clipRule="evenodd"
          />
        </svg>
        <div>
          <p className="font-medium">Aucun magasin associé à cet email</p>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            Vous pouvez créer votre compte : un administrateur Komilfo vous
            rattachera à votre magasin après validation.
          </p>
        </div>
      </div>
    </div>
  );
}
