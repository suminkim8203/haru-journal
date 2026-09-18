export function sameSiteRequest(request: Request, canonicalOrigin?: string): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true; // T06 public API also supports clients without browser Origin headers.
  try {
    const address = new URL(request.url);
    // Next.js can use an internal hostname. Use Host for local development and a fixed origin behind HTTPS proxies.
    // Forwarded host/protocol headers are not trusted by default. This check is not user authentication.
    const expected = canonicalOrigin || address.protocol + '//' + (request.headers.get('host') || address.host);
    return new URL(origin).origin === new URL(expected).origin;
  } catch { return false; }
}
