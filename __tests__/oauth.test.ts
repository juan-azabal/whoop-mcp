import { test, mock, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";

const TEST_STORAGE_DIR = join(process.cwd(), "storage", "__test_oauth__");

after(() => {
  if (existsSync(TEST_STORAGE_DIR)) {
    rmSync(TEST_STORAGE_DIR, { recursive: true, force: true });
  }
});

beforeEach(() => {
  mock.restoreAll();
  process.env.WHOOP_CLIENT_ID = "test-client-id";
  process.env.WHOOP_CLIENT_SECRET = "test-client-secret";
  process.env.WHOOP_REDIRECT_URI = "http://localhost:3000/callback";
  // Remove env token so OAuth path is exercised
  delete process.env.WHOOP_ACCESS_TOKEN;
});

test("getAuthorizationUrl() returns a valid Whoop auth URL", async () => {
  const { TokenManager } = await import("../src/auth.js");
  const tm = new TokenManager(TEST_STORAGE_DIR);

  const url = tm.getAuthorizationUrl();
  assert.ok(url.startsWith("https://api.prod.whoop.com/oauth/oauth2/auth"), "URL should point to Whoop auth endpoint");
  assert.ok(url.includes("client_id=test-client-id"), "URL should include client_id");
  assert.ok(url.includes("redirect_uri="), "URL should include redirect_uri");
  assert.ok(url.includes("response_type=code"), "URL should include response_type=code");
  assert.ok(url.includes("scope="), "URL should include scope");
  assert.ok(url.includes("offline"), "scope should include offline for refresh token");
});

test("exchangeCode() saves tokens after successful exchange", async () => {
  // Mock the token endpoint
  const fakeTokenResponse = {
    access_token: "new-access-token",
    refresh_token: "new-refresh-token",
    expires_in: 3600,
    token_type: "Bearer",
  };

  global.fetch = mock.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => fakeTokenResponse,
  })) as unknown as typeof fetch;

  const { TokenManager } = await import("../src/auth.js");
  const tm = new TokenManager(TEST_STORAGE_DIR);

  await tm.exchangeCode("auth-code-from-whoop");

  const stored = await tm.loadTokens();
  assert.ok(stored, "tokens should be saved after exchange");
  assert.equal(stored!.access_token, "new-access-token", "access_token should be saved");
  assert.equal(stored!.refresh_token, "new-refresh-token", "refresh_token should be saved");
  assert.ok(stored!.expires_at > Date.now(), "expires_at should be in the future");
});

test("exchangeCode() POSTs to Whoop token endpoint with correct params", async () => {
  const fetchMock = mock.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      access_token: "tok",
      refresh_token: "ref",
      expires_in: 3600,
      token_type: "Bearer",
    }),
  }));
  global.fetch = fetchMock as unknown as typeof fetch;

  const { TokenManager } = await import("../src/auth.js");
  const tm = new TokenManager(TEST_STORAGE_DIR);

  await tm.exchangeCode("my-code");

  const callArgs = fetchMock.mock.calls[0].arguments as [string, RequestInit];
  assert.ok(callArgs[0].includes("oauth2/token"), "should POST to token endpoint");
  assert.equal(callArgs[1]?.method, "POST", "should use POST method");

  const body = callArgs[1]?.body as string;
  assert.ok(body.includes("grant_type=authorization_code"), "body should include grant_type");
  assert.ok(body.includes("code=my-code"), "body should include the code");
  assert.ok(body.includes("client_id=test-client-id"), "body should include client_id");
});

test("whoop_get_auth_url tool returns auth URL in MCP response", async () => {
  process.env.WHOOP_ACCESS_TOKEN = "mock-token"; // needed for server to start
  const { createWhoopServer } = await import("../src/server.js");
  const { TokenManager } = await import("../src/auth.js");
  const { WhoopClient } = await import("../src/whoop-client.js");

  const tm = new TokenManager(TEST_STORAGE_DIR);
  const client = new WhoopClient(tm);
  const server = createWhoopServer(client, tm);

  const callHandler = (server as unknown as { _requestHandlers: Map<string, (req: unknown) => Promise<unknown>> })
    ._requestHandlers.get("tools/call");

  const response = await callHandler!({
    method: "tools/call",
    params: { name: "whoop_get_auth_url", arguments: {} },
  }) as { content: Array<{ type: string; text: string }> };

  const text = response.content[0].text;
  assert.ok(text.includes("https://api.prod.whoop.com/oauth/oauth2/auth"), "response should contain auth URL");

  delete process.env.WHOOP_ACCESS_TOKEN;
});
