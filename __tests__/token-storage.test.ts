import { test, after } from "node:test";
import assert from "node:assert/strict";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";

// Use a temp storage dir so we don't pollute the real storage/
const TEST_STORAGE_DIR = join(process.cwd(), "storage", "__test__");

after(() => {
  if (existsSync(TEST_STORAGE_DIR)) {
    rmSync(TEST_STORAGE_DIR, { recursive: true, force: true });
  }
});

test("TokenManager.saveTokens() and loadTokens() round-trip", async () => {
  const { TokenManager } = await import("../src/auth.js");
  const tm = new TokenManager(TEST_STORAGE_DIR);

  const expiresAt = Date.now() + 3600_000;
  await tm.saveTokens("access-abc", "refresh-xyz", expiresAt);

  const loaded = await tm.loadTokens();
  assert.ok(loaded, "loadTokens() should return tokens after saving");
  assert.equal(loaded!.access_token, "access-abc", "access_token should survive round-trip");
  assert.equal(loaded!.refresh_token, "refresh-xyz", "refresh_token should survive round-trip");
  assert.equal(loaded!.expires_at, expiresAt, "expires_at should survive round-trip");
});

test("tokens file is encrypted (not plain JSON)", async () => {
  const { TokenManager } = await import("../src/auth.js");
  const tm = new TokenManager(TEST_STORAGE_DIR);

  await tm.saveTokens("secret-token", "secret-refresh", Date.now() + 3600_000);

  // Read raw file — should NOT contain the plain access token
  const { readFileSync } = await import("node:fs");
  const tokenFilePath = join(TEST_STORAGE_DIR, "tokens.json");
  const raw = readFileSync(tokenFilePath, "utf-8");
  assert.ok(!raw.includes("secret-token"), "tokens file should not contain plain access token");
  assert.ok(!raw.includes("secret-refresh"), "tokens file should not contain plain refresh token");
});

test("token files have restrictive permissions (600)", async () => {
  const { TokenManager } = await import("../src/auth.js");
  const tm = new TokenManager(TEST_STORAGE_DIR);

  await tm.saveTokens("access-abc", "refresh-xyz", Date.now() + 3600_000);

  const { statSync } = await import("node:fs");
  const tokenFilePath = join(TEST_STORAGE_DIR, "tokens.json");
  const keyFilePath = join(TEST_STORAGE_DIR, ".encryption_key");

  const tokenMode = statSync(tokenFilePath).mode & 0o777;
  const keyMode = statSync(keyFilePath).mode & 0o777;

  assert.equal(tokenMode, 0o600, `tokens.json should have mode 600, got ${tokenMode.toString(8)}`);
  assert.equal(keyMode, 0o600, `.encryption_key should have mode 600, got ${keyMode.toString(8)}`);
});

test("loadTokens() returns null when no file exists", async () => {
  const { TokenManager } = await import("../src/auth.js");
  // Use a directory that definitely doesn't exist
  const emptyDir = join(process.cwd(), "storage", "__test_empty__");
  const tm = new TokenManager(emptyDir);

  const result = await tm.loadTokens();
  assert.equal(result, null, "loadTokens() should return null when file doesn't exist");
});
