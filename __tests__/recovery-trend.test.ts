import { test, mock, beforeEach } from "node:test";
import assert from "node:assert/strict";

function makeRecord(days_ago: number, score: number, hrv: number) {
  const d = new Date();
  d.setDate(d.getDate() - days_ago);
  return {
    cycle_id: days_ago,
    created_at: d.toISOString(),
    updated_at: d.toISOString(),
    score_state: "SCORED",
    score: {
      recovery_score: score,
      hrv_rmssd_milli: hrv,
      resting_heart_rate: 55,
      spo2_percentage: 97.0,
      skin_temp_celsius: 33.0,
    },
  };
}

beforeEach(() => {
  mock.restoreAll();
  process.env.WHOOP_ACCESS_TOKEN = "mock-token";
});

test("get_recovery_trend returns records, avg_recovery, avg_hrv", async () => {
  const fakeResp = {
    records: [
      makeRecord(0, 80, 60),
      makeRecord(1, 70, 50),
      makeRecord(2, 90, 70),
    ],
    next_token: null,
  };

  global.fetch = mock.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => fakeResp,
  })) as unknown as typeof fetch;

  const { createWhoopServer } = await import("../src/server.js");
  const { TokenManager } = await import("../src/auth.js");
  const { WhoopClient } = await import("../src/whoop-client.js");

  const server = createWhoopServer(new WhoopClient(new TokenManager()));
  const handler = (server as unknown as { _requestHandlers: Map<string, (req: unknown) => Promise<unknown>> })
    ._requestHandlers.get("tools/call");

  const response = await handler!({
    method: "tools/call",
    params: { name: "get_recovery_trend", arguments: { days: 3 } },
  }) as { content: Array<{ type: string; text: string }> };

  const data = JSON.parse(response.content[0].text) as {
    records: Array<{ date: string; recovery_score: number; hrv: number }>;
    avg_recovery: number;
    avg_hrv: number;
  };

  assert.equal(data.records.length, 3, "should return 3 records");
  assert.ok(typeof data.avg_recovery === "number", "avg_recovery should be a number");
  assert.ok(typeof data.avg_hrv === "number", "avg_hrv should be a number");

  // avg_recovery = (80 + 70 + 90) / 3 = 80
  assert.equal(Math.round(data.avg_recovery), 80, "avg_recovery should be 80");
  // avg_hrv = (60 + 50 + 70) / 3 = 60
  assert.equal(Math.round(data.avg_hrv), 60, "avg_hrv should be 60");

  // Each record should have date, recovery_score, hrv
  for (const rec of data.records) {
    assert.ok(typeof rec.date === "string", "record.date should be a string");
    assert.ok(typeof rec.recovery_score === "number", "record.recovery_score should be a number");
    assert.ok(typeof rec.hrv === "number", "record.hrv should be a number");
  }

  delete process.env.WHOOP_ACCESS_TOKEN;
});

test("get_recovery_trend is listed in tools/list", async () => {
  const { createWhoopServer } = await import("../src/server.js");
  const { TokenManager } = await import("../src/auth.js");
  const { WhoopClient } = await import("../src/whoop-client.js");

  const server = createWhoopServer(new WhoopClient(new TokenManager()));
  const handler = (server as unknown as { _requestHandlers: Map<string, (req: unknown) => Promise<unknown>> })
    ._requestHandlers.get("tools/list");

  const response = await handler!({ method: "tools/list", params: {} }) as { tools: Array<{ name: string }> };
  const toolNames = response.tools.map((t) => t.name);
  assert.ok(toolNames.includes("get_recovery_trend"), "tools/list should include get_recovery_trend");

  delete process.env.WHOOP_ACCESS_TOKEN;
});
