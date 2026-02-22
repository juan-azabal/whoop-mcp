import { test, mock, beforeEach } from "node:test";
import assert from "node:assert/strict";

const MOCK_CYCLE_RESPONSE = {
  records: [
    {
      id: 1,
      start: "2024-01-15T00:00:00Z",
      end: "2024-01-15T23:59:59Z",
      score_state: "SCORED",
      score: { strain: 14.5, average_heart_rate: 72, max_heart_rate: 165, kilojoule: 9500 },
    },
    {
      id: 2,
      start: "2024-01-14T00:00:00Z",
      end: "2024-01-14T23:59:59Z",
      score_state: "SCORED",
      score: { strain: 12.0, average_heart_rate: 68, max_heart_rate: 155, kilojoule: 8000 },
    },
  ],
};

beforeEach(() => {
  mock.restoreAll();
  process.env.WHOOP_ACCESS_TOKEN = "mock-token";
});

test("get_strain_recent is listed in tools/list", async () => {
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
  assert.ok(toolNames.includes("get_strain_recent"), "tools/list should include get_strain_recent");

  delete process.env.WHOOP_ACCESS_TOKEN;
});

test("get_strain_recent returns expected shape with total_strain", async () => {
  global.fetch = mock.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => MOCK_CYCLE_RESPONSE,
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
    params: { name: "get_strain_recent", arguments: {} },
  }) as { content: Array<{ type: string; text: string }> };

  assert.ok(response.content, "response should have content");
  assert.equal(response.content[0].type, "text");

  const data = JSON.parse(response.content[0].text) as {
    records: Array<{ date: string; strain: number; avg_hr: number; max_hr: number; kilojoule: number }>;
    total_strain: number;
  };

  assert.equal(data.records.length, 2, "records.length should be 2");
  assert.ok(Math.abs(data.total_strain - 26.5) < 0.001, `total_strain should be ~26.5, got ${data.total_strain}`);
  assert.ok(typeof data.records[0].date === "string", "date should be a string");
  assert.ok(typeof data.records[0].strain === "number", "strain should be a number");
  assert.ok(typeof data.records[0].avg_hr === "number", "avg_hr should be a number");
  assert.ok(typeof data.records[0].max_hr === "number", "max_hr should be a number");
  assert.ok(typeof data.records[0].kilojoule === "number", "kilojoule should be a number");

  delete process.env.WHOOP_ACCESS_TOKEN;
});
