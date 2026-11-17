import "server-only";
import { z } from "zod";
import type { PlacementSyncInput } from "@/lib/validators/placement-sync.schema";

const discordId = z.string().regex(/^\d{17,20}$/);
const timestamp = z.string().datetime({ offset: true });
export const DiscordMessageSchema = z.object({
  id: discordId,
  channel_id: discordId,
  timestamp,
  edited_timestamp: timestamp.nullish(),
  type: z.number().int().nonnegative(),
  content: z.string().max(4000),
  author: z.object({
    id: discordId,
    username: z.string(),
    global_name: z.string().nullish(),
    bot: z.boolean().optional(),
  }),
  member: z.object({ nick: z.string().nullish() }).optional(),
  embeds: z
    .array(
      z.object({
        description: z.string().optional(),
        fields: z
          .array(z.object({ name: z.string(), value: z.string() }))
          .optional(),
      }),
    )
    .max(10)
    .default([]),
  attachments: z
    .array(z.object({ filename: z.string(), url: z.string().url() }))
    .max(10)
    .default([]),
});

export type DiscordPlacementMessage = z.infer<typeof DiscordMessageSchema>;

const errorMessages = {
  DISCORD_NOT_CONFIGURED:
    "Set valid DISCORD_BOT_TOKEN, DISCORD_PLACEMENT_CHANNEL_ID and DISCORD_GUILD_ID in the private Next.js server environment, then restart or redeploy the app.",
  DISCORD_TOKEN_REJECTED:
    "Discord rejected the bot token. Check DISCORD_BOT_TOKEN in the private Next.js server environment.",
  DISCORD_UNKNOWN_CHANNEL:
    "Discord reports Unknown Channel (10003). Check the server environment DISCORD_PLACEMENT_CHANNEL_ID; use the text channel ID, not the server or application ID.",
  DISCORD_MISSING_ACCESS:
    "Discord reports Missing Access (50001). Check bot membership and channel/category access overrides.",
  DISCORD_MISSING_PERMISSIONS:
    "Discord reports Missing Permissions (50013). Grant the bot View Channel and Read Message History in the target channel.",
  DISCORD_CLOUDFLARE:
    "Discord reports a Cloudflare block (40333) from the Next.js server. Stop repeated retries and contact Discord developer support; changing channel permissions will not resolve this code.",
  DISCORD_CHANNEL_UNAVAILABLE:
    "Discord denied channel access. Check channel configuration and possible network-level blocking.",
  DISCORD_RATE_LIMITED:
    "Discord rate limit reached. Wait for the indicated retry delay, then resume; saved pages remain in the sheet.",
  DISCORD_EMPTY_CONTENT:
    "Discord returned empty message content. Enable Message Content Intent for your bot, then resume.",
  DISCORD_INVALID_RESPONSE:
    "Discord returned invalid message data or a nonadvancing page. No messages from this page were saved.",
  DISCORD_TIMEOUT:
    "The Next.js request to Discord timed out. No messages from this page were saved; retry the saved page later.",
  DISCORD_UNAVAILABLE:
    "The Next.js server could not read Discord messages. No messages from this page were saved.",
};

export class DiscordError extends Error {
  constructor(
    public readonly code: keyof typeof errorMessages,
    public readonly retryAfter?: number,
  ) {
    super(errorMessages[code]);
  }

  get status() {
    if (this.code === "DISCORD_RATE_LIMITED") return 429;
    if (this.code === "DISCORD_TIMEOUT") return 504;
    if (
      this.code === "DISCORD_INVALID_RESPONSE" ||
      this.code === "DISCORD_UNAVAILABLE"
    )
      return 502;
    return 503;
  }
}

export function discordConfigurationStatus() {
  const missingProperties = [
    "DISCORD_BOT_TOKEN",
    "DISCORD_PLACEMENT_CHANNEL_ID",
    "DISCORD_GUILD_ID",
  ].filter((name) => {
    const value = process.env[name] || "";
    return name === "DISCORD_BOT_TOKEN"
      ? !value || /\s/.test(value)
      : !discordId.safeParse(value).success;
  });
  return {
    discordConfigured: missingProperties.length === 0,
    missingProperties,
  };
}

function configuration() {
  if (
    !process.env.DISCORD_BOT_TOKEN ||
    /\s/.test(process.env.DISCORD_BOT_TOKEN)
  )
    throw new DiscordError("DISCORD_NOT_CONFIGURED");
  return {
    token: process.env.DISCORD_BOT_TOKEN!,
  };
}

function snowflake(time: number) {
  return (BigInt(Math.max(0, time - 1420070400000)) << BigInt(22)).toString();
}

export function discordPageCursor(input: PlacementSyncInput) {
  const start = Date.parse(`${input.fromDate}T00:00:00+06:00`);
  const end = Date.parse(`${input.toDate}T00:00:00+06:00`) + 86400000;
  const cursor = input.cursor ?? snowflake(end);
  if (
    !/^\d{1,20}$/.test(cursor) ||
    BigInt(cursor) < BigInt(snowflake(start)) ||
    BigInt(cursor) > BigInt(snowflake(end))
  ) {
    return null;
  }
  return { cursor, start, end };
}

export async function fetchDiscordChannelPage(
  channelId: string,
  cursor: string,
) {
  const config = configuration();
  if (!discordId.safeParse(channelId).success)
    throw new DiscordError("DISCORD_NOT_CONFIGURED");
  let response: Response;
  let body: unknown;
  try {
    response = await fetch(
      `https://discord.com/api/v10/channels/${channelId}/messages?limit=100&before=${cursor}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bot ${config.token}`,
          "User-Agent":
            "DiscordBot (https://github.com/touhidcodes/PH-PlacementHQ, 2.0.0) PlacementHQ",
          Accept: "application/json",
        },
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(20000),
      },
    );
    body = await response.json().catch((error: unknown) => {
      if (error instanceof SyntaxError) return null;
      throw error;
    });
  } catch (error) {
    throw new DiscordError(
      error instanceof Error && /TimeoutError|AbortError/.test(error.name)
        ? "DISCORD_TIMEOUT"
        : "DISCORD_UNAVAILABLE",
    );
  }
  const errorBody = z
    .object({
      code: z.number().int().optional(),
      retry_after: z.number().nonnegative().optional(),
    })
    .safeParse(body);
  const code = errorBody.success ? errorBody.data.code : undefined;
  if (response.status === 429) {
    const header = Number(response.headers.get("retry-after") ?? "60");
    const delay = errorBody.success ? errorBody.data.retry_after : undefined;
    throw new DiscordError(
      "DISCORD_RATE_LIMITED",
      Math.max(1, Math.ceil(delay ?? (Number.isFinite(header) ? header : 60))),
    );
  }
  if (code === 40333) throw new DiscordError("DISCORD_CLOUDFLARE");
  if (response.status === 401) throw new DiscordError("DISCORD_TOKEN_REJECTED");
  if (response.status === 403 || response.status === 404) {
    const codes = {
      10003: "DISCORD_UNKNOWN_CHANNEL",
      50001: "DISCORD_MISSING_ACCESS",
      50013: "DISCORD_MISSING_PERMISSIONS",
    } as const;
    throw new DiscordError(
      codes[code as keyof typeof codes] ?? "DISCORD_CHANNEL_UNAVAILABLE",
    );
  }
  if (response.status !== 200) throw new DiscordError("DISCORD_UNAVAILABLE");
  const parsed = z.array(DiscordMessageSchema).max(100).safeParse(body);
  if (
    !parsed.success ||
    parsed.data.some(
      (message) =>
        message.channel_id !== channelId ||
        BigInt(message.id) >= BigInt(cursor),
    )
  ) {
    throw new DiscordError("DISCORD_INVALID_RESPONSE");
  }
  return { channelId, messages: parsed.data };
}

export function requireDiscordContent(
  messages: z.infer<typeof DiscordMessageSchema>[],
) {
  const ordinary = messages.filter(
    (message) =>
      !message.author.bot && (message.type === 0 || message.type === 19),
  );
  if (
    ordinary.length &&
    ordinary.every(
      (message) =>
        !message.content &&
        !message.embeds.length &&
        !message.attachments.length,
    )
  ) {
    throw new DiscordError("DISCORD_EMPTY_CONTENT");
  }
}

export async function fetchDiscordPlacementPage(input: PlacementSyncInput) {
  const range = discordPageCursor(input);
  if (!range) throw new DiscordError("DISCORD_INVALID_RESPONSE");
  const channelId = process.env.DISCORD_PLACEMENT_CHANNEL_ID!;
  const page = await fetchDiscordChannelPage(channelId, range.cursor);
  requireDiscordContent(
    page.messages.filter(
      (message) =>
        Date.parse(message.timestamp) >= range.start &&
        Date.parse(message.timestamp) < range.end,
    ),
  );
  return { ...page, guildId: process.env.DISCORD_GUILD_ID! };
}

export async function testDiscordConnection() {
  const status = discordConfigurationStatus();
  if (!status.discordConfigured)
    throw new DiscordError("DISCORD_NOT_CONFIGURED");
  const page = await fetchDiscordChannelPage(
    process.env.DISCORD_PLACEMENT_CHANNEL_ID!,
    snowflake(Date.now() + 1),
  );
  requireDiscordContent(page.messages);
  return {
    requestSucceeded: true,
    messagesChecked: page.messages.length,
    message: page.messages.length
      ? "Discord history request succeeded from the Next.js server. No sheet data was changed."
      : "Discord returned no messages. If the channel contains posts, check Read Message History. No sheet data was changed.",
  };
}
