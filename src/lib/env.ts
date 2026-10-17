/**
 * Centralised, typed environment-variable configuration.
 *
 * Every key the app needs at runtime is declared here. Required keys
 * are validated at boot via zod — if any are missing, the import
 * throws, the module never loads, and the user gets a clear error
 * instead of mysterious 'undefined is not a function' later.
 *
 * Optional keys are kept loose; features that depend on them should
 * check `env.RESEND_API_KEY != null` etc. before using them.
 */
import { z } from 'zod'

const isServer = typeof window === 'undefined'

const schema = z.object({
  // Database — required
  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required (e.g. postgresql://user:pass@host:5432/db)'),

  // Direct (unpooled) connection — recommended for migrations / serverless
  DIRECT_URL: z.string().optional(),

  // NextAuth — required
  NEXTAUTH_URL: z.string().url('NEXTAUTH_URL must be a valid URL'),
  NEXTAUTH_SECRET: z
    .string()
    .min(16, 'NEXTAUTH_SECRET must be at least 16 characters (use `openssl rand -hex 32`)'),

  // Cache — optional; falls back to in-memory stub when missing
  REDIS_URL: z.string().optional(),

  // OAuth (optional)
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // Email — optional; without RESEND_API_KEY the mailer just logs to
  // the console and reports sent=false to the caller.
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().email().optional(),

  // Public — available in both server and client bundles
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),

  // Image storage (optional, not yet wired)
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().optional(),
  AWS_S3_BUCKET: z.string().optional(),

  // Legacy SMTP fields (kept for the Email.js / nodemailer path that
  // isn't currently used — left here so .env files from older setups
  // don't break)
  EMAIL_SERVER_HOST: z.string().optional(),
  EMAIL_SERVER_PORT: z.string().optional(),
  EMAIL_SERVER_USER: z.string().optional(),
  EMAIL_SERVER_PASSWORD: z.string().optional(),

  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
})

type Env = z.infer<typeof schema>

function loadEnv(): Env {
  // On the client, only NEXT_PUBLIC_* keys are present in process.env.
  // Skip the strict server-side validation there.
  if (!isServer) {
    return {
      DATABASE_URL: '',
      NEXTAUTH_URL: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
      NEXTAUTH_SECRET: '',
      NODE_ENV: (process.env.NODE_ENV as Env['NODE_ENV']) ?? 'development',
    } as Env
  }

  const result = schema.safeParse(process.env)
  if (!result.success) {
    const issues = result.error.issues
      .map(i => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n')
    throw new Error(
      `❌ Environment validation failed:\n${issues}\n\n` +
        `Copy .env.example to .env and fill in the required values.`
    )
  }
  return result.data
}

export const env = loadEnv()

// Public env (re-exported as a typed object for the client)
export const publicEnv = {
  NEXT_PUBLIC_SITE_URL: env.NEXT_PUBLIC_SITE_URL ?? env.NEXTAUTH_URL,
}
