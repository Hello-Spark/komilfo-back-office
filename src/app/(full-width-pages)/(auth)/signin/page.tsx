import SignInForm from "@/components/auth/SignInForm";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Connexion",
  description: "Connexion à Komilfo CRM",
};

export default function SignIn() {
  return <SignInForm />;
}
