import pg from 'pg';

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;

if (!connectionString) {
  console.warn('⚠️ Peringatan: DATABASE_URL atau DIRECT_URL tidak ditemukan pada environment variables.');
}

let pool: pg.Pool | null = null;

export function getPostgresPool(): pg.Pool {
  if (!pool) {
    if (!connectionString) {
      throw new Error('DATABASE_URL atau DIRECT_URL wajib dikonfigurasi di environment variables.');
    }
    pool = new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false,
      },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
  }
  return pool;
}

export async function queryPostgres(text: string, params?: any[]) {
  const p = getPostgresPool();
  return p.query(text, params);
}

export async function withTransaction<T>(
  callback: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const pool = getPostgresPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
