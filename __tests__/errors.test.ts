import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { rmSync, existsSync } from "node:fs";
import { TokenManager } from "../src/auth.js";
import { WhoopClient, WhoopAuthError, WhoopRateLimitError } from "../src/whoop-client.js";

const TEST_STORAGE_DIR = join(process.cwd(), "storage", "__test_errors__");

type HandlerFn = (req: unknown) => Promise<unknown>;
type ToolResult = { content: Array<{ type: string; text: string }>; isError?: boolean };

async function callTool(toolName: string, args: Record<string, unknown> = {}): Promise<ToolResult> {
  const { createWhoopServer } = await import("../src/server.js");
  const tm = new TokenManager(TEST_STORAGE_DIR);
  const client = new WhoopClient(tm);
  const server = createWhoopServer(client, tm);

  const handler = (server as unknown as { _requestHandlers: Map<string, HandlerFn> })
    ._requestHandlers.get("tools/call");

  assert.ok(handler, "tools/call handler should be registered");
  const result = await handler({
    method: "tools/call",
    params: { name: toolName, arguments: args },
  }) as ToolResult;
  return result;
}

describe("Structured error handling", () => {
  let originalFetch: typeof global.fetch;

  before(() => {
    originalFetch = global.fetch;
    if (existsSync(TEST_STORAGE_DIR)) {
      rmSync(TEST_STORAGE_DIR, { recursive: true, force: true });
    }
    process.env.WHOOP_CLIENT_ID = "test_id";
    process.env.WHOOP_CLIENT_SECRET = "test_secret";
    delete process.env.WHOOP_ACCESS_TOKEN;
  });

  after(() => {
    global.fetch = originalFetch;
    if (existsSync(TEST_STORAGE_DIR)) {
      rmSync(TEST_STORAGE_DIR, { recursive: true, force: true });
    }
    delete process.env.WHOOP_CLIENT_ID;
    delete process.env.WHOOP_CLIENT_SECRET;
  });

  it("401 after refresh failure returns Re-authorization required message", async () => {
    // Save tokens so we have a refresh_token available
    const tm = new TokenManager(TEST_STORAGE_DIR);
    await tm.saveTokens("stale_access", "bad_refresh", Date.now() + 3600_000);

    // All fetches return 401 (including refresh attempt)
    global.fetch = async () => new Response("Unauthorized", { status: 401 });

    const result = await callTool("get_recovery_today");

    assert.ok(result.isError, "should be an error response");
    const text = result.content[0].text;
    assert.ok(
      text.includes("Re-authorization required"),
      `expected 'Re-authorization required' in: ${text}`
    );
  });

  it("429 response returns rate limited message with retry seconds", async () => {
    const tm = new TokenManager(TEST_STORAGE_DIR);
    await tm.saveTokens("valid_access", "valid_refresh", Date.now() + 3600_000);

    global.fetch = async () =>
      new Response("Too Many Requests", {
        status: 429,
        headers: { "Retry-After": "42" },
      });

    const result = await callTool("get_recovery_today");

    assert.ok(result.isError, "should be an error response");
    const text = result.content[0].text;
    assert.ok(text.includes("Rate limited"), `expected 'Rate limited' in: ${text}`);
    assert.ok(text.includes("42"), `expected retry seconds '42' in: ${text}`);
  });

  it("network error returns Cannot reach Whoop API message", async () => {
    const tm = new TokenManager(TEST_STORAGE_DIR);
    await tm.saveTokens("valid_access", "valid_refresh", Date.now() + 3600_000);

    global.fetch = async () => {
      throw new TypeError("fetch failed");
    };

    const result = await callTool("get_recovery_today");

    assert.ok(result.isError, "should be an error response");
    const text = result.content[0].text;
    assert.ok(
      text.includes("Cannot reach Whoop API"),
      `expected 'Cannot reach Whoop API' in: ${text}`
    );
  });

  it("no tokens returns Not authenticated message", async () => {
    // Remove all tokens
    if (existsSync(TEST_STORAGE_DIR)) {
      rmSync(TEST_STORAGE_DIR, { recursive: true, force: true });
    }
    delete process.env.WHOOP_ACCESS_TOKEN;

    // Fetch should not be called, but reset anyway
    global.fetch = async () => new Response("{}", { status: 200 });

    const result = await callTool("get_recovery_today");

    assert.ok(result.isError, "should be an error response");
    const text = result.content[0].text;
    assert.ok(
      text.includes("Not authenticated") || text.includes("not set") || text.includes("No tokens"),
      `expected authentication message in: ${text}`
    );
  });
});
