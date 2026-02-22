import { describe, it, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { TokenManager } from "../src/auth.js";
import { WhoopClient } from "../src/whoop-client.js";
import { join } from "node:path";
import { rmSync, existsSync } from "node:fs";

const TEST_STORAGE_DIR = join(process.cwd(), "storage", "__test_cache__");

const MOCK_RECOVERY_RESPONSE = {
  records: [
    {
      created_at: new Date().toISOString(),
      score: {
        recovery_score: 75,
        hrv_rmssd_milli: 55,
        resting_heart_rate: 58,
        spo2_percentage: 98,
        skin_temp_celsius: 36.5,
      },
    },
  ],
  next_token: null,
};

describe("WhoopClient cache", () => {
  let tm: TokenManager;
  let client: WhoopClient;
  let originalFetch: typeof global.fetch;
  let fetchCallCount: number;

  before(async () => {
    if (existsSync(TEST_STORAGE_DIR)) {
      rmSync(TEST_STORAGE_DIR, { recursive: true, force: true });
    }
    process.env.WHOOP_CLIENT_ID = "test_id";
    process.env.WHOOP_CLIENT_SECRET = "test_secret";
    delete process.env.WHOOP_ACCESS_TOKEN;

    tm = new TokenManager(TEST_STORAGE_DIR);
    await tm.saveTokens("test_access", "test_refresh", Date.now() + 3600_000);
    originalFetch = global.fetch;
  });

  after(() => {
    global.fetch = originalFetch;
    if (existsSync(TEST_STORAGE_DIR)) {
      rmSync(TEST_STORAGE_DIR, { recursive: true, force: true });
    }
    delete process.env.WHOOP_CLIENT_ID;
    delete process.env.WHOOP_CLIENT_SECRET;
  });

  beforeEach(() => {
    fetchCallCount = 0;
    global.fetch = async () => {
      fetchCallCount++;
      return new Response(JSON.stringify(MOCK_RECOVERY_RESPONSE), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };
    // Fresh client with long TTL so cache doesn't expire during test
    client = new WhoopClient(tm, 60_000);
  });

  it("first call fetches from API (fetch called once)", async () => {
    const start = new Date().toISOString();
    const end = new Date().toISOString();
    await client.getRecoveryCollection(start, end, 1);
    assert.equal(fetchCallCount, 1, "should have called fetch once");
  });

  it("second call within TTL returns cached result (fetch still called only once)", async () => {
    const start = new Date().toISOString();
    const end = new Date().toISOString();
    await client.getRecoveryCollection(start, end, 1);
    await client.getRecoveryCollection(start, end, 1);
    assert.equal(fetchCallCount, 1, "should still have called fetch only once (second call from cache)");
  });

  it("after clearCache(), next call fetches from API again", async () => {
    const start = new Date().toISOString();
    const end = new Date().toISOString();
    await client.getRecoveryCollection(start, end, 1); // fetch #1
    client.clearCache();
    await client.getRecoveryCollection(start, end, 1); // fetch #2
    assert.equal(fetchCallCount, 2, "should have called fetch twice after clearCache");
  });

  it("WhoopClient exposes clearCache() method", () => {
    assert.equal(typeof client.clearCache, "function", "clearCache should be a function");
  });

  it("getCacheSize() returns correct cache size", async () => {
    assert.equal(client.getCacheSize(), 0, "cache should be empty initially");
    const start = new Date().toISOString();
    const end = new Date().toISOString();
    await client.getRecoveryCollection(start, end, 1);
    assert.equal(client.getCacheSize(), 1, "cache should have 1 entry after first call");
    client.clearCache();
    assert.equal(client.getCacheSize(), 0, "cache should be empty after clearCache");
  });

  it("whoop_clear_cache tool is listed in tools/list", async () => {
    const { createWhoopServer } = await import("../src/server.js");
    const server = createWhoopServer(client, tm);

    const handler = (server as unknown as { _requestHandlers: Map<string, (req: unknown) => Promise<unknown>> })
      ._requestHandlers.get("tools/list");

    assert.ok(handler, "tools/list handler should be registered");
    const response = await handler({ method: "tools/list", params: {} }) as { tools: Array<{ name: string }> };
    const names = response.tools.map((t: { name: string }) => t.name);
    assert.ok(names.includes("whoop_clear_cache"), "whoop_clear_cache should be in tools list");
  });
});
