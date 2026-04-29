import 'server-only';
import { getAccessToken, readCredentials } from './client';
import { hashEmail, hashName, hashPhone } from './hash';

// Endpoint Google Ads REST — version gelée pour la stabilité.
// Doc : https://developers.google.com/google-ads/api/rest/reference/rest/v18/customers/uploadClickConversions
const GOOGLE_ADS_API_VERSION = 'v18';

export interface UploadInput {
  customerId: string;                 // numérique sans tirets, ex "1234567890"
  loginCustomerId?: string | null;    // MCC parent, optionnel
  conversionActionId: string;         // ID numérique
  conversionDateTime: Date;           // date du gagné
  conversionValue: number;            // montant
  currencyCode: string;               // ex "EUR"
  orderId: string;                    // = lead_id, pour dédup
  gclid?: string | null;
  gbraid?: string | null;
  wbraid?: string | null;
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  sendEnhancedConversions?: boolean;
}

export type UploadIdentifier = 'gclid' | 'gbraid' | 'wbraid' | 'enhanced_only' | 'none';

export interface UploadResult {
  ok: boolean;
  identifierUsed: UploadIdentifier;
  conversionAction: string;           // resource name complet envoyé
  request: unknown;
  response: unknown;
  partialErrors?: unknown;
  errorMessage?: string;
}

// Format Google Ads : "yyyy-MM-dd HH:mm:ss+HH:mm" — offset timezone obligatoire.
// On ancre sur UTC pour éviter toute ambiguïté.
function formatDateTime(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}+00:00`
  );
}

function buildUserIdentifiers(input: UploadInput): unknown[] {
  if (input.sendEnhancedConversions === false) return [];

  const identifiers: unknown[] = [];
  const hashedEmail = hashEmail(input.email);
  if (hashedEmail) identifiers.push({ hashedEmail });

  const hashedPhone = hashPhone(input.phone);
  if (hashedPhone) identifiers.push({ hashedPhoneNumber: hashedPhone });

  const hashedFirstName = hashName(input.firstName);
  const hashedLastName = hashName(input.lastName);
  if (hashedFirstName && hashedLastName) {
    // address_info nécessite au minimum first+last name selon la doc Google.
    identifiers.push({
      addressInfo: {
        hashedFirstName,
        hashedLastName,
      },
    });
  }

  return identifiers;
}

function pickIdentifier(input: UploadInput, hasUserIds: boolean): UploadIdentifier {
  if (input.gclid) return 'gclid';
  if (input.gbraid) return 'gbraid';
  if (input.wbraid) return 'wbraid';
  if (hasUserIds) return 'enhanced_only';
  return 'none';
}

export async function uploadClickConversion(input: UploadInput): Promise<UploadResult> {
  const userIdentifiers = buildUserIdentifiers(input);
  const identifierUsed = pickIdentifier(input, userIdentifiers.length > 0);

  const conversionAction = `customers/${input.customerId}/conversionActions/${input.conversionActionId}`;

  if (identifierUsed === 'none') {
    return {
      ok: false,
      identifierUsed,
      conversionAction,
      request: null,
      response: null,
      errorMessage:
        'Aucun identifiant disponible : ni GCLID/GBRAID/WBRAID, ni email/téléphone pour les enhanced conversions.',
    };
  }

  // Une "click conversion" peut porter à la fois un gclid ET des
  // user_identifiers (enhanced) — Google fait le matching sur ce qui est dispo.
  const conversion: Record<string, unknown> = {
    conversionAction,
    conversionDateTime: formatDateTime(input.conversionDateTime),
    conversionValue: input.conversionValue,
    currencyCode: input.currencyCode,
    orderId: input.orderId,
  };
  if (input.gclid) conversion.gclid = input.gclid;
  if (input.gbraid) conversion.gbraid = input.gbraid;
  if (input.wbraid) conversion.wbraid = input.wbraid;
  if (userIdentifiers.length > 0) conversion.userIdentifiers = userIdentifiers;

  const body = {
    conversions: [conversion],
    // partialFailure : un upload erroné ne bloque pas les autres ; on lit
    // partialFailureError dans la réponse.
    partialFailure: true,
    validateOnly: false,
  };

  const accessToken = await getAccessToken();
  const creds = readCredentials();

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    'developer-token': creds.developerToken,
    'Content-Type': 'application/json',
  };
  if (input.loginCustomerId) {
    headers['login-customer-id'] = input.loginCustomerId;
  }

  const url = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${input.customerId}:uploadClickConversions`;

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  const responseJson = await res.json().catch(() => ({}));

  if (!res.ok) {
    return {
      ok: false,
      identifierUsed,
      conversionAction,
      request: body,
      response: responseJson,
      errorMessage: extractError(responseJson) ?? `HTTP ${res.status}`,
    };
  }

  // Partial failure : l'API renvoie 200 mais des erreurs dans partialFailureError
  const partial = (responseJson as { partialFailureError?: unknown }).partialFailureError;
  if (partial) {
    return {
      ok: false,
      identifierUsed,
      conversionAction,
      request: body,
      response: responseJson,
      partialErrors: partial,
      errorMessage: extractError(partial) ?? 'partial_failure',
    };
  }

  return {
    ok: true,
    identifierUsed,
    conversionAction,
    request: body,
    response: responseJson,
  };
}

function extractError(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const obj = payload as Record<string, unknown>;
  if (typeof obj.message === 'string') return obj.message;
  const err = obj.error as Record<string, unknown> | undefined;
  if (err && typeof err.message === 'string') return err.message;
  return null;
}
