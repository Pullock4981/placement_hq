import 'server-only';

import { DiscordError, fetchDiscordChannelPage, requireDiscordContent } from '@/lib/placement-sync/discord';
import type { ScrumSyncInput } from '@/lib/validators/scrum-sync.schema';

function snowflake(time: number) {
  return (BigInt(Math.max(0, time - 1420070400000)) << BigInt(22)).toString();
}

export function scrumDiscordConfigurationStatus() {
  const channelId = process.env.DISCORD_SCRUM_CHANNEL_ID || '';
  const guildId = process.env.DISCORD_GUILD_ID || '';
  const token = process.env.DISCORD_BOT_TOKEN || '';
  const missingProperties = [
    ...(!token || /\s/.test(token) ? ['DISCORD_BOT_TOKEN'] : []),
    ...(!/^\d{17,20}$/.test(channelId) ? ['DISCORD_SCRUM_CHANNEL_ID'] : []),
    ...(!/^\d{17,20}$/.test(guildId) ? ['DISCORD_GUILD_ID'] : []),
  ];
  return { discordConfigured: missingProperties.length === 0, missingProperties };
}

export function scrumCursor(input: ScrumSyncInput) {
  const start = Date.parse(`${input.fromDate}T00:00:00+06:00`);
  const end = Date.parse(`${input.toDate}T00:00:00+06:00`) + 86_400_000;
  const cursor = input.cursor ?? snowflake(end);
  if (!/^\d{1,20}$/.test(cursor) || BigInt(cursor) < BigInt(snowflake(start)) || BigInt(cursor) > BigInt(snowflake(end))) return null;
  return { start, end, cursor };
}

export async function fetchScrumPage(input: ScrumSyncInput) {
  const status = scrumDiscordConfigurationStatus();
  if (!status.discordConfigured) throw new DiscordError('DISCORD_NOT_CONFIGURED');
  const range = scrumCursor(input);
  if (!range) throw new DiscordError('DISCORD_INVALID_RESPONSE');
  const page = await fetchDiscordChannelPage(process.env.DISCORD_SCRUM_CHANNEL_ID!, range.cursor);
  requireDiscordContent(page.messages.filter((message) => {
    const timestamp = Date.parse(message.timestamp);
    return timestamp >= range.start && timestamp < range.end;
  }));
  return { ...page, guildId: process.env.DISCORD_GUILD_ID! };
}

export async function testScrumDiscordConnection() {
  const status = scrumDiscordConfigurationStatus();
  if (!status.discordConfigured) throw new DiscordError('DISCORD_NOT_CONFIGURED');
  const page = await fetchDiscordChannelPage(process.env.DISCORD_SCRUM_CHANNEL_ID!, snowflake(Date.now() + 1));
  requireDiscordContent(page.messages);
  return { requestSucceeded: true, messagesChecked: page.messages.length, message: 'The scrum-updates channel is readable from the Next.js server.' };
}

export class ScrumDirectMessageError extends Error {
  constructor(message: string, public readonly status = 502) {
    super(message);
    this.name = 'ScrumDirectMessageError';
  }
}

async function discordPost(path: string, body: unknown) {
  const token = process.env.DISCORD_BOT_TOKEN || '';
  if (!token || /\s/.test(token)) throw new ScrumDirectMessageError('The Discord bot is not configured.', 503);
  let response: Response;
  try {
    response = await fetch(`https://discord.com/api/v10${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'DiscordBot (https://github.com/touhidcodes/PH-PlacementHQ, 2.0.0) PlacementHQ',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    throw new ScrumDirectMessageError(error instanceof Error && /TimeoutError|AbortError/.test(error.name) ? 'Discord timed out. Try again.' : 'Discord is currently unavailable.');
  }
  const payload = await response.json().catch(() => null) as { id?: unknown; retry_after?: unknown } | null;
  if (response.status === 429) {
    const retryAfter = typeof payload?.retry_after === 'number' ? Math.ceil(payload.retry_after) : 60;
    throw new ScrumDirectMessageError(`Discord rate limited the message. Retry after ${retryAfter} seconds.`, 429);
  }
  if (response.status === 401) throw new ScrumDirectMessageError('Discord rejected the bot token.', 503);
  if (!response.ok) throw new ScrumDirectMessageError('The bot could not message this employee. Their Discord privacy settings may block direct messages.', response.status === 403 ? 409 : 502);
  if (!payload || typeof payload.id !== 'string' || !/^\d{17,20}$/.test(payload.id)) throw new ScrumDirectMessageError('Discord returned an invalid message response.');
  return payload.id;
}

export async function sendScrumDirectMessage(recipientId: string, content: string) {
  if (!/^\d{17,20}$/.test(recipientId)) throw new ScrumDirectMessageError('The selected employee does not have a valid Discord ID.', 400);
  if (!content.trim() || content.length > 2000) throw new ScrumDirectMessageError('The Discord summary must contain between 1 and 2,000 characters.', 400);
  const channelId = await discordPost('/users/@me/channels', { recipient_id: recipientId });
  const messageId = await discordPost(`/channels/${channelId}/messages`, { content: content.trim(), allowed_mentions: { parse: [] } });
  return { channelId, messageId };
}
