/**
 * In-memory rate limiter with sliding window algorithm.
 * Untuk production multi-instance, ganti store ini dengan Redis.
 *
 * CATATAN: Rate limiter ini akan di-reset setiap kali server restart.
 * Untuk lingkungan single-instance (development/staging), ini sudah memadai.
 * Untuk production multi-instance, implementasikan Redis adapter.
 */

interface RateLimitEntry {
  count: number;
  windowStart: number;
  blocked: boolean;
  blockedUntil?: number;
}

// In-memory store
const store = new Map<string, RateLimitEntry>();

// Cleanup interval: hapus entry yang sudah expired setiap 5 menit
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      const windowMs = 60 * 1000; // 1 menit
      if (now - entry.windowStart > windowMs * 2) {
        store.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

export interface RateLimitConfig {
  /** Maksimum request dalam window */
  limit: number;
  /** Durasi window dalam milliseconds */
  windowMs: number;
  /** Durasi block setelah limit tercapai (ms). Default: windowMs */
  blockDurationMs?: number;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
  /** Waktu dalam ms sampai block terangkat (jika blocked) */
  retryAfterMs?: number;
}

/**
 * Check rate limit untuk key tertentu (IP, username, atau kombinasi).
 * @returns RateLimitResult — jika success=false, request harus ditolak
 */
export function checkRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  const blockDuration = config.blockDurationMs ?? config.windowMs;

  const entry = store.get(key);

  // Cek apakah masih dalam periode block
  if (entry?.blocked && entry.blockedUntil && now < entry.blockedUntil) {
    return {
      success: false,
      remaining: 0,
      resetAt: entry.blockedUntil,
      retryAfterMs: entry.blockedUntil - now,
    };
  }

  // Window sudah expired — reset
  if (!entry || now - entry.windowStart > config.windowMs) {
    store.set(key, {
      count: 1,
      windowStart: now,
      blocked: false,
    });
    return {
      success: true,
      remaining: config.limit - 1,
      resetAt: now + config.windowMs,
    };
  }

  // Increment count
  entry.count++;

  if (entry.count > config.limit) {
    entry.blocked = true;
    entry.blockedUntil = now + blockDuration;
    store.set(key, entry);
    return {
      success: false,
      remaining: 0,
      resetAt: entry.blockedUntil,
      retryAfterMs: blockDuration,
    };
  }

  store.set(key, entry);
  return {
    success: true,
    remaining: config.limit - entry.count,
    resetAt: entry.windowStart + config.windowMs,
  };
}

/**
 * Reset rate limit counter untuk key tertentu (misal: setelah login berhasil).
 */
export function resetRateLimit(key: string): void {
  store.delete(key);
}

/**
 * Rate limit presets untuk endpoint sensitif
 */
export const RATE_LIMITS = {
  /** Login: 5 percobaan / menit per IP+username, block 15 menit */
  LOGIN: {
    limit: 5,
    windowMs: 60 * 1000,
    blockDurationMs: 15 * 60 * 1000,
  } as RateLimitConfig,

  /** Login per IP: 20 percobaan / menit per IP */
  LOGIN_IP: {
    limit: 20,
    windowMs: 60 * 1000,
    blockDurationMs: 5 * 60 * 1000,
  } as RateLimitConfig,

  /** Validate token ujian: 10 percobaan / menit per IP */
  VALIDATE_TOKEN: {
    limit: 10,
    windowMs: 60 * 1000,
    blockDurationMs: 5 * 60 * 1000,
  } as RateLimitConfig,

  /** Student Exam Token Attempt (IP + token context protection) */
  EXAM_TOKEN_ATTEMPT: {
    limit: 8,
    windowMs: 60 * 1000,
    blockDurationMs: 5 * 60 * 1000,
  } as RateLimitConfig,


  /** Check card siswa: 20 percobaan / menit per IP */
  CHECK_CARD: {
    limit: 20,
    windowMs: 60 * 1000,
    blockDurationMs: 2 * 60 * 1000,
  } as RateLimitConfig,

  /** Forgot Password: 3 attempts / 15 menit per identifier + IP */
  FORGOT_PASSWORD: {
    limit: 3,
    windowMs: 15 * 60 * 1000,
    blockDurationMs: 15 * 60 * 1000,
  } as RateLimitConfig,

  /** Reset Password: 5 attempts / 15 menit per IP */
  RESET_PASSWORD: {
    limit: 5,
    windowMs: 15 * 60 * 1000,
    blockDurationMs: 15 * 60 * 1000,
  } as RateLimitConfig,

  /** Change Password: 5 attempts / 15 menit per user */
  CHANGE_PASSWORD: {
    limit: 5,
    windowMs: 15 * 60 * 1000,
    blockDurationMs: 15 * 60 * 1000,
  } as RateLimitConfig,

  /** API umum: 60 request / menit */
  GENERAL_API: {
    limit: 60,
    windowMs: 60 * 1000,
  } as RateLimitConfig,
} as const;

/**
 * Extract client IP dari Next.js request headers
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return 'unknown';
}
