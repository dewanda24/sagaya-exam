/**
 * @fileoverview Barrel export untuk seluruh lib domain.
 * Import dari path ini untuk kemudahan, atau import langsung dari domain
 * masing-masing untuk lebih eksplisit.
 *
 * Domain paths:
 *  - Core (auth, session, rbac, db)  : @/lib/core/
 *  - School (ujian, soal, nilai)     : @/lib/school/
 *  - Superadmin (settings)           : @/lib/superadmin/
 *  - Supabase (server storage)       : @/lib/supabase/server
 */

// === CORE ===
export * from './core/auth';
export * from './core/postgres';
export * from './core/rbac';
export * from './core/tenant';
export * from './core/types';

// === SCHOOL DOMAIN ===
export * from './school/db-service';
export * from './school/scoring-engine';
export * from './school/token-generator';

// === SUPERADMIN DOMAIN ===
export * from './superadmin/system-settings';
