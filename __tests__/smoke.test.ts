import { test } from "node:test";
import assert from "node:assert/strict";

test("MCP SDK is importable", async () => {
  const { Server } = await import("@modelcontextprotocol/sdk/server/index.js");
  assert.ok(Server, "Server class should be exported from MCP SDK");
});

test("config exports expected constants", async () => {
  const config = await import("../src/config.js");
  assert.ok(config.WHOOP_BASE_URL, "WHOOP_BASE_URL should be defined");
  assert.ok(config.WHOOP_AUTH_URL, "WHOOP_AUTH_URL should be defined");
  assert.ok(config.WHOOP_TOKEN_URL, "WHOOP_TOKEN_URL should be defined");
  assert.ok(Array.isArray(config.WHOOP_SCOPES), "WHOOP_SCOPES should be an array");
  assert.ok(config.WHOOP_SCOPES.length > 0, "WHOOP_SCOPES should not be empty");
  assert.ok(typeof config.CACHE_TTL_MS === "number", "CACHE_TTL_MS should be a number");
  assert.ok(typeof config.BODY_CACHE_TTL_MS === "number", "BODY_CACHE_TTL_MS should be a number");
});
