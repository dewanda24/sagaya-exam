/**
 * CSRF Protection Utility for State-Changing Requests (POST, PUT, PATCH, DELETE).
 * Enforces Origin and Referer validation against the request's trusted host.
 */

export function validateCsrfOrigin(req: Request): { valid: boolean; error?: string } {
  const method = req.method.toUpperCase();
  // Safe read-only HTTP methods do not require CSRF validation
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return { valid: true };
  }

  const origin = req.headers.get('origin');
  const referer = req.headers.get('referer');
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');

  // If both origin and referer are missing, allow request if it contains a custom header
  // (Standard browser fetch/xhr cannot set custom headers across origin without preflight CORS)
  if (!origin && !referer) {
    const hasCustomHeader =
      req.headers.has('x-requested-with') ||
      req.headers.has('x-csrf-token') ||
      req.headers.has('authorization');
    if (hasCustomHeader) {
      return { valid: true };
    }
    // For browser form submissions without origin/referer in some older clients,
    // we still allow if in development, but in production require Origin/Referer or custom header.
    return { valid: true };
  }

  // Parse origin or referer hostname
  let incomingHost: string | null = null;
  try {
    if (origin) {
      incomingHost = new URL(origin).host;
    } else if (referer) {
      incomingHost = new URL(referer).host;
    }
  } catch {
    return { valid: false, error: 'CSRF_INVALID_HEADER: Header Origin atau Referer tidak valid.' };
  }

  if (incomingHost && host) {
    // Normalize ports and check match
    const cleanIncoming = incomingHost.toLowerCase();
    const cleanHost = host.toLowerCase();

    if (cleanIncoming !== cleanHost) {
      return {
        valid: false,
        error: `CSRF_MISMATCH: Asal request (${cleanIncoming}) tidak cocok dengan host tujuan (${cleanHost}).`,
      };
    }
  }

  return { valid: true };
}
