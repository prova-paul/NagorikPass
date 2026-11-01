import { z } from 'zod'

// A real environment variable always wins over the .env file.
try {
  process.loadEnvFile()
} catch {
  // No .env file: rely on the environment.
}

const booleanString = z.enum(['true', 'false']).transform((value) => value === 'true')
// A blank line in .env ("SMTP_HOST=") means not set.
const optionalText = z.preprocess((value) => (value === '' ? undefined : value), z.string().optional())

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, 'must start with postgres://'),
    DATABASE_SSL: booleanString.default(false),
    FRONTEND_ORIGIN: z.url().transform((value) => new URL(value).origin),
    APP_TIMEZONE: z
      .string()
      .default('Asia/Dhaka')
      .refine((zone) => {
        try {
          new Intl.DateTimeFormat('en', { timeZone: zone })
          return true
        } catch {
          return false
        }
      }, 'must be a valid IANA time zone'),
    SESSION_TTL_HOURS: z.coerce.number().positive().default(12),
    SESSION_REMEMBER_DAYS: z.coerce.number().positive().default(30),
    LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
    TRUST_PROXY: booleanString.default(false),
    EMAIL_TRANSPORT: z.enum(['smtp', 'mailbox', 'console', 'none']).default('mailbox'),
    SMTP_HOST: optionalText,
    SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
    SMTP_SECURE: z.preprocess((value) => (value === '' ? undefined : value), booleanString.optional()),
    SMTP_REQUIRE_TLS: z.preprocess((value) => (value === '' ? undefined : value), booleanString.optional()),
    SMTP_USER: optionalText,
    SMTP_PASSWORD: optionalText,
    SMTP_FROM_ADDRESS: optionalText,
  })
  .superRefine((env, context) => {
    const problem = (path: string, message: string) => context.addIssue({ code: 'custom', path: [path], message })

    if (env.NODE_ENV === 'production' && (env.EMAIL_TRANSPORT === 'console' || env.EMAIL_TRANSPORT === 'mailbox')) {
      problem('EMAIL_TRANSPORT', `${env.EMAIL_TRANSPORT} exposes live approval links and is not allowed in production`)
    }
    if (env.EMAIL_TRANSPORT === 'smtp') {
      if (!env.SMTP_HOST) problem('SMTP_HOST', 'is required when EMAIL_TRANSPORT=smtp')
      if (!env.SMTP_FROM_ADDRESS) problem('SMTP_FROM_ADDRESS', 'is required when EMAIL_TRANSPORT=smtp')
      else if (!z.email().safeParse(env.SMTP_FROM_ADDRESS).success) problem('SMTP_FROM_ADDRESS', 'must be an email address')
      if (Boolean(env.SMTP_USER) !== Boolean(env.SMTP_PASSWORD)) problem('SMTP_USER', 'SMTP_USER and SMTP_PASSWORD must be set together')
    }
  })

const parsed = schema.safeParse(process.env)

if (!parsed.success) {
  const problems = parsed.error.issues.map((issue) => `  ${issue.path.join('.')}: ${issue.message}`).join('\n')
  console.error(`Invalid environment configuration. See .env.example.\n${problems}`)
  process.exit(1)
}

export const env = parsed.data
export const isProduction = env.NODE_ENV === 'production'
