import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  discordConfigurationStatus,
  discordPageCursor,
  fetchDiscordPlacementPage,
  testDiscordConnection,
} from "@/lib/placement-sync/discord";

vi.mock("server-only", () => ({}));

const channelId = "223456789012345678";
const guildId = "123456789012345678";
const input = {
  fromDate: "2026-08-30",
  toDate: "2026-08-30",
  runId: "b7e3f73a-a540-458c-a63f-746f1d8d8fb8",
};
const timestamp = "2026-08-30T09:00:00.000Z";
const id = (
  ((BigInt(Date.parse(timestamp)) - BigInt(1420070400000)) << BigInt(22)) +
  BigInt(1)
).toString();
const message = {
  id,
  timestamp,
  channel_id: channelId,
  type: 0,
  content: "Candidate Name: Example",
  author: {
    id: "323456789012345678",
    username: "Mentor",
    global_name: "Example Mentor",
  },
  embeds: [],
  attachments: [],
};
const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("DISCORD_BOT_TOKEN", "private-test-token");
  vi.stubEnv("DISCORD_PLACEMENT_CHANNEL_ID", channelId);
  vi.stubEnv("DISCORD_GUILD_ID", guildId);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("server-only Discord placement client", () => {
  it("fetches one fixed-host page with bot identity and returns only ingestion fields", async () => {
    fetchMock.mockResolvedValue(
      Response.json([
        {
          ...message,
          referenced_message: { content: "unrelated-private-reply" },
          mentions: [{ username: "unrelated-person" }],
        },
      ]),
    );
    const page = await fetchDiscordPlacementPage(input);
    expect(page).toEqual({ channelId, guildId, messages: [message] });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe(
      `https://discord.com/api/v10/channels/${channelId}/messages?limit=100&before=${discordPageCursor(input)!.cursor}`,
    );
    expect(options).toMatchObject({
      method: "GET",
      cache: "no-store",
      redirect: "error",
      headers: {
        Authorization: "Bot private-test-token",
        Accept: "application/json",
      },
    });
    expect(options.headers["User-Agent"]).toMatch(
      /^DiscordBot \(https:\/\/github.com\/touhidcodes\/PH-PlacementHQ, /,
    );
    expect(options.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.stringify(page)).not.toContain("private-test-token");
    expect(JSON.stringify(page)).not.toContain("unrelated-private-reply");
  });

  it("uses inclusive Dhaka dates and validates cursors before requests", async () => {
    const range = discordPageCursor(input)!;
    expect(new Date(range.start).toISOString()).toBe(
      "2026-08-29T18:00:00.000Z",
    );
    expect(new Date(range.end).toISOString()).toBe("2026-08-30T18:00:00.000Z");
    expect(discordPageCursor({ ...input, cursor: id })!.cursor).toBe(id);
    await expect(
      fetchDiscordPlacementPage({ ...input, cursor: "1" }),
    ).rejects.toMatchObject({ code: "DISCORD_INVALID_RESPONSE" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("requires private server configuration and never fetches with malformed IDs or prefixed tokens", async () => {
    vi.stubEnv("DISCORD_PLACEMENT_CHANNEL_ID", "https://other.test");
    vi.stubEnv("DISCORD_BOT_TOKEN", "Bot private-test-token");
    expect(discordConfigurationStatus()).toEqual({
      discordConfigured: false,
      missingProperties: ["DISCORD_BOT_TOKEN", "DISCORD_PLACEMENT_CHANNEL_ID"],
    });
    await expect(fetchDiscordPlacementPage(input)).rejects.toMatchObject({
      code: "DISCORD_NOT_CONFIGURED",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    [401, 0, "DISCORD_TOKEN_REJECTED"],
    [403, 40333, "DISCORD_CLOUDFLARE"],
    [403, 50001, "DISCORD_MISSING_ACCESS"],
    [403, 50013, "DISCORD_MISSING_PERMISSIONS"],
    [404, 10003, "DISCORD_UNKNOWN_CHANNEL"],
    [503, 0, "DISCORD_UNAVAILABLE"],
  ])(
    "sanitizes HTTP %s/code %s and does not retry",
    async (status, code, expected) => {
      fetchMock.mockResolvedValue(
        Response.json(
          { code, message: "private-upstream-details" },
          { status },
        ),
      );
      const error = await fetchDiscordPlacementPage(input).catch(
        (failure) => failure,
      );
      expect(error.code).toBe(expected);
      expect(error.message).not.toContain("private-upstream-details");
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it("reports non-JSON errors and honors retry_after without automatic retries", async () => {
    fetchMock.mockResolvedValue(
      new Response("<html>private-error-page</html>", { status: 403 }),
    );
    await expect(fetchDiscordPlacementPage(input)).rejects.toMatchObject({
      code: "DISCORD_CHANNEL_UNAVAILABLE",
    });
    fetchMock.mockResolvedValue(
      Response.json({ retry_after: 4.25 }, { status: 429 }),
    );
    await expect(fetchDiscordPlacementPage(input)).rejects.toMatchObject({
      code: "DISCORD_RATE_LIMITED",
      retryAfter: 5,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([
    null,
    [null],
    [{ ...message, id: 1520000000000000000 }],
    [{ ...message, channel_id: guildId }],
    [{ ...message, timestamp: "not-a-date" }],
    [{ ...message, id: discordPageCursor(input)!.cursor }],
    Array.from({ length: 101 }, () => message),
  ])("rejects malformed responses before ingestion", async (body) => {
    fetchMock.mockResolvedValue(Response.json(body));
    await expect(fetchDiscordPlacementPage(input)).rejects.toMatchObject({
      code: "DISCORD_INVALID_RESPONSE",
    });
  });

  it("checks message content intent but accepts an empty history page and ignores bot-only pages", async () => {
    fetchMock.mockResolvedValue(Response.json([{ ...message, content: "" }]));
    await expect(fetchDiscordPlacementPage(input)).rejects.toMatchObject({
      code: "DISCORD_EMPTY_CONTENT",
    });
    fetchMock.mockResolvedValue(Response.json([]));
    expect((await fetchDiscordPlacementPage(input)).messages).toEqual([]);
    fetchMock.mockResolvedValue(
      Response.json([
        { ...message, content: "", author: { ...message.author, bot: true } },
      ]),
    );
    expect((await fetchDiscordPlacementPage(input)).messages).toHaveLength(1);
  });

  it("returns only counts and guidance from the read-only connection test", async () => {
    fetchMock.mockResolvedValue(Response.json([message]));
    const result = await testDiscordConnection();
    expect(result).toMatchObject({
      requestSucceeded: true,
      messagesChecked: 1,
    });
    expect(JSON.stringify(result)).not.toContain(message.content);
    expect(JSON.stringify(result)).not.toContain("private-test-token");
    fetchMock.mockResolvedValue(Response.json([]));
    expect((await testDiscordConnection()).message).toContain(
      "Read Message History",
    );
  });

  it("does not leak request details on timeouts or network failures", async () => {
    fetchMock.mockRejectedValue(
      new DOMException("private-test-token", "TimeoutError"),
    );
    await expect(fetchDiscordPlacementPage(input)).rejects.toMatchObject({
      code: "DISCORD_TIMEOUT",
    });
    fetchMock.mockRejectedValue(new Error("private-test-token"));
    const error = await fetchDiscordPlacementPage(input).catch(
      (failure) => failure,
    );
    expect(error.code).toBe("DISCORD_UNAVAILABLE");
    expect(error.message).not.toContain("private-test-token");
  });
});
