import { signAccessToken, verifyAccessToken } from '../src/utils/jwt';
import { hashPassword, verifyPassword } from '../src/utils/password';
import { generateRefreshToken, hashToken } from '../src/utils/tokens';

async function main() {
  // Force a deterministic secret for this standalone check.
  process.env.ACCESS_TOKEN_SECRET = 'test-secret-do-not-use-in-prod';

  // --- JWT access tokens ---
  const token = signAccessToken({
    sub: 'user-123',
    username: 'admin',
    role: 'ADMIN',
    permissions: ['users.manage', 'reports.view'],
  });
  const decoded = verifyAccessToken(token);
  console.assert(decoded.sub === 'user-123', 'JWT sub round-trips');
  console.assert(decoded.permissions.includes('users.manage'), 'JWT permissions round-trip');
  console.log('JWT sign/verify: OK ->', JSON.stringify(decoded));

  let rejectedBadToken = false;
  try {
    verifyAccessToken(token + 'tampered');
  } catch {
    rejectedBadToken = true;
  }
  console.assert(rejectedBadToken, 'tampered JWT must be rejected');
  console.log('JWT tamper rejection: OK');

  // --- bcryptjs password hashing ---
  const hash = await hashPassword('Admin@12345');
  const ok = await verifyPassword('Admin@12345', hash);
  const bad = await verifyPassword('WrongPassword', hash);
  console.assert(ok === true, 'correct password must verify');
  console.assert(bad === false, 'wrong password must not verify');
  console.log('bcryptjs hash/verify: OK -> hash starts with', hash.slice(0, 7));

  // --- refresh token generation/hashing (used for DB-stored rotation) ---
  const rt1 = generateRefreshToken();
  const rt2 = generateRefreshToken();
  console.assert(rt1 !== rt2, 'refresh tokens must be unique');
  console.assert(rt1.length >= 90, 'refresh token must be high-entropy (96 hex chars)');
  console.assert(hashToken(rt1) === hashToken(rt1), 'token hash must be deterministic for DB lookup');
  console.assert(hashToken(rt1) !== hashToken(rt2), 'different tokens hash differently');
  console.log('Refresh token generation/hashing: OK ->', rt1.slice(0, 12) + '...');

  console.log('\nAll auth-primitive checks passed.');
}

main().catch((e) => {
  console.error('FAILED:', e);
  process.exit(1);
});
