import { test, mock, beforeEach } from "node:test";
import assert from "node:assert/strict";

const MOCK_BODY_RESPONSE = {
  height_meter: 1.75,
  weight_kilogram: 70.5,
  max_heart_rate: 190,
};

beforeEach(() => {
  mock.restoreAll();
  process.env.WHOOP_ACCESS_TOKEN = "mock-token";
});

test("get_body_measurement is listed in tools/list", async () => {
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
  assert.ok(toolNames.includes("get_body_measurement"), "tools/list should include get_body_measurement");

  delete process.env.WHOOP_ACCESS_TOKEN;
});

test("get_body_measurement returns expected shape", async () => {
  global.fetch = mock.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => MOCK_BODY_RESPONSE,
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
    params: { name: "get_body_measurement", arguments: {} },
  }) as { content: Array<{ type: string; text: string }> };

  assert.ok(response.content, "response should have content");
  assert.equal(response.content[0].type, "text");

  const data = JSON.parse(response.content[0].text) as {
    weight_kg: number;
    height_m: number;
    max_heart_rate: number;
  };

  assert.equal(data.weight_kg, 70.5, "weight_kg should be 70.5");
  assert.equal(data.height_m, 1.75, "height_m should be 1.75");
  assert.equal(data.max_heart_rate, 190, "max_heart_rate should be 190");

  delete process.env.WHOOP_ACCESS_TOKEN;
});
