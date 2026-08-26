import { z } from 'zod';

/**
 * Environment is validated once at boot so the process fails loudly on a bad config
 * rather than silently running a clinic on a default secret.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().optional(),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const env = parsed.data;
const isProduction = env.NODE_ENV === 'production';

// A guessable signing key means anyone can mint a valid session, so production refuses
// to start without a real one. Development gets a warning and a throwaway default.
if (isProduction && (!env.JWT_SECRET || env.JWT_SECRET.length < 32)) {
  console.error(
    'JWT_SECRET must be set to at least 32 characters in production. Refusing to start.'
  );
  process.exit(1);
}
if (!env.JWT_SECRET) {
  console.warn('JWT_SECRET is not set — using an insecure development default.');
}

export const config = {
  ...env,
  isProduction,
  jwtSecret: env.JWT_SECRET || 'insecure-development-secret-do-not-use-in-production',
};
