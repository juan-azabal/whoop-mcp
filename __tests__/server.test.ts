import { test, mock, beforeEach } from "node:test";
import assert from "node:assert/strict";

// ── helpers ────────────────────────────────────────────────────────────────────

function makeMockRecoveryResponse(score = 82, hrv = 61.5) {
  return {
    records: [
      {
        cycle_id: 100,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        score_state: "SCORED",
        score: {
          recovery_score: score,
          hrv_rmssd_milli: hrv,
          resting_heart_rate: 53,
          spo2_percentage: 97.2,
          skin_temp_celsius: 33.1,
        },
      },
    ],
    next_token: null,
  };
}

// ── tests ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mock.restoreAll();
  process.env.WHOOP_ACCESS_TOKEN = "mock-token";
});

test("createWhoopServer is importable and returns an MCP Server", async () => {
  const { createWhoopServer } = await import("../src/server.js");
  assert.ok(typeof createWhoopServer === "function", "createWhoopServer should be a function");
});

test("get_recovery_today returns expected shape", async () => {
  // Mock global fetch
  const fakeResp = makeMockRecoveryResponse(75, 58.3);
  global.fetch = mock.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => fakeResp,
  })) as unknown as typeof fetch;

  const { createWhoopServer } = await import("../src/server.js");
  const { TokenManager } = await import("../src/auth.js");
  const { WhoopClient } = await import("../src/whoop-client.js");

  const tm = new TokenManager();
  const client = new WhoopClient(tm);
  const server = createWhoopServer(client);

  // Call the tool handler directly via the internal registry
  // The MCP SDK Server exposes _requestHandlers; we reach in for testing.
  // Instead, we test via the public interface: call the handler registered
  // for "tools/call" with the tool name.
  const handler = (server as unknown as { _requestHandlers: Map<string, (req: unknown) => Promise<unknown>> })
    ._requestHandlers.get("tools/call");

  assert.ok(handler, "tools/call handler should be registered");

  const response = await handler({
    method: "tools/call",
    params: { name: "get_recovery_today", arguments: {} },
  }) as { content: Array<{ type: string; text: string }> };

  assert.ok(response.content, "response should have content");
  assert.equal(response.content[0].type, "text", "content type should be text");

  const data = JSON.parse(response.content[0].text) as {
    recovery_score: number;
    hrv_rmssd_milli: number;
    resting_heart_rate: number;
    spo2_percentage: number;
    skin_temp_celsius: number;
  };
  assert.equal(data.recovery_score, 75, "recovery_score should match");
  assert.equal(data.hrv_rmssd_milli, 58.3, "hrv_rmssd_milli should match");
  assert.ok(typeof data.resting_heart_rate === "number", "resting_heart_rate should be a number");
  assert.ok(typeof data.spo2_percentage === "number", "spo2_percentage should be a number");
  assert.ok(typeof data.skin_temp_celsius === "number", "skin_temp_celsius should be a number");

  delete process.env.WHOOP_ACCESS_TOKEN;
});

test("server lists get_recovery_today in tools/list", async () => {
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
  assert.ok(toolNames.includes("get_recovery_today"), "tools/list should include get_recovery_today");

  delete process.env.WHOOP_ACCESS_TOKEN;
});
