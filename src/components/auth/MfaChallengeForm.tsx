"use client";

import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function MfaChallengeForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/";

  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (cancelled) return;
      if (error) {
        setError(error.message);
        setBootstrapping(false);
        return;
      }
      const verified = data?.totp?.find((f) => f.status === "verified");
      if (!verified) {
        router.replace(redirectTo);
        return;
      }
      setFactorId(verified.id);
      setBootstrapping(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [redirectTo, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factorId) return;
    setError(null);
    setLoading(true);
    const supabase = createClient();
    try {
      const challenge = await supabase.auth.mfa.challenge({ factorId });
      if (challenge.error) throw challenge.error;

      const verify = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.data.id,
        code: code.trim(),
      });
      if (verify.error) throw verify.error;

      router.push(redirectTo);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Code invalide.");
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/signin");
    router.refresh();
  };

  return (
    <div className="flex flex-col flex-1 lg:w-1/2 w-full">
      <div className="flex flex-col justify-center flex-1 w-full max-w-md mx-auto">
        <div className="mb-5 sm:mb-8">
          <h1 className="mb-2 font-semibold text-gray-800 text-title-sm dark:text-white/90 sm:text-title-md">
            Vérification en deux étapes
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Saisissez le code à 6 chiffres affiché dans votre application
            d&apos;authentification.
          </p>
        </div>

        {bootstrapping ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Chargement…</p>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="space-y-6">
              <div>
                <Label>
                  Code de vérification <span className="text-error-500">*</span>
                </Label>
                <Input
                  type="text"
                  placeholder="123456"
                  defaultValue={code}
                  onChange={(e) =>
                    setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                />
              </div>

              {error && (
                <p className="text-sm text-error-500" role="alert">
                  {error}
                </p>
              )}

              <div>
                <Button
                  className="w-full"
                  size="sm"
                  disabled={loading || code.length !== 6}
                >
                  {loading ? "Vérification…" : "Valider"}
                </Button>
              </div>

              <div className="text-center">
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                >
                  Se déconnecter
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
