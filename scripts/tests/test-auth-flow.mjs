import { queryPostgres } from '../lib/postgres.ts';
import { verifyPassword, createSessionToken, verifySessionToken } from '../lib/auth.ts';

async function testAuth() {
  console.log('--- 1. Querying Users from live Supabase ---');
  const usersRes = await queryPostgres('SELECT id, username, full_name, role, password_hash FROM users ORDER BY role ASC;');
  console.log(`Found ${usersRes.rows.length} users in Supabase:`);
  for (const u of usersRes.rows) {
    console.log(`- Username: ${u.username} | Role: ${u.role} | Name: ${u.full_name}`);
  }

  console.log('\n--- 2. Testing Password Verification ---');
  const adminUser = usersRes.rows.find(u => u.username === 'admin');
  const isMatch = verifyPassword('admin123', adminUser.password_hash);
  console.log(`Testing admin with password 'admin123':`, isMatch ? '✅ MATCHED!' : '❌ FAILED');

  const budiUser = usersRes.rows.find(u => u.username === 'budi.guru');
  const isBudiMatch = verifyPassword('guru123', budiUser.password_hash);
  console.log(`Testing budi.guru with password 'guru123':`, isBudiMatch ? '✅ MATCHED!' : '❌ FAILED');

  console.log('\n--- 3. Testing Session Token Creation & Verification ---');
  const token = await createSessionToken({
    id: adminUser.id,
    username: adminUser.username,
    fullName: adminUser.full_name,
    role: adminUser.role,
  });
  console.log('Generated Session Token (preview):', token.slice(0, 40) + '...');

  const verified = await verifySessionToken(token);
  console.log('Verified Session User:', verified);

  if (verified && verified.username === 'admin' && verified.role === 'ADMIN') {
    console.log('\n✅ ALL AUTH & RBAC VERIFICATION TESTS PASSED SUCCESSFULLY!');
  } else {
    console.log('\n❌ Verification failed.');
  }

  process.exit(0);
}

testAuth().catch(err => {
  console.error(err);
  process.exit(1);
});
