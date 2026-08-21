import crypto from 'crypto';

// Refresh tokens are high-entropy random strings, not JWTs: they're opaque,
// stored server-side (so they can be revoked/rotated), and looked up by a
// fast deterministic hash rather than a slow one, since they're already
// unguessable and don't need bcrypt-style brute-force resistance.
export function generateRefreshToken(): string {
  return crypto.randomBytes(48).toString('hex');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
