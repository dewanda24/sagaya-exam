import './load-env.mjs';
import pg from 'pg';
import { hash } from '@node-rs/argon2';

const client = new pg.Client({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  const pwd = 'TestPassword123!';
  const h = await hash(pwd);
  const u = 'dbg_' + Date.now();
  await client.query(
    `INSERT INTO users (id, username, password_hash, full_name, role, is_active, status)
     VALUES (uuid_generate_v4(), $1, $2, 'Debug User', 'ADMIN', true, 'ACTIVE');`,
    [u, h]
  );

  const res = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: u, password: pwd })
  });

  console.log('STATUS:', res.status);
  console.log('BODY:', await res.json());

  await client.query(`DELETE FROM users WHERE username = $1;`, [u]);
  await client.end();
}

run().catch(console.error);
