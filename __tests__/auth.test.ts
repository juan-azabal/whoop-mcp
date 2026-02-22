import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

// We manipulate process.env directly in each test and restore afterwards.
const ORIGINAL_TOKEN = process.env.WHOOP_ACCESS_TOKEN;

beforeEach(() => {
  delete process.env.WHOOP_ACCESS_TOKEN;
});

afterEach(() => {
  if (ORIGINAL_TOKEN !== undefined) {
    process.env.WHOOP_ACCESS_TOKEN = ORIGINAL_TOKEN;
  } else {
    delete process.env.WHOOP_ACCESS_TOKEN;
  }
});

test("TokenManager.getAccessToken() returns token when env var is set", async () => {
  process.env.WHOOP_ACCESS_TOKEN = "test-token-abc123";
  const { TokenManager } = await import("../src/auth.js");
  const tm = new TokenManager();
  const token = tm.getAccessToken();
  assert.equal(token, "test-token-abc123");
});

test("TokenManager.getAccessToken() throws when WHOOP_ACCESS_TOKEN is missing", async () => {
  const { TokenManager } = await import("../src/auth.js");
  const tm = new TokenManager();
  assert.throws(
    () => tm.getAccessToken(),
    (err: unknown) => {
      assert.ok(err instanceof Error, "should throw an Error");
      assert.ok(
        err.message.includes("WHOOP_ACCESS_TOKEN"),
        `error message should mention WHOOP_ACCESS_TOKEN, got: ${err.message}`
      );
      return true;
    }
  );
});

test("TokenManager.getAccessToken() throws when WHOOP_ACCESS_TOKEN is placeholder", async () => {
  process.env.WHOOP_ACCESS_TOKEN = "your_access_token_here";
  const { TokenManager } = await import("../src/auth.js");
  const tm = new TokenManager();
  assert.throws(
    () => tm.getAccessToken(),
    (err: unknown) => {
      assert.ok(err instanceof Error, "should throw an Error");
      return true;
    }
  );
});
