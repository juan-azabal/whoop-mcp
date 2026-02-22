import { test, mock, beforeEach } from "node:test";
import assert from "node:assert/strict";

const MOCK_SLEEP_RESPONSE = {
  records: [{
    id: 1,
    start: "2024-01-01T22:00:00Z",
    end: "2024-01-02T06:00:00Z",
    score_state: "SCORED",
    score: {
      stage_summary: {
        total_slow_wave_sleep_time_milli: 5400000,
        total_in_bed_time_milli: 28800000,
        disturbance_count: 3,
      },
      sleep_performance_percentage: 85,
      respiratory_rate: 15.2,
    },
  }],
};

beforeEach(() => {
  mock.restoreAll();
  process.env.WHOOP_ACCESS_TOKEN = "mock-token";
});

test("get_sleep_last_night is listed in tools/list", async () => {
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
  assert.ok(toolNames.includes("get_sleep_last_night"), "tools/list should include get_sleep_last_night");

  delete process.env.WHOOP_ACCESS_TOKEN;
});

test("get_sleep_last_night returns expected shape", async () => {
  global.fetch = mock.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => MOCK_SLEEP_RESPONSE,
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
    params: { name: "get_sleep_last_night", arguments: {} },
  }) as { content: Array<{ type: string; text: string }> };

  assert.ok(response.content, "response should have content");
  assert.equal(response.content[0].type, "text", "content type should be text");

  const data = JSON.parse(response.content[0].text) as {
    sleep_performance_pct: number;
    sws_milli: number;
    total_sleep_milli: number;
    disturbance_count: number;
    respiratory_rate: number;
  };

  assert.equal(data.sleep_performance_pct, 85, "sleep_performance_pct should match");
  assert.equal(data.sws_milli, 5400000, "sws_milli should match");
  assert.equal(data.total_sleep_milli, 28800000, "total_sleep_milli should match");
  assert.equal(data.disturbance_count, 3, "disturbance_count should match");
  assert.equal(data.respiratory_rate, 15.2, "respiratory_rate should match");

  delete process.env.WHOOP_ACCESS_TOKEN;
});
