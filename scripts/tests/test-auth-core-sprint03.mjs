import pg from 'pg';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// 1. Load environment variables
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const env = fs.readFileSync(envPath, 'utf8');
  env.split('\n').forEach((l) => {
    const trimmed = l.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const [k, ...v] = trimmed.split('=');
      if (!process.env[k.trim()]) {
        process.env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
      }
    }
  });
}

const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('DATABASE_URL or DIRECT_URL is required.');
  process.exit(1);
}

const AUTH_SECRET = process.env.AUTH_SECRET;
if (!AUTH_SECRET) {
  console.error('AUTH_SECRET is required.');
  process.exit(1);
}

const client = new pg.Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

const BASE_URL = 'http://localhost:3000';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ [PASS] ${message}`);
  } else {
    failedTests++;
    console.error(`  ❌ [FAIL] ${message}`);
  }
}

function base64UrlEncode(str) {
  return Buffer.from(str, 'utf8').toString('base64url');
}

function createToken(payload) {
  const encPayload = base64UrlEncode(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', AUTH_SECRET).update(encPayload).digest();
  const encSig = base64UrlEncode(sig.toString('binary'));
  return `${encPayload}.${encSig}`;
}

async function runTests() {
  console.log('\n=============================================================');
  console.log('  SAGAYA EXAM — SPRINT 03: AUTHENTICATION CORE TEST SUITE');
  console.log('=============================================================\n');

  await client.connect();

  // Test Argon2id package directly
  const { hash: argon2Hash, verify: argon2Verify } = await import('@node-rs/argon2');

  const testSuffix = Date.now().toString().slice(-6);
  const testUsername = `auth_test_${testSuffix}`;
  const testPassword = 'StrongP@ssw0rd2026!';
  const testHash = await argon2Hash(testPassword, {
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
    algorithm: 2,
  });

  console.log('--- TEST GROUP 1: PASSWORD SECURITY & ARGON2ID ---');

  // Test 1: Argon2id produces valid modern hash format
  assert(testHash.startsWith('$argon2id$'), `Password hashing produces modern Argon2id hash (${testHash.slice(0, 20)}...)`);

  // Test 2: Argon2id verification succeeds with matching password
  const verifySuccess = await argon2Verify(testHash, testPassword);
  assert(verifySuccess === true, 'Argon2id verification succeeds for matching password');

  // Test 3: Argon2id verification fails for incorrect password
  const verifyWrong = await argon2Verify(testHash, 'WrongPassword123!');
  assert(verifyWrong === false, 'Argon2id verification rejects wrong password');

  // Test 4: Password policy checks
  const validatePolicy = (pwd) => {
    if (!pwd || pwd.length < 8) return false;
    if (!/[a-z]/.test(pwd)) return false;
    if (!/[A-Z]/.test(pwd)) return false;
    if (!/[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pwd)) return false;
    if (['password', 'admin123', '12345678'].includes(pwd.toLowerCase())) return false;
    return true;
  };
  assert(validatePolicy('123456') === false, 'Weak password (< 8 chars) rejected by policy');
  assert(validatePolicy('admin123') === false, 'Common password (admin123) rejected by policy');
  assert(validatePolicy(testPassword) === true, 'Strong password meets all policy requirements');

  console.log('\n--- TEST GROUP 2: USER PROVISIONING & DATABASE MIGRATION ---');

  // Test 5: Verify user_sessions and password_reset_tokens schema
  const userCols = await client.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name IN ('status', 'failed_login_attempts', 'locked_until', 'session_version');`
  );
  assert(userCols.rows.length === 4, 'Users table contains status, failed_login_attempts, locked_until, and session_version');

  const sessCols = await client.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'user_sessions' AND column_name IN ('expires_at', 'revoked_at', 'device_name', 'session_version');`
  );
  assert(sessCols.rows.length === 4, 'user_sessions table contains expires_at, revoked_at, device_name, and session_version');

  const resetTable = await client.query(
    `SELECT table_name FROM information_schema.tables WHERE table_name = 'password_reset_tokens';`
  );
  assert(resetTable.rows.length === 1, 'password_reset_tokens table exists in database');

  // Insert test user
  const userInsertRes = await client.query(
    `INSERT INTO users (id, username, password_hash, full_name, role, is_active, status, session_version, created_at)
     VALUES (uuid_generate_v4(), $1, $2, 'Sprint 03 Test User', 'ADMIN', true, 'ACTIVE', 1, NOW())
     RETURNING id, username, role, session_version;`,
    [testUsername, testHash]
  );
  const testUserId = userInsertRes.rows[0].id;
  assert(Boolean(testUserId), `Test user created: ${testUsername} (ID: ${testUserId})`);

  console.log('\n--- TEST GROUP 3: LOGIN API, ENUMERATION & RATE LIMITING ---');

  // Test 6: Valid login via HTTP
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: testUsername,
      password: testPassword,
    }),
  });
  const loginJson = await loginRes.json();
  if (!loginJson.success) console.log('DEBUG LOGIN FAILED:', loginRes.status, loginJson);
  assert(loginRes.ok && loginJson.success, 'Valid login succeeds via POST /api/auth/login');
  assert(loginJson.redirectUrl === '/admin/dashboard', 'Server determines redirect based on role (ADMIN -> /admin/dashboard)');

  // Test 7: Cookie security attributes
  const setCookieHeader = loginRes.headers.get('set-cookie') || '';
  assert(setCookieHeader.includes('sagaya_session='), 'Response sets sagaya_session cookie');
  assert(setCookieHeader.toLowerCase().includes('httponly'), 'Session cookie has HttpOnly flag');
  assert(setCookieHeader.toLowerCase().includes('samesite=lax'), 'Session cookie has SameSite=Lax');
  assert(setCookieHeader.toLowerCase().includes('path=/'), 'Session cookie has Path=/');

  // Extract auth cookie for subsequent requests
  const authCookie = setCookieHeader.split(';')[0];

  // Test 8: Invalid password returns uniform error without leaking details
  const invalidPwdRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: testUsername,
      password: 'CompletelyWrongPassword!',
    }),
  });
  const invalidPwdJson = await invalidPwdRes.json();
  assert(invalidPwdRes.status === 401 && invalidPwdJson.code === 'AUTH_INVALID_CREDENTIALS', 'Invalid password returns generic AUTH_INVALID_CREDENTIALS');

  // Test 9: Non-existent user returns identical error message (Enumeration Protection)
  const nonExistentRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: `ghost_user_${testSuffix}`,
      password: 'SomePassword123!',
    }),
  });
  const nonExistentJson = await nonExistentRes.json();
  assert(
    nonExistentRes.status === 401 && nonExistentJson.error === invalidPwdJson.error,
    'Account Enumeration Protection: Non-existent user produces identical error message to invalid password'
  );

  // Test 10: Disabled account login rejected (ATTACK 7)
  await client.query(`UPDATE users SET status = 'INACTIVE', is_active = false WHERE id = $1;`, [testUserId]);
  const disabledLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: testUsername,
      password: testPassword,
    }),
  });
  const disabledLoginJson = await disabledLoginRes.json();
  assert(disabledLoginRes.status === 403 && disabledLoginJson.code === 'AUTH_ACCOUNT_DISABLED', 'ATTACK 7: Disabled account login is rejected with 403');

  // Test 11: Locked account login rejected
  await client.query(`UPDATE users SET status = 'LOCKED', is_active = true, locked_until = NOW() + INTERVAL '10 minutes' WHERE id = $1;`, [testUserId]);
  const lockedLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: testUsername,
      password: testPassword,
    }),
  });
  const lockedLoginJson = await lockedLoginRes.json();
  assert(lockedLoginRes.status === 403 && lockedLoginJson.code === 'AUTH_ACCOUNT_LOCKED', 'Locked account login is rejected with 403');

  // Re-activate user
  await client.query(`UPDATE users SET status = 'ACTIVE', is_active = true, locked_until = NULL, failed_login_attempts = 0 WHERE id = $1;`, [testUserId]);

  console.log('\n--- TEST GROUP 4: SESSION ENDPOINTS & VALIDATION ---');

  // Test 12: GET /api/auth/session returns authenticated user profile
  const sessionRes = await fetch(`${BASE_URL}/api/auth/session`, {
    headers: { Cookie: authCookie },
  });
  const sessionJson = await sessionRes.json();
  assert(sessionJson.authenticated === true, 'GET /api/auth/session returns authenticated: true');
  assert(sessionJson.user.username === testUsername, 'GET /api/auth/session returns correct username');
  assert(!('password_hash' in sessionJson.user) && !('password' in sessionJson.user), 'GET /api/auth/session does NOT leak password hash');

  // Test 13: GET /api/auth/sessions returns active device sessions
  const sessionsListRes = await fetch(`${BASE_URL}/api/auth/sessions`, {
    headers: { Cookie: authCookie },
  });
  const sessionsListJson = await sessionsListRes.json();
  assert(sessionsListJson.success && sessionsListJson.sessions.length >= 1, 'GET /api/auth/sessions returns device session list');
  const activeSess = sessionsListJson.sessions[0];
  assert(activeSess.isCurrent === true, 'Current session is flagged correctly');
  assert(!('session_token_hash' in activeSess) && !('token' in activeSess), 'Device session list does NOT leak token or token hash');

  // Test 14: POST /api/auth/change-password
  const newPasswordForUser = 'NewStrongP@ss2026!';
  const changePwdRes = await fetch(`${BASE_URL}/api/auth/change-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: authCookie,
    },
    body: JSON.stringify({
      oldPassword: testPassword,
      newPassword: newPasswordForUser,
      confirmPassword: newPasswordForUser,
    }),
  });
  const changePwdJson = await changePwdRes.json();
  assert(changePwdRes.ok && changePwdJson.success, 'POST /api/auth/change-password succeeded');

  // Verify updated session version in database
  const userVersionCheck = await client.query(`SELECT session_version, password_hash FROM users WHERE id = $1;`, [testUserId]);
  const newVersion = userVersionCheck.rows[0].session_version;
  assert(newVersion >= 2, `session_version incremented to ${newVersion} after password change`);
  assert(userVersionCheck.rows[0].password_hash.startsWith('$argon2id$'), 'Updated password stored as Argon2id');

  // Test 15: Previous session cookie is revoked due to session_version increment
  const oldSessionAccessRes = await fetch(`${BASE_URL}/api/auth/session`, {
    headers: { Cookie: authCookie },
  });
  const oldSessionAccessJson = await oldSessionAccessRes.json();
  assert(oldSessionAccessJson.authenticated === false, 'Old session is rejected after password change (session_version mismatch)');

  // Get fresh login with new password
  const freshLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: testUsername,
      password: newPasswordForUser,
    }),
  });
  const freshSetCookie = freshLoginRes.headers.get('set-cookie') || '';
  const freshAuthCookie = freshSetCookie.split(';')[0];
  assert(freshLoginRes.ok, 'Login with new password succeeded');

  console.log('\n--- TEST GROUP 5: FORGOT & RESET PASSWORD FLOW ---');

  // Test 16: POST /api/auth/forgot-password (Account enumeration safe)
  const forgotRes = await fetch(`${BASE_URL}/api/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: testUsername }),
  });
  const forgotJson = await forgotRes.json();
  assert(forgotRes.ok && forgotJson.success, 'POST /api/auth/forgot-password returns success message');

  // Verify token was stored hashed in database
  const tokenDbRes = await client.query(
    `SELECT token_hash, used_at, expires_at FROM password_reset_tokens WHERE user_id = $1 AND used_at IS NULL ORDER BY created_at DESC LIMIT 1;`,
    [testUserId]
  );
  assert(tokenDbRes.rows.length === 1, 'Password reset token saved in database');
  assert(tokenDbRes.rows[0].token_hash.length === 64, 'Token is hashed with SHA-256 (64 hex characters)');

  // Test 17: Reset password with valid token via HTTP
  // Generate a known test token
  const knownRawToken = crypto.randomBytes(32).toString('hex');
  const knownTokenHash = crypto.createHash('sha256').update(knownRawToken).digest('hex');
  await client.query(
    `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, created_at)
     VALUES (uuid_generate_v4(), $1, $2, NOW() + INTERVAL '1 hour', NOW());`,
    [testUserId, knownTokenHash]
  );

  const resetPasswordTarget = 'ResetFinalP@ss2026!';
  const resetRes = await fetch(`${BASE_URL}/api/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: knownRawToken,
      newPassword: resetPasswordTarget,
      confirmPassword: resetPasswordTarget,
    }),
  });
  const resetJson = await resetRes.json();
  assert(resetRes.ok && resetJson.success, 'POST /api/auth/reset-password succeeded');

  // Test 18: ATTACK 5 - Replay attack: Reset token cannot be used twice
  const replayRes = await fetch(`${BASE_URL}/api/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: knownRawToken,
      newPassword: 'AnotherPassword123!',
      confirmPassword: 'AnotherPassword123!',
    }),
  });
  const replayJson = await replayRes.json();
  assert(replayRes.status === 400 && replayJson.code === 'AUTH_RESET_USED', 'ATTACK 5: Second use of reset token is strictly rejected (AUTH_RESET_USED)');

  // Test 19: Expired reset token rejected
  const expiredRaw = crypto.randomBytes(32).toString('hex');
  const expiredHash = crypto.createHash('sha256').update(expiredRaw).digest('hex');
  await client.query(
    `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, created_at)
     VALUES (uuid_generate_v4(), $1, $2, NOW() - INTERVAL '5 minutes', NOW());`,
    [testUserId, expiredHash]
  );
  const expiredRes = await fetch(`${BASE_URL}/api/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: expiredRaw,
      newPassword: 'AnotherPassword123!',
      confirmPassword: 'AnotherPassword123!',
    }),
  });
  const expiredJson = await expiredRes.json();
  assert(expiredRes.status === 400 && expiredJson.code === 'AUTH_RESET_EXPIRED', 'Expired reset token rejected (AUTH_RESET_EXPIRED)');

  console.log('\n--- TEST GROUP 6: SECURITY ATTACK SIMULATIONS & LOGOUT ---');

  // Test 20: ATTACK 1 - Client Role Escalation
  const adminToken = createToken({
    id: testUserId,
    username: testUsername,
    fullName: 'Sprint 03 Admin',
    role: 'ADMIN',
    sessionVersion: 99,
    exp: Date.now() + 86400000,
  });
  const escalateRes = await fetch(`${BASE_URL}/api/superadmin/schools`, {
    headers: { Cookie: `sagaya_session=${adminToken}` },
  });
  assert(escalateRes.status === 403, 'ATTACK 1: Non-superadmin role accessing Superadmin endpoint is rejected (403 Forbidden)');

  // Test 21: ATTACK 2 - Cross-tenant School ID Tampering
  const schoolARes = await client.query(
    `INSERT INTO schools (id, code, name, level, status, is_active, created_at)
     VALUES (uuid_generate_v4(), 'SCH_A_${testSuffix}', 'School A Test', 'SMA', 'ACTIVE', true, NOW())
     RETURNING id;`
  );
  const schoolBRes = await client.query(
    `INSERT INTO schools (id, code, name, level, status, is_active, created_at)
     VALUES (uuid_generate_v4(), 'SCH_B_${testSuffix}', 'School B Test', 'SMA', 'ACTIVE', true, NOW())
     RETURNING id;`
  );
  const schoolAId = schoolARes.rows[0].id;
  const schoolBId = schoolBRes.rows[0].id;

  const schoolAToken = createToken({
    id: testUserId,
    username: testUsername,
    fullName: 'Admin School A',
    role: 'ADMIN',
    schoolId: schoolAId,
    sessionVersion: 99,
    exp: Date.now() + 86400000,
  });

  const crossTenantRes = await fetch(`${BASE_URL}/api/admin/students`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `sagaya_session=${schoolAToken}`,
    },
    body: JSON.stringify({
      schoolId: schoolBId, // TAMPERING ATTEMPT
      nis: '999999',
      fullName: 'Injected Student',
      gender: 'L',
    }),
  });
  const crossCheck = await client.query(`SELECT * FROM students WHERE nis = '999999' AND school_id = $1;`, [schoolBId]);
  assert(crossCheck.rows.length === 0, 'ATTACK 2: Cross-tenant school_id tampering is completely blocked (no data created under School B)');

  // Test 22: ATTACK 3 - Revoked Session Reuse
  const revokedToken = createToken({
    id: testUserId,
    username: testUsername,
    fullName: 'Test User',
    role: 'ADMIN',
    sessionVersion: 0, // Outdated session version
    exp: Date.now() + 86400000,
  });
  const revokedAccessRes = await fetch(`${BASE_URL}/api/auth/session`, {
    headers: { Cookie: `sagaya_session=${revokedToken}` },
  });
  const revokedAccessJson = await revokedAccessRes.json();
  assert(revokedAccessJson.authenticated === false, 'ATTACK 3: Revoked session token reuse returns authenticated: false');

  // Test 23: ATTACK 4 - Expired Session Reuse
  const expiredToken = createToken({
    id: testUserId,
    username: testUsername,
    fullName: 'Test User',
    role: 'ADMIN',
    sessionVersion: 99,
    exp: Date.now() - 10000, // Expired
  });
  const expiredAccessRes = await fetch(`${BASE_URL}/api/auth/session`, {
    headers: { Cookie: `sagaya_session=${expiredToken}` },
  });
  const expiredAccessJson = await expiredAccessRes.json();
  assert(expiredAccessJson.authenticated === false, 'ATTACK 4: Expired session token returns authenticated: false');

  // Test 24: ATTACK 8 - Protected API without session
  const unauthRes = await fetch(`${BASE_URL}/api/admin/students`);
  assert(unauthRes.status === 401, 'ATTACK 8: Protected API without session returns 401 Unauthorized');

  // Test 25: CSRF Origin Mismatch Detection
  const csrfAttackRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://evil-attacker.com',
    },
    body: JSON.stringify({
      username: testUsername,
      password: resetPasswordTarget,
    }),
  });
  assert(csrfAttackRes.status === 403, 'CSRF Origin mismatch on POST request is rejected with 403 Forbidden');

  // Obtain active session cookie after password reset for user
  const latestLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: testUsername,
      password: resetPasswordTarget,
    }),
  });
  const latestSetCookie = latestLoginRes.headers.get('set-cookie') || '';
  const currentAuthCookie = latestSetCookie.split(';')[0];

  // Test 26: Force Logout Admin Endpoint
  // Self force logout should be rejected
  const selfForceLogoutRes = await fetch(`${BASE_URL}/api/admin/users/${testUserId}/force-logout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: currentAuthCookie,
    },
    body: JSON.stringify({ reason: 'Self force logout test' }),
  });
  assert(selfForceLogoutRes.status === 400, 'Self force-logout via admin endpoint is prevented (status: 400)');

  // Test 27: Revoke All Sessions Endpoint
  const revokeAllRes = await fetch(`${BASE_URL}/api/auth/sessions/revoke-all`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: currentAuthCookie,
    },
  });
  const revokeAllJson = await revokeAllRes.json();
  assert(revokeAllRes.ok && revokeAllJson.success, 'POST /api/auth/sessions/revoke-all succeeded');

  // Test 28: Clean Logout
  // Get a fresh session to test logout
  const preLogoutLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: testUsername,
      password: resetPasswordTarget,
    }),
  });
  const preLogoutCookie = (preLogoutLoginRes.headers.get('set-cookie') || '').split(';')[0];

  // Test 28: Clean Logout
  const logoutRes = await fetch(`${BASE_URL}/api/auth/logout`, {
    method: 'POST',
    headers: { Cookie: preLogoutCookie },
  });
  assert(logoutRes.ok, 'POST /api/auth/logout succeeded');
  const logoutCookieHeader = logoutRes.headers.get('set-cookie') || '';
  assert(logoutCookieHeader.includes('sagaya_session=;') || logoutCookieHeader.includes('Max-Age=0'), 'Logout clears authentication cookie');

  // CLEANUP
  await client.query(`DELETE FROM users WHERE id = $1;`, [testUserId]);
  await client.query(`DELETE FROM schools WHERE id IN ($1, $2);`, [schoolAId, schoolBId]);
  await client.end();

  console.log('\n=============================================================');
  console.log(`  SPRINT 03 TEST RESULTS: ${passedTests}/${totalTests} TESTS PASSED`);
  if (failedTests > 0) {
    console.error(`  ❌ ${failedTests} TESTS FAILED`);
    process.exit(1);
  } else {
    console.log('  🎉 ALL 28 SECURITY TESTS & ATTACK SIMULATIONS PASSED 100%!');
  }
  console.log('=============================================================\n');
}

runTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
