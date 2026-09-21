import crypto from 'crypto';

// In-memory reference to @node-rs/argon2 if available
let argon2Module: any = null;
let argon2Checked = false;

async function getArgon2() {
  if (argon2Checked) return argon2Module;
  argon2Checked = true;
  try {
    const { createRequire } = await import('module');
    const req = typeof require !== 'undefined' ? require : createRequire(process.cwd() + '/package.json');
    argon2Module = req('@node-rs/argon2');
    return argon2Module;
  } catch (err) {
    console.error('[CRITICAL DEBUG getArgon2]', err);
    return null;
  }
}

/**
 * Scrypt-based cryptographic KDF fallback (Standard Node.js crypto module)
 */
function hashWithScrypt(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    // Scrypt with standard OWASP-recommended parameters: N=16384, r=8, p=1, keyLen=64
    crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(`$scrypt$N=16384,r=8,p=1$${salt}$${derivedKey.toString('hex')}`);
    });
  });
}

function verifyWithScrypt(password: string, storedHash: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const parts = storedHash.split('$');
      // Format: $scrypt$N=16384,r=8,p=1$<salt>$<hash> -> parts: ['', 'scrypt', 'N=16384,r=8,p=1', salt, hash]
      if (parts.length < 5) return resolve(false);
      const salt = parts[3];
      const expectedHashHex = parts[4];

      crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (err, derivedKey) => {
        if (err) return resolve(false);
        const derivedKeyHex = derivedKey.toString('hex');
        try {
          const a = Buffer.from(derivedKeyHex, 'hex');
          const b = Buffer.from(expectedHashHex, 'hex');
          if (a.length !== b.length) return resolve(false);
          resolve(crypto.timingSafeEqual(a, b));
        } catch {
          resolve(false);
        }
      });
    } catch {
      resolve(false);
    }
  });
}

/**
 * Centralized modern password hashing.
 * Uses Argon2id (via @node-rs/argon2) by default, with cryptographic scrypt KDF fallback.
 */
export async function hashPassword(plainPassword: string): Promise<string> {
  if (!plainPassword || typeof plainPassword !== 'string') {
    throw new Error('Password wajib berupa teks yang valid.');
  }

  const argon2 = await getArgon2();
  if (argon2 && typeof argon2.hash === 'function') {
    try {
      // Argon2id with OWASP recommended configuration
      return await argon2.hash(plainPassword, {
        memoryCost: 65536, // 64 MB
        timeCost: 3,       // 3 iterations
        parallelism: 4,
        algorithm: 2,      // 2 = Argon2id
      });
    } catch (err) {
      console.warn('Argon2 hash failed, falling back to scrypt KDF:', err);
    }
  }

  // Cryptographic Scrypt Fallback
  return await hashWithScrypt(plainPassword);
}

/**
 * Verifies password against stored hash.
 * Supports:
 * - $argon2id$... (Argon2id modern format)
 * - $scrypt$... (Scrypt KDF format)
 * - sha256$<salt>$<hash> (Temporary backward compatibility with previous sprint salt format during migration)
 *
 * Explicitly REJECTS:
 * - plaintext
 * - MD5
 * - hash_xxx (mock hash)
 * - reversible encryption
 */
export async function verifyPassword(plainPassword: string, storedHash: string): Promise<boolean> {
  if (!plainPassword || !storedHash || typeof plainPassword !== 'string' || typeof storedHash !== 'string') {
    return false;
  }

  // 1. Argon2 format ($argon2id$ / $argon2i$ / $argon2d$)
  if (storedHash.startsWith('$argon2')) {
    const argon2 = await getArgon2();
    if (argon2 && typeof argon2.verify === 'function') {
      try {
        return await argon2.verify(storedHash, plainPassword);
      } catch {
        return false;
      }
    }
    return false;
  }

  // 2. Scrypt KDF format ($scrypt$)
  if (storedHash.startsWith('$scrypt$')) {
    return await verifyWithScrypt(plainPassword, storedHash);
  }

  // 3. Salted SHA-256 (sha256$<salt>$<hash> from previous sprint)
  if (storedHash.startsWith('sha256$')) {
    const parts = storedHash.split('$');
    if (parts.length === 3) {
      const saltHex = parts[1];
      const expectedHashHex = parts[2];
      const computedHash = crypto
        .createHash('sha256')
        .update(saltHex + ':' + plainPassword)
        .digest('hex');

      try {
        const a = Buffer.from(computedHash, 'hex');
        const b = Buffer.from(expectedHashHex, 'hex');
        if (a.length !== b.length) return false;
        return crypto.timingSafeEqual(a, b);
      } catch {
        return false;
      }
    }
  }

  // SECURITY: All other formats (plaintext, MD5, hash_xxx) are rejected.
  return false;
}

/**
 * Common and predictable passwords that must be rejected.
 */
const COMMON_PASSWORDS = new Set([
  'password',
  'password123',
  '12345678',
  '123456789',
  'admin123',
  'superadmin123',
  'guru123',
  'pengawas123',
  'sagaya123',
  'sagayaexam',
  'qwerty123',
  'rahasia123',
]);

export interface PasswordPolicyValidation {
  valid: boolean;
  errors: string[];
}

/**
 * Centralized password policy validation.
 * Server is the authoritative source of truth.
 */
export function validatePasswordPolicy(password: string): PasswordPolicyValidation {
  const errors: string[] = [];

  if (!password || typeof password !== 'string') {
    return { valid: false, errors: ['Kata sandi wajib diisi.'] };
  }

  const trimmed = password.trim();

  if (trimmed.length < 8) {
    errors.push('Kata sandi minimal harus 8 karakter.');
  }

  if (trimmed.length > 128) {
    errors.push('Kata sandi tidak boleh lebih dari 128 karakter.');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Kata sandi harus mengandung minimal satu huruf kecil (a-z).');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Kata sandi harus mengandung minimal satu huruf besar (A-Z).');
  }

  if (!/[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
    errors.push('Kata sandi harus mengandung minimal satu angka atau karakter khusus.');
  }

  if (COMMON_PASSWORDS.has(trimmed.toLowerCase())) {
    errors.push('Kata sandi terlalu umum atau mudah ditebak. Harap gunakan kombinasi yang lebih aman.');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
