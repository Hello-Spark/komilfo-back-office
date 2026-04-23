import 'server-only';

// Construit l'origine publique de l'app, à utiliser pour toute redirection
// ou URL absolue (emails d'invitation, signout, callback OAuth).
//
// Pourquoi : en prod derrière un reverse proxy (Coolify/Traefik), `request.url`
// reflète l'URL upstream interne — typiquement `http://localhost:3000/...`. Si
// on construit un `NextResponse.redirect(new URL('/path', request.url))`, le
// navigateur reçoit un 303 vers `localhost:3000` → cassé.
//
// Ordre de résolution :
//   1. `APP_BASE_URL`                (runtime server — prioritaire, explicite)
//   2. `NEXT_PUBLIC_APP_BASE_URL`    (build-time — fallback partagé client/server)
//   3. headers `X-Forwarded-*`       (reverse proxy correctement configuré)
//   4. header `Host` + protocole déduit
export function getPublicOrigin(request: Request): string {
  const envBase =
    process.env.APP_BASE_URL ?? process.env.NEXT_PUBLIC_APP_BASE_URL;
  if (envBase) return envBase.replace(/\/+$/, '');

  const h = request.headers;
  // `X-Forwarded-*` peut être une liste séparée par virgules (chaîne de proxies) —
  // on prend toujours la première valeur, celle du client.
  const forwardedHost = h.get('x-forwarded-host')?.split(',')[0]?.trim();
  const forwardedProto = h.get('x-forwarded-proto')?.split(',')[0]?.trim();

  const host = forwardedHost ?? h.get('host') ?? 'localhost:3000';
  const proto =
    forwardedProto ??
    (host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https');

  return `${proto}://${host}`;
}

export function buildPublicUrl(request: Request, path: string): URL {
  return new URL(path, getPublicOrigin(request) + '/');
}
