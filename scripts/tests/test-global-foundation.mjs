import http from 'http';

const BASE_URL = 'http://localhost:3000';

async function testEndpoint(name, url, options = {}) {
  try {
    const res = await fetch(url, options);
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text.substring(0, 100);
    }
    console.log(`[TEST] ${name}: Status ${res.status} | Output:`, typeof data === 'object' ? JSON.stringify(data) : data);
    return { status: res.status, data, headers: res.headers };
  } catch (err) {
    console.error(`[FAIL] ${name}:`, err.message);
    return { error: err.message };
  }
}

async function runTests() {
  console.log('=== UJI COBA KEAMANAN & RBAC FONDASI GLOBAL ===\n');

  // 1. Unauthenticated test on questions (previously leaked all questions without login)
  console.log('1. Menguji /api/admin/questions tanpa login (Harus 401)...');
  await testEndpoint('GET questions (no auth)', `${BASE_URL}/api/admin/questions`);

  // 2. Unauthenticated test on proctor monitoring (previously leaked all monitoring without login)
  console.log('\n2. Menguji /api/proctor/monitoring tanpa login (Harus 401)...');
  await testEndpoint('GET proctor monitoring (no auth)', `${BASE_URL}/api/proctor/monitoring`);

  // 3. Unauthenticated test on proctor recovery (previously allowed resetting devices / adding time without login)
  console.log('\n3. Menguji /api/proctor/recovery tanpa login (Harus 401)...');
  await testEndpoint('POST proctor recovery (no auth)', `${BASE_URL}/api/proctor/recovery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'ADD_TIME', participantId: 'dummy-id', additionalMinutes: 100 }),
  });

  // 4. Login as Guru (budi.guru / hash_guru123)
  console.log('\n4. Login sebagai GURU (budi.guru)...');
  const loginRes = await testEndpoint('POST login guru', `${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'budi.guru', password: 'guru123' }),
  });

  const cookieHeader = loginRes.headers?.get('set-cookie');
  const sessionCookie = cookieHeader ? cookieHeader.split(';')[0] : '';

  if (sessionCookie) {
    console.log('\nCookie session berhasil didapatkan.');

    // 5. Guru calling allowed endpoint: GET /api/admin/questions (Harus 200)
    console.log('\n5. Guru mengakses /api/admin/questions (Harus 200 OK)...');
    await testEndpoint('GET questions as GURU', `${BASE_URL}/api/admin/questions`, {
      headers: { Cookie: sessionCookie },
    });

    // 6. Guru trying to access /api/admin/teachers (Harus 403 Forbidden - Privilege Escalation Prevention)
    console.log('\n6. Guru mencoba mengakses /api/admin/teachers (Harus 403 Forbidden)...');
    await testEndpoint('GET teachers as GURU', `${BASE_URL}/api/admin/teachers`, {
      headers: { Cookie: sessionCookie },
    });

    // 7. Guru trying to POST a new admin in /api/admin/teachers (Harus 403 Forbidden)
    console.log('\n7. Guru mencoba membuat akun Admin baru di /api/admin/teachers (Harus 403 Forbidden)...');
    await testEndpoint('POST teacher as GURU', `${BASE_URL}/api/admin/teachers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
      body: JSON.stringify({ username: 'hacker.admin', password: '123', fullName: 'Hacker', role: 'ADMIN' }),
    });
  } else {
    console.warn('⚠️ Tidak mendapatkan session cookie dari login. Pastikan server lokal aktif.');
  }

  console.log('\n=== PENGUJIAN SELESAI ===');
}

runTests();
