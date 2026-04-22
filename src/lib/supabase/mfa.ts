import { createClient } from './server';

export type AalLevel = 'aal1' | 'aal2';

export type MfaStatus = {
  currentLevel: AalLevel | null;
  nextLevel: AalLevel | null;
  hasVerifiedTotp: boolean;
  totpFactorId: string | null;
};

export async function getMfaStatus(): Promise<MfaStatus> {
  const supabase = await createClient();

  const [{ data: aal }, { data: factors }] = await Promise.all([
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    supabase.auth.mfa.listFactors(),
  ]);

  const verifiedTotp = factors?.totp?.find((f) => f.status === 'verified') ?? null;

  return {
    currentLevel: (aal?.currentLevel as AalLevel | null) ?? null,
    nextLevel: (aal?.nextLevel as AalLevel | null) ?? null,
    hasVerifiedTotp: Boolean(verifiedTotp),
    totpFactorId: verifiedTotp?.id ?? null,
  };
}
