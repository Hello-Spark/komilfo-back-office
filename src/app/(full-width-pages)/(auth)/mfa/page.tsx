import type { Metadata } from "next";
import MfaChallengeForm from "@/components/auth/MfaChallengeForm";

export const metadata: Metadata = {
  title: "Vérification 2FA",
  description: "Saisir votre code d'authentification — Komilfo CRM",
};

export default function MfaPage() {
  return <MfaChallengeForm />;
}
