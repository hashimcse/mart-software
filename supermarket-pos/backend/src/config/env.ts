import dotenv from 'dotenv';

dotenv.config();

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  databaseUrl: required('DATABASE_URL'),
  accessTokenSecret: required('ACCESS_TOKEN_SECRET'),
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL ?? '15m',
  refreshTokenTtlDays: Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 7),
  bcryptSaltRounds: Number(process.env.BCRYPT_SALT_ROUNDS ?? 12),
};
