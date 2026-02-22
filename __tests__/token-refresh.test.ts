import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { rmSync, existsSync } from "node:fs";
import { TokenManager } from "../src/auth.js";
import { WhoopClient } from "../src/whoop-client.js";

const TEST_STORAGE_DIR = join(process.cwd(), "storage", "__test_refresh__");

function cleanStorage() {
  if (existsSync(TEST_STORAGE_DIR)) {
    rmSync(TEST_STORAGE_DIR, { recursive: true, force: true });
  }
}

describe("Token refresh", () => {
  let tm: TokenManager;
  let originalFetch: typeof global.fetch;

  before(() => {
    cleanStorage();
    tm = new TokenManager(TEST_STORAGE_DIR);
    originalFetch = global.fetch;
    process.env.WHOOP_CLIENT_ID = "test_client_id";
    process.env.WHOOP_CLIENT_SECRET = "test_client_secret";
    // Ensure env token is not set
    delete process.env.WHOOP_ACCESS_TOKEN;
  });

  after(() => {
    cleanStorage();
    global.fetch = originalFetch;
    delete process.env.WHOOP_CLIENT_ID;
    delete process.env.WHOOP_CLIENT_SECRET;
  });

  beforeEach(() => {
    global.fetch = originalFetch;
  });

  it("refreshAccessToken() calls the Whoop token endpoint with grant_type=refresh_token", async () => {
    // Save initial tokens
    await tm.saveTokens("old_access", "my_refresh_token", Date.now() + 3600_000);

    let capturedBody: string | null = null;
    let capturedUrl: string | null = null;

    global.fetch = async (url: string | URL | Request, options?: RequestInit) => {
      capturedUrl = url.toString();
      capturedBody = options?.body as string;
      return new Response(
        JSON.stringify({
          access_token: "new_access_token",
          refresh_token: "new_refresh_token",
          expires_in: 3600,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    };

    await tm.refreshAccessToken();

    assert.ok(capturedUrl?.includes("oauth2/token"), "should call token endpoint");
    assert.ok(capturedBody?.includes("grant_type=refresh_token"), "should use refresh_token grant");
    assert.ok(capturedBody?.includes("my_refresh_token"), "should include stored refresh token");
  });

  it("after refreshAccessToken(), new tokens are saved", async () => {
    await tm.saveTokens("old_access", "my_refresh_token", Date.now() + 3600_000);

    global.fetch = async () =>
      new Response(
        JSON.stringify({
          access_token: "brand_new_access",
          refresh_token: "brand_new_refresh",
          expires_in: 7200,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );

    await tm.refreshAccessToken();

    const stored = await tm.loadTokens();
    assert.equal(stored?.access_token, "brand_new_access");
    assert.equal(stored?.refresh_token, "brand_new_refresh");
    assert.ok(stored!.expires_at > Date.now() + 7000_000, "expires_at should be ~2 hours from now");
  });

  it("getValidAccessToken() auto-refreshes when token is expired", async () => {
    // Save expired tokens
    await tm.saveTokens("expired_access", "valid_refresh", Date.now() - 1000);

    global.fetch = async () =>
      new Response(
        JSON.stringify({
          access_token: "refreshed_access",
          refresh_token: "new_refresh",
          expires_in: 3600,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );

    const token = await tm.getValidAccessToken();
    assert.equal(token, "refreshed_access");
  });

  it("getValidAccessToken() returns current token when not expired", async () => {
    await tm.saveTokens("valid_access", "some_refresh", Date.now() + 3600_000);

    let fetchCalled = false;
    global.fetch = async () => {
      fetchCalled = true;
      return new Response("{}", { status: 200 });
    };

    const token = await tm.getValidAccessToken();
    assert.equal(token, "valid_access");
    assert.equal(fetchCalled, false, "should not call fetch when token is valid");
  });

  it("WhoopClient retries on 401 using refreshAccessToken and succeeds", async () => {
    await tm.saveTokens("stale_access", "valid_refresh", Date.now() + 3600_000);

    let callCount = 0;
    global.fetch = async (url: string | URL | Request) => {
      const urlStr = url.toString();
      // Token endpoint call
      if (urlStr.includes("oauth2/token")) {
        return new Response(
          JSON.stringify({
            access_token: "fresh_access",
            refresh_token: "fresh_refresh",
            expires_in: 3600,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      // API calls
      callCount++;
      if (callCount === 1) {
        return new Response("Unauthorized", { status: 401 });
      }
      return new Response(
        JSON.stringify({ records: [], next_token: null }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    };

    const client = new WhoopClient(tm);
    const result = await client.getRecoveryCollection(
      new Date().toISOString(),
      new Date().toISOString(),
      1
    );
    assert.deepEqual(result, { records: [], next_token: null });
    assert.equal(callCount, 2, "should have retried once after 401");
  });
});
