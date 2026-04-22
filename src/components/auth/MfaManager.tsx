"use client";

import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

type Props = {
  hasVerifiedTotp: boolean;
  currentLevel: "aal1" | "aal2" | null;
};

type Enrollment = {
  factorId: string;
  qrCode: string;
  secret: string;
  uri: string;
};

export default function MfaManager({ hasVerifiedTotp, currentLevel }: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const cleanupUnverifiedFactors = useCallback(async () => {
    const { data } = await supabase.auth.mfa.listFactors();
    const stale = data?.totp?.filter((f) => f.status !== "verified") ?? [];
    await Promise.all(
      stale.map((f) => supabase.auth.mfa.unenroll({ factorId: f.id })),
    );
  }, [supabase]);

  const handleEnroll = async () => {
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      await cleanupUnverifiedFactors();
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `Komilfo CRM — ${new Date().toISOString().slice(0, 10)}`,
      });
      if (error) throw error;
      if (!data) throw new Error("Aucune donnée d'enrôlement reçue.");
      setEnrollment({
        factorId: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
        uri: data.totp.uri,
      });
      setCode("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur d'enrôlement.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollment) return;
    setError(null);
    setLoading(true);
    try {
      const challenge = await supabase.auth.mfa.challenge({
        factorId: enrollment.factorId,
      });
      if (challenge.error) throw challenge.error;

      const verify = await supabase.auth.mfa.verify({
        factorId: enrollment.factorId,
        challengeId: challenge.data.id,
        code: code.trim(),
      });
      if (verify.error) throw verify.error;

      setEnrollment(null);
      setCode("");
      setMessage("Authentification à deux facteurs activée.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Code invalide.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEnroll = async () => {
    if (!enrollment) return;
    setLoading(true);
    try {
      await supabase.auth.mfa.unenroll({ factorId: enrollment.factorId });
      setEnrollment(null);
      setCode("");
      setError(null);
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async () => {
    setError(null);
    setMessage(null);
    if (currentLevel !== "aal2") {
      setError(
        "Pour désactiver le 2FA, vous devez d'abord vous authentifier avec votre code TOTP lors de la connexion.",
      );
      return;
    }
    if (
      !window.confirm(
        "Désactiver l'authentification à deux facteurs ? Votre compte sera moins protégé.",
      )
    ) {
      return;
    }
    setLoading(true);
    try {
      const { data: factors, error: listErr } = await supabase.auth.mfa.listFactors();
      if (listErr) throw listErr;
      const verified = factors?.totp?.filter((f) => f.status === "verified") ?? [];
      for (const f of verified) {
        const { error } = await supabase.auth.mfa.unenroll({ factorId: f.id });
        if (error) throw error;
      }
      setMessage("Authentification à deux facteurs désactivée.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible de désactiver.");
    } finally {
      setLoading(false);
    }
  };

  if (hasVerifiedTotp && !enrollment) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-success-500/40 bg-success-50 p-4 text-sm text-success-700 dark:border-success-500/30 dark:bg-success-500/10 dark:text-success-300">
          <strong className="font-semibold">2FA activé.</strong> Un code à 6 chiffres
          vous est demandé à chaque connexion via votre application
          d&apos;authentification.
        </div>
        {message && (
          <p className="text-sm text-success-600 dark:text-success-400">{message}</p>
        )}
        {error && (
          <p className="text-sm text-error-500" role="alert">
            {error}
          </p>
        )}
        <Button variant="outline" size="sm" onClick={handleDisable} disabled={loading}>
          {loading ? "Désactivation…" : "Désactiver le 2FA"}
        </Button>
        {currentLevel !== "aal2" && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Pour désactiver, déconnectez-vous puis reconnectez-vous en validant votre
            code TOTP.
          </p>
        )}
      </div>
    );
  }

  if (enrollment) {
    return (
      <div className="space-y-5">
        <div className="space-y-2">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            1. Scannez ce QR code avec Google Authenticator, Authy, 1Password, Raycast
            ou toute autre application TOTP.
          </p>
          <div className="inline-flex rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-white/[0.03]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={enrollment.qrCode}
              alt="QR code TOTP"
              width={200}
              height={200}
            />
          </div>
          <details className="text-xs text-gray-500 dark:text-gray-400">
            <summary className="cursor-pointer">
              Impossible de scanner ? Saisir la clé manuellement
            </summary>
            <code className="mt-2 block break-all rounded bg-gray-100 px-2 py-1 font-mono text-gray-700 dark:bg-gray-800 dark:text-gray-200">
              {enrollment.secret}
            </code>
          </details>
        </div>

        <form onSubmit={handleVerify} className="space-y-4">
          <div>
            <Label>
              2. Saisissez le code à 6 chiffres affiché dans votre application
            </Label>
            <Input
              type="text"
              placeholder="123456"
              defaultValue={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            />
          </div>

          {error && (
            <p className="text-sm text-error-500" role="alert">
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <Button size="sm" disabled={loading || code.length !== 6}>
              {loading ? "Vérification…" : "Activer le 2FA"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCancelEnroll}
              disabled={loading}
            >
              Annuler
            </Button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600 dark:text-gray-300">
        L&apos;authentification à deux facteurs ajoute une couche de sécurité : après
        votre mot de passe, un code à 6 chiffres généré par une application
        d&apos;authentification vous sera demandé.
      </p>
      {message && (
        <p className="text-sm text-success-600 dark:text-success-400">{message}</p>
      )}
      {error && (
        <p className="text-sm text-error-500" role="alert">
          {error}
        </p>
      )}
      <Button size="sm" onClick={handleEnroll} disabled={loading}>
        {loading ? "Initialisation…" : "Activer le 2FA"}
      </Button>
    </div>
  );
}
