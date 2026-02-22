import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { rmSync, existsSync } from "node:fs";
import { TokenManager } from "../src/auth.js";
import { WhoopClient } from "../src/whoop-client.js";

const TEST_STORAGE_DIR = join(process.cwd(), "storage", "__test_status__");

type HandlerFn = (req: unknown) => Promise<unknown>;
type ToolResult = { content: Array<{ type: string; text: string }>; isError?: boolean };
type StatusPayload = {
  authenticated: boolean;
  token_source: string;
  token_expires_at: number | null;
  cache_size: number;
};

async function callTool(
  toolName: string,
  args: Record<string, unknown> = {},
  storageDir = TEST_STORAGE_DIR
): Promise<ToolResult> {
  const { createWhoopServer } = await import("../src/server.js");
  const tm = new TokenManager(storageDir);
  const client = new WhoopClient(tm);
  const server = createWhoopServer(client, tm);

  const handler = (server as unknown as { _requestHandlers: Map<string, HandlerFn> })
    ._requestHandlers.get("tools/call");

  assert.ok(handler, "tools/call handler should be registered");
  return handler({
    method: "tools/call",
    params: { name: toolName, arguments: args },
  }) as Promise<ToolResult>;
}

describe("whoop_status tool", () => {
  let originalFetch: typeof global.fetch;

  before(() => {
    originalFetch = global.fetch;
    if (existsSync(TEST_STORAGE_DIR)) {
      rmSync(TEST_STORAGE_DIR, { recursive: true, force: true });
    }
    delete process.env.WHOOP_ACCESS_TOKEN;
  });

  after(() => {
    global.fetch = originalFetch;
    if (existsSync(TEST_STORAGE_DIR)) {
      rmSync(TEST_STORAGE_DIR, { recursive: true, force: true });
    }
    delete process.env.WHOOP_ACCESS_TOKEN;
  });

  it("whoop_status is listed in tools/list", async () => {
    const { createWhoopServer } = await import("../src/server.js");
    const tm = new TokenManager(TEST_STORAGE_DIR);
    const client = new WhoopClient(tm);
    const server = createWhoopServer(client, tm);

    const handler = (server as unknown as { _requestHandlers: Map<string, HandlerFn> })
      ._requestHandlers.get("tools/list");

    assert.ok(handler, "tools/list handler should be registered");
    const response = await handler({ method: "tools/list", params: {} }) as { tools: Array<{ name: string }> };
    const names = response.tools.map((t) => t.name);
    assert.ok(names.includes("whoop_status"), "whoop_status should be in tools list");
  });

  it("returns { authenticated, token_source, token_expires_at, cache_size } shape", async () => {
    delete process.env.WHOOP_ACCESS_TOKEN;
    if (existsSync(TEST_STORAGE_DIR)) {
      rmSync(TEST_STORAGE_DIR, { recursive: true, force: true });
    }

    const result = await callTool("whoop_status");
    const payload = JSON.parse(result.content[0].text) as StatusPayload;

    assert.ok("authenticated" in payload, "should have authenticated field");
    assert.ok("token_source" in payload, "should have token_source field");
    assert.ok("token_expires_at" in payload, "should have token_expires_at field");
    assert.ok("cache_size" in payload, "should have cache_size field");
  });

  it("when env token is set: token_source=env, authenticated=true", async () => {
    process.env.WHOOP_ACCESS_TOKEN = "real_env_token_xyz";

    const result = await callTool("whoop_status");
    const payload = JSON.parse(result.content[0].text) as StatusPayload;

    assert.equal(payload.authenticated, true, "should be authenticated");
    assert.equal(payload.token_source, "env", "token source should be env");

    delete process.env.WHOOP_ACCESS_TOKEN;
  });

  it("when no token: authenticated=false", async () => {
    delete process.env.WHOOP_ACCESS_TOKEN;
    if (existsSync(TEST_STORAGE_DIR)) {
      rmSync(TEST_STORAGE_DIR, { recursive: true, force: true });
    }

    const result = await callTool("whoop_status");
    const payload = JSON.parse(result.content[0].text) as StatusPayload;

    assert.equal(payload.authenticated, false, "should not be authenticated");
    assert.equal(payload.token_expires_at, null, "token_expires_at should be null");
  });
});
