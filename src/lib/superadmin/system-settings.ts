import { queryPostgres } from '../core/postgres';

interface CacheEntry {
  data: any;
  cachedAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30 * 1000; // 30 seconds cache for lightweight zero-latency performance

/**
 * Mengambil nilai pengaturan sistem terpusat dengan in-memory cache ringan.
 */
export async function getSystemSetting<T>(key: string, defaultValue: T): Promise<T> {
  const now = Date.now();
  const cached = cache.get(key);

  if (cached && now - cached.cachedAt < CACHE_TTL_MS) {
    return cached.data as T;
  }

  try {
    const res = await queryPostgres(
      `SELECT value_json FROM system_settings WHERE key = $1 LIMIT 1;`,
      [key]
    );

    if (res.rows.length === 0) {
      cache.set(key, { data: defaultValue, cachedAt: now });
      return defaultValue;
    }

    const val = res.rows[0].value_json as T;
    cache.set(key, { data: val, cachedAt: now });
    return val;
  } catch (err) {
    console.error(`Error reading system_setting for ${key}:`, err);
    return defaultValue;
  }
}

/**
 * Mengambil seluruh pengaturan sistem (untuk halaman panel Super Admin).
 */
export async function getAllSystemSettings(): Promise<Record<string, any>> {
  try {
    const res = await queryPostgres(
      `SELECT key, value_json, description, updated_at FROM system_settings ORDER BY key ASC;`
    );

    const result: Record<string, any> = {};
    for (const r of res.rows) {
      result[r.key] = {
        value: r.value_json,
        description: r.description,
        updatedAt: r.updated_at,
      };
      cache.set(r.key, { data: r.value_json, cachedAt: Date.now() });
    }

    return result;
  } catch (err) {
    console.error('Error fetching all system_settings:', err);
    return {};
  }
}

/**
 * Menyimpan atau memperbarui pengaturan sistem oleh Super Admin.
 */
export async function updateSystemSetting(key: string, value: any, userId?: string): Promise<boolean> {
  try {
    await queryPostgres(
      `INSERT INTO system_settings (key, value_json, updated_at, updated_by)
       VALUES ($1, $2::jsonb, NOW(), $3)
       ON CONFLICT (key) DO UPDATE SET
         value_json = EXCLUDED.value_json,
         updated_at = NOW(),
         updated_by = EXCLUDED.updated_by;`,
      [key, JSON.stringify(value), userId || null]
    );

    // Invalidate local cache
    cache.set(key, { data: value, cachedAt: Date.now() });
    return true;
  } catch (err) {
    console.error(`Error updating system_setting ${key}:`, err);
    return false;
  }
}
