import SignUpForm from "@/components/auth/SignUpForm";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Inscription",
  description: "Créer un compte Komilfo CRM",
  // other metadata
};

export default function SignUp() {
  return <SignUpForm />;
}
