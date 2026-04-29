import 'server-only';

// Auth OAuth2 pour l'API Google Ads.
//
// Variables d'env requises (côté serveur, pas NEXT_PUBLIC_) :
//   GOOGLE_ADS_DEVELOPER_TOKEN     — fourni par Google Ads (cf "API Center")
//   GOOGLE_ADS_OAUTH_CLIENT_ID     — client OAuth dans Google Cloud Console
//   GOOGLE_ADS_OAUTH_CLIENT_SECRET — secret du client OAuth
//   GOOGLE_ADS_REFRESH_TOKEN       — refresh token généré une fois pour le compte
//                                    qui a accès au compte Google Ads cible

const TOKEN_URL = 'https://oauth2.googleapis.com/token';

export interface GoogleAdsCredentials {
  developerToken: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

export function readCredentials(): GoogleAdsCredentials {
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const clientId = process.env.GOOGLE_ADS_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_ADS_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN;

  if (!developerToken || !clientId || !clientSecret || !refreshToken) {
    throw new Error(
      'Google Ads credentials manquantes. Configurer GOOGLE_ADS_DEVELOPER_TOKEN, GOOGLE_ADS_OAUTH_CLIENT_ID, GOOGLE_ADS_OAUTH_CLIENT_SECRET, GOOGLE_ADS_REFRESH_TOKEN.',
    );
  }

  return { developerToken, clientId, clientSecret, refreshToken };
}

// Cache mémoire process-local du token d'accès. Les access tokens vivent
// 1h ; on garde une marge de sécurité de 5 min.
let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getAccessToken(creds?: GoogleAdsCredentials): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 5 * 60_000) {
    return cachedToken.token;
  }

  const c = creds ?? readCredentials();
  const body = new URLSearchParams({
    client_id: c.clientId,
    client_secret: c.clientSecret,
    refresh_token: c.refreshToken,
    grant_type: 'refresh_token',
  });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OAuth token refresh failed (${res.status}): ${text}`);
  }

  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    token: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
  return json.access_token;
}
