import { test, mock, beforeEach } from "node:test";
import assert from "node:assert/strict";

// ── helpers ────────────────────────────────────────────────────────────────────

function makeRecoveryRecord(overrides: Record<string, unknown> = {}) {
  return {
    cycle_id: 1,
    created_at: "2024-01-15T00:00:00.000Z",
    updated_at: "2024-01-15T12:00:00.000Z",
    score_state: "SCORED",
    score: {
      recovery_score: 75,
      hrv_rmssd_milli: 58.3,
      resting_heart_rate: 54,
      spo2_percentage: 97.5,
      skin_temp_celsius: 33.0,
    },
    ...overrides,
  };
}

function mockFetch(responseBody: unknown, status = 200) {
  return mock.fn(async (_url: string, _init?: RequestInit) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => responseBody,
  }));
}

// ── tests ──────────────────────────────────────────────────────────────────────

beforeEach(() => mock.restoreAll());

test("WhoopClient is importable", async () => {
  const { WhoopClient } = await import("../src/whoop-client.js");
  assert.ok(WhoopClient, "WhoopClient class should be exported");
});

test("getRecoveryCollection returns records when fetch succeeds", async () => {
  const fakeResponse = {
    records: [makeRecoveryRecord(), makeRecoveryRecord({ cycle_id: 2, created_at: "2024-01-14T00:00:00.000Z" })],
    next_token: null,
  };

  const fetchMock = mockFetch(fakeResponse);
  // @ts-ignore — replacing global fetch with mock
  global.fetch = fetchMock;

  const { WhoopClient } = await import("../src/whoop-client.js");
  const { TokenManager } = await import("../src/auth.js");

  process.env.WHOOP_ACCESS_TOKEN = "mock-token";
  const tm = new TokenManager();
  const client = new WhoopClient(tm);

  const result = await client.getRecoveryCollection("2024-01-14", "2024-01-15", 25);

  assert.equal(result.records.length, 2, "should return 2 records");
  assert.equal(result.records[0].cycle_id, 1, "first record cycle_id should be 1");
  assert.ok(result.records[0].score.hrv_rmssd_milli > 0, "hrv_rmssd_milli should be positive");
  assert.equal(fetchMock.mock.calls.length, 1, "fetch should be called once");

  // Verify Authorization header is sent
  const callArgs = fetchMock.mock.calls[0].arguments as [string, RequestInit];
  const headers = callArgs[1]?.headers as Record<string, string>;
  assert.ok(headers?.["Authorization"]?.startsWith("Bearer "), "Authorization header should be set");

  delete process.env.WHOOP_ACCESS_TOKEN;
});

test("getRecoveryCollection throws WhoopAuthError on 401", async () => {
  const fetchMock = mockFetch({ error: "Unauthorized" }, 401);
  // @ts-ignore
  global.fetch = fetchMock;

  const { WhoopClient, WhoopAuthError } = await import("../src/whoop-client.js");
  const { TokenManager } = await import("../src/auth.js");

  process.env.WHOOP_ACCESS_TOKEN = "expired-token";
  const tm = new TokenManager();
  const client = new WhoopClient(tm);

  await assert.rejects(
    () => client.getRecoveryCollection("2024-01-14", "2024-01-15", 25),
    (err: unknown) => {
      assert.ok(err instanceof WhoopAuthError, "should throw WhoopAuthError");
      return true;
    }
  );

  delete process.env.WHOOP_ACCESS_TOKEN;
});

test("getRecoveryCollection passes start/end as query params", async () => {
  const fakeResponse = { records: [makeRecoveryRecord()], next_token: null };
  const fetchMock = mockFetch(fakeResponse);
  // @ts-ignore
  global.fetch = fetchMock;

  const { WhoopClient } = await import("../src/whoop-client.js");
  const { TokenManager } = await import("../src/auth.js");

  process.env.WHOOP_ACCESS_TOKEN = "mock-token";
  const tm = new TokenManager();
  const client = new WhoopClient(tm);

  await client.getRecoveryCollection("2024-01-10", "2024-01-15", 10);

  const url = fetchMock.mock.calls[0].arguments[0] as string;
  assert.ok(url.includes("start="), "URL should include start param");
  assert.ok(url.includes("end="), "URL should include end param");
  assert.ok(url.includes("limit=10"), "URL should include limit param");

  delete process.env.WHOOP_ACCESS_TOKEN;
});
