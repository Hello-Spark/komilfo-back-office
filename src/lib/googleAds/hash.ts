import { createHash } from 'crypto';

// Google Ads Enhanced Conversions impose le hash SHA-256 (hex lowercase) sur
// les PII, après normalisation : trim + lowercase pour email, format E.164
// pour le téléphone, lowercase pour les noms.

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function hashEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  return sha256Hex(normalized);
}

// E.164 = "+33612345678". On enlève espaces/tirets/points/parenthèses, on
// remplace un éventuel "00" leading par "+", on suppose FR si pas de "+"
// (le BO est franco-français — ajuster si international).
export function normalizePhoneFR(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let cleaned = raw.replace(/[\s\-.()]/g, '');
  if (!cleaned) return null;
  if (cleaned.startsWith('00')) cleaned = '+' + cleaned.slice(2);
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    cleaned = '+33' + cleaned.slice(1);
  }
  if (!cleaned.startsWith('+')) cleaned = '+33' + cleaned.replace(/^0+/, '');
  return cleaned;
}

export function hashPhone(raw: string | null | undefined): string | null {
  const e164 = normalizePhoneFR(raw);
  if (!e164) return null;
  return sha256Hex(e164);
}

export function hashName(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  return sha256Hex(normalized);
}
