import { test, mock, beforeEach } from "node:test";
import assert from "node:assert/strict";

const MOCK_WORKOUT_RESPONSE = {
  records: [
    {
      id: 1,
      start: "2024-01-15T10:00:00Z",
      end: "2024-01-15T11:00:00Z",
      sport_id: 0,
      score_state: "SCORED",
      score: { strain: 12.3, average_heart_rate: 145, max_heart_rate: 180, kilojoule: 2400 },
    },
  ],
};

beforeEach(() => {
  mock.restoreAll();
  process.env.WHOOP_ACCESS_TOKEN = "mock-token";
});

test("get_workouts_recent is listed in tools/list", async () => {
  const { createWhoopServer } = await import("../src/server.js");
  const { TokenManager } = await import("../src/auth.js");
  const { WhoopClient } = await import("../src/whoop-client.js");

  const tm = new TokenManager();
  const client = new WhoopClient(tm);
  const server = createWhoopServer(client);

  const handler = (server as unknown as { _requestHandlers: Map<string, (req: unknown) => Promise<unknown>> })
    ._requestHandlers.get("tools/list");

  assert.ok(handler, "tools/list handler should be registered");

  const response = await handler({ method: "tools/list", params: {} }) as { tools: Array<{ name: string }> };
  const toolNames = response.tools.map((t) => t.name);
  assert.ok(toolNames.includes("get_workouts_recent"), "tools/list should include get_workouts_recent");

  delete process.env.WHOOP_ACCESS_TOKEN;
});

test("get_workouts_recent returns expected shape", async () => {
  global.fetch = mock.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => MOCK_WORKOUT_RESPONSE,
  })) as unknown as typeof fetch;

  const { createWhoopServer } = await import("../src/server.js");
  const { TokenManager } = await import("../src/auth.js");
  const { WhoopClient } = await import("../src/whoop-client.js");

  const tm = new TokenManager();
  const client = new WhoopClient(tm);
  const server = createWhoopServer(client);

  const handler = (server as unknown as { _requestHandlers: Map<string, (req: unknown) => Promise<unknown>> })
    ._requestHandlers.get("tools/call");

  assert.ok(handler, "tools/call handler should be registered");

  const response = await handler({
    method: "tools/call",
    params: { name: "get_workouts_recent", arguments: {} },
  }) as { content: Array<{ type: string; text: string }> };

  assert.ok(response.content, "response should have content");
  assert.equal(response.content[0].type, "text");

  const data = JSON.parse(response.content[0].text) as {
    records: Array<{ date: string; activity_type: string; strain: number; duration_min: number; avg_hr: number; max_hr: number }>;
    count: number;
    total_strain: number;
  };

  assert.equal(data.count, 1, "count should be 1");
  assert.ok(Math.abs(data.total_strain - 12.3) < 0.001, `total_strain should be ~12.3, got ${data.total_strain}`);
  assert.ok(typeof data.records[0].activity_type === "string", "activity_type should be a string");
  assert.ok(typeof data.records[0].duration_min === "number", "duration_min should be a number");
  // 1 hour = 60 minutes
  assert.equal(data.records[0].duration_min, 60, "duration_min should be 60 for a 1-hour workout");

  delete process.env.WHOOP_ACCESS_TOKEN;
});

test("get_workouts_recent maps sport_id to activity_type correctly", async () => {
  const responseWithVariousSports = {
    records: [
      { id: 1, start: "2024-01-15T10:00:00Z", end: "2024-01-15T11:00:00Z", sport_id: 0, score_state: "SCORED", score: { strain: 12.3, average_heart_rate: 145, max_heart_rate: 180, kilojoule: 2400 } },
      { id: 2, start: "2024-01-14T10:00:00Z", end: "2024-01-14T11:00:00Z", sport_id: 1, score_state: "SCORED", score: { strain: 10.0, average_heart_rate: 130, max_heart_rate: 170, kilojoule: 2000 } },
      { id: 3, start: "2024-01-13T10:00:00Z", end: "2024-01-13T11:00:00Z", sport_id: -1, score_state: "SCORED", score: { strain: 8.0, average_heart_rate: 120, max_heart_rate: 160, kilojoule: 1800 } },
    ],
  };

  global.fetch = mock.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => responseWithVariousSports,
  })) as unknown as typeof fetch;

  const { createWhoopServer } = await import("../src/server.js");
  const { TokenManager } = await import("../src/auth.js");
  const { WhoopClient } = await import("../src/whoop-client.js");

  const tm = new TokenManager();
  const client = new WhoopClient(tm);
  const server = createWhoopServer(client);

  const handler = (server as unknown as { _requestHandlers: Map<string, (req: unknown) => Promise<unknown>> })
    ._requestHandlers.get("tools/call");

  const response = await handler({
    method: "tools/call",
    params: { name: "get_workouts_recent", arguments: {} },
  }) as { content: Array<{ type: string; text: string }> };

  const data = JSON.parse(response.content[0].text) as {
    records: Array<{ activity_type: string }>;
  };

  assert.equal(data.records[0].activity_type, "Running", "sport_id 0 should map to Running");
  assert.equal(data.records[1].activity_type, "Cycling", "sport_id 1 should map to Cycling");
  assert.equal(data.records[2].activity_type, "Activity", "sport_id -1 should map to Activity");

  delete process.env.WHOOP_ACCESS_TOKEN;
});
