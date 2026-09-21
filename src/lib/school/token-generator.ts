import crypto from 'crypto';

// Alfabet aman tanpa karakter mirip (menghilangkan 0, O, 1, I, L)
const SAFE_CHARS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

/**
 * Menghasilkan token ujian acak berformat 8 karakter: XXXX-XXXX (e.g. A7K9-2M4P)
 * Karakter dipilih secara kriptografis untuk mencegah tabrakan dan tebakan acak.
 */
export function generateExamToken(): string {
  const bytes = crypto.randomBytes(8);
  let part1 = '';
  let part2 = '';

  for (let i = 0; i < 4; i++) {
    part1 += SAFE_CHARS[bytes[i] % SAFE_CHARS.length];
  }
  for (let i = 4; i < 8; i++) {
    part2 += SAFE_CHARS[bytes[i] % SAFE_CHARS.length];
  }

  return `${part1}-${part2}`;
}

/**
 * Normalisasi token input dari siswa (menghapus spasi, strip, dan otomatis uppercase)
 */
export function formatTokenInput(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (cleaned.length <= 4) {
    return cleaned;
  }
  return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 8)}`;
}

/**
 * Validasi apakah token sesuai format XXXX-XXXX
 */
export function isValidTokenFormat(token: string): boolean {
  return /^[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/.test(token);
}

/**
 * Menghasilkan hash SHA-256 dari token ujian yang telah dinormalisasi.
 * Digunakan untuk lookup aman dan mencegah penyimpanan token plaintext sebagai secret.
 */
export function hashExamToken(token: string): string {
  const normalized = formatTokenInput(token);
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

