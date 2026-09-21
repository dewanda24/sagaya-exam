/**
 * Environment variables validation and security configuration.
 * Validates critical secrets on application startup.
 */

interface EnvConfig {
  AUTH_SECRET: string;
  DATABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  NODE_ENV: string;
}

const REQUIRED_ENVS = ['AUTH_SECRET'] as const;

export function validateEnvironment(): { valid: boolean; missing: string[] } {
  const missing: string[] = [];

  for (const envKey of REQUIRED_ENVS) {
    if (!process.env[envKey] || process.env[envKey]?.trim() === '') {
      missing.push(envKey);
    }
  }

  const hasDb = !!(process.env.DATABASE_URL || process.env.DIRECT_URL);
  if (!hasDb) {
    missing.push('DATABASE_URL (or DIRECT_URL)');
  }

  if (missing.length > 0) {
    const errorMsg = `[CRITICAL SECURITY ALERT] Missing required environment variable(s): ${missing.join(', ')}. Applications will fail or run in an insecure state.`;
    console.error(errorMsg);
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}

// Run validation once on module load
if (typeof process !== 'undefined' && process.env) {
  validateEnvironment();
}
