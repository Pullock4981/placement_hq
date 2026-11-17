import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  JWT_ACCESS_SECRET: z.string().min(1, "JWT_ACCESS_SECRET is required"),
  JWT_REFRESH_SECRET: z.string().min(1, "JWT_REFRESH_SECRET is required"),
  GOOGLE_SERVICE_ACCOUNT_JSON: z.string().min(1).optional(),
  GOOGLE_SHEETS_REFRESH_TOKEN: z.string().min(1).optional(),
  GOOGLE_APPS_SCRIPT_URL: z.string().url().optional(),
  GOOGLE_APPS_SCRIPT_SECRET: z.string().min(32).optional(),
  GOOGLE_SHEETS_PRINCIPAL_EMAIL: z.string().email().optional(),
  GOOGLE_CENTRAL_SPREADSHEET_ID: z.string().min(1).optional(),
  GOOGLE_PLACEMENT_SPREADSHEET_ID: z.string().min(1).optional(),
  GOOGLE_SCRUM_SPREADSHEET_ID: z.string().min(1).optional(),
  GOOGLE_ACCESS_CONTROL_SPREADSHEET_ID: z.string().min(1).optional(),
  GOOGLE_SHEET_MANAGEMENT_SPREADSHEET_ID: z.string().min(1).optional(),
  GOOGLE_SPREADSHEET_ID: z.string().optional(),
  CRON_SECRET: z.string().min(1, "CRON_SECRET is required"),
  NEXT_PUBLIC_APP_URL: z.string().min(1).optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  WEBHOOK_URL: z.string().optional(),
  DISCORD_BOT_TOKEN: z.string().min(1).optional(),
  DISCORD_PLACEMENT_CHANNEL_ID: z.string().min(1).optional(),
  DISCORD_SCRUM_CHANNEL_ID: z.string().min(1).optional(),
  DISCORD_GUILD_ID: z.string().min(1).optional(),
  GEMINI_API_KEY: z.string().min(1).optional(),
  GEMINI_MODEL: z.string().min(1).optional(),
  NEXT_PUBLIC_DEMO_MODE: z.enum(["true", "false"]).default("false"),
});

const isServer = typeof window === "undefined";

function validateEnv() {
  if (!isServer) return process.env as unknown as z.infer<typeof envSchema>;

  const isBuildTime =
    process.env.NEXT_PHASE === "phase-production-build" ||
    process.env.SKIP_ENV_VALIDATION === "true";

  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    if (isBuildTime) {
      console.warn(
        "⚠️ Missing environment variables during build time:",
        parsed.error.flatten().fieldErrors,
      );
      return process.env as unknown as z.infer<typeof envSchema>;
    }
    console.error(
      "❌ Invalid environment variables:",
      parsed.error.flatten().fieldErrors,
    );
    throw new Error(
      "Environment variable validation failed. Please check your .env.local file.",
    );
  }

  return parsed.data;
}

export const env = validateEnv();
