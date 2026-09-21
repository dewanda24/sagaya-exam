import crypto from 'crypto';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export class AnalyticsCacheService {
  private static cache: Map<string, CacheEntry<any>> = new Map();
  private static defaultTtlMs = 5 * 60 * 1000; // 5 menit

  /**
   * Menghasilkan hash deterministik dari objek filter
   */
  static hashFilters(filters: any): string {
    if (!filters || Object.keys(filters).length === 0) return 'all';
    const sortedKeys = Object.keys(filters).sort();
    const normalized: Record<string, any> = {};
    for (const key of sortedKeys) {
      if (filters[key] !== undefined && filters[key] !== null) {
        normalized[key] = filters[key];
      }
    }
    return crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex').substring(0, 16);
  }

  /**
   * Membuat key cache tenant-isolated
   */
  static buildCacheKey(
    schoolId: string,
    reportType: string,
    filterHash: string,
    dataVersion: string = 'v1.0'
  ): string {
    return `analytics:${schoolId}:${reportType}:${filterHash}:${dataVersion}`;
  }

  /**
   * Mengambil data dari cache jika belum kedaluwarsa
   */
  static get<T>(cacheKey: string): T | null {
    const entry = this.cache.get(cacheKey);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(cacheKey);
      return null;
    }

    return entry.data;
  }

  /**
   * Menyimpan data ke cache dengan TTL tertentu
   */
  static set<T>(cacheKey: string, data: T, ttlMs: number = this.defaultTtlMs): void {
    this.cache.set(cacheKey, {
      data,
      expiresAt: Date.now() + ttlMs,
    });
  }

  /**
   * Invalidate seluruh cache milik sekolah tertentu
   */
  static invalidateSchool(schoolId: string): void {
    const prefix = `analytics:${schoolId}:`;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Hapus seluruh data cache (misalnya saat pengujian)
   */
  static clear(): void {
    this.cache.clear();
  }
}
