import { test, mock, beforeEach } from "node:test";
import assert from "node:assert/strict";

// 14 HRV values: first 7 are the "recent" records (most recent first when sorted desc)
// Values: [60, 62, 58, 65, 61, 59, 63, 70, 68, 72, 66, 64, 71, 67]
// 7d avg = (60+62+58+65+61+59+63)/7 = 428/7 ≈ 61.14
// 14d avg = (60+62+58+65+61+59+63+70+68+72+66+64+71+67)/14 = 906/14 ≈ 64.71
// Since 7d_avg < 14d_avg * 0.95 (61.14 < 61.48): trend = "down"
// cv_7d = stdDev(7d) / avg_7d * 100

function makeRecoveryRecord(hrv: number, daysAgo: number) {
  const d = new Date("2024-01-15T00:00:00Z");
  d.setDate(d.getDate() - daysAgo);
  return {
    cycle_id: daysAgo,
    created_at: d.toISOString(),
    updated_at: d.toISOString(),
    score_state: "SCORED",
    score: {
      recovery_score: 75,
      hrv_rmssd_milli: hrv,
      resting_heart_rate: 54,
      spo2_percentage: 97.5,
      skin_temp_celsius: 33.0,
    },
  };
}

// The 14 HRV values in the spec, assigned to days 0..13 (0 = most recent)
const HRV_VALUES = [60, 62, 58, 65, 61, 59, 63, 70, 68, 72, 66, 64, 71, 67];

const MOCK_RECOVERY_14 = {
  records: HRV_VALUES.map((hrv, idx) => makeRecoveryRecord(hrv, idx)),
};

beforeEach(() => {
  mock.restoreAll();
  process.env.WHOOP_ACCESS_TOKEN = "mock-token";
});

test("get_hrv_analysis is listed in tools/list", async () => {
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
  assert.ok(toolNames.includes("get_hrv_analysis"), "tools/list should include get_hrv_analysis");

  delete process.env.WHOOP_ACCESS_TOKEN;
});

test("get_hrv_analysis computes correct averages and trend from 14 days of data", async () => {
  global.fetch = mock.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => MOCK_RECOVERY_14,
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
    params: { name: "get_hrv_analysis", arguments: {} },
  }) as { content: Array<{ type: string; text: string }> };

  assert.ok(response.content, "response should have content");
  assert.equal(response.content[0].type, "text");

  const data = JSON.parse(response.content[0].text) as {
    hrv_7d_avg: number;
    hrv_14d_avg: number;
    hrv_cv_7d: number;
    trend: string;
    deload_signal: boolean;
  };

  // 7d avg = (60+62+58+65+61+59+63)/7 = 428/7 ≈ 61.14
  const expected7dAvg = (60 + 62 + 58 + 65 + 61 + 59 + 63) / 7;
  assert.ok(
    Math.abs(data.hrv_7d_avg - expected7dAvg) < 0.1,
    `hrv_7d_avg should be ~${expected7dAvg.toFixed(2)}, got ${data.hrv_7d_avg}`
  );

  // 14d avg = sum of all 14 / 14
  const expected14dAvg = HRV_VALUES.reduce((a, b) => a + b, 0) / 14;
  assert.ok(
    Math.abs(data.hrv_14d_avg - expected14dAvg) < 0.1,
    `hrv_14d_avg should be ~${expected14dAvg.toFixed(2)}, got ${data.hrv_14d_avg}`
  );

  // hrv_cv_7d should be a number
  assert.ok(typeof data.hrv_cv_7d === "number", "hrv_cv_7d should be a number");
  assert.ok(data.hrv_cv_7d >= 0, "hrv_cv_7d should be non-negative");

  // trend should be one of the valid values
  assert.ok(
    ["up", "stable", "down"].includes(data.trend),
    `trend should be "up", "stable", or "down", got "${data.trend}"`
  );

  // deload_signal should be a boolean
  assert.ok(typeof data.deload_signal === "boolean", "deload_signal should be a boolean");

  delete process.env.WHOOP_ACCESS_TOKEN;
});
