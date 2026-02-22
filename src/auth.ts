import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync, chmodSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { WHOOP_AUTH_URL, WHOOP_TOKEN_URL, WHOOP_SCOPES } from "./config.js";

// ─── Constants ────────────────────────────────────────────────────────────────

const PLACEHOLDER_TOKENS = new Set([
  "your_access_token_here",
  "xxx",
  "",
]);

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_STORAGE_DIR = join(__dirname, "..", "storage");
const KEY_FILE = ".encryption_key";
const TOKEN_FILE = "tokens.json";
const ALGORITHM = "aes-256-cbc";

// ─── Stored token shape ───────────────────────────────────────────────────────

export interface StoredTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number; // Unix ms
}

// ─── TokenManager ─────────────────────────────────────────────────────────────

export class TokenManager {
  private readonly storageDir: string;

  constructor(storageDir = DEFAULT_STORAGE_DIR) {
    this.storageDir = storageDir;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Returns the current access token.
   * Priority: WHOOP_ACCESS_TOKEN env var > encrypted storage file.
   */
  getAccessToken(): string {
    const envToken = process.env.WHOOP_ACCESS_TOKEN;
    if (envToken && !PLACEHOLDER_TOKENS.has(envToken)) {
      return envToken;
    }

    const stored = this.loadTokensSync();
    if (stored) {
      return stored.access_token;
    }

    throw new Error(
      "WHOOP_ACCESS_TOKEN is not set and no stored tokens found. " +
      "Use whoop_get_auth_url to start the OAuth flow."
    );
  }

  /**
   * Returns true when a valid (non-placeholder) env token is present.
   */
  hasValidEnvToken(): boolean {
    const t = process.env.WHOOP_ACCESS_TOKEN;
    return !!t && !PLACEHOLDER_TOKENS.has(t);
  }

  /**
   * Returns the Whoop OAuth authorization URL for the user to visit.
   */
  getAuthorizationUrl(): string {
    const clientId = process.env.WHOOP_CLIENT_ID;
    const redirectUri = process.env.WHOOP_REDIRECT_URI ?? "http://localhost:3000/callback";

    if (!clientId) {
      throw new Error("WHOOP_CLIENT_ID is not set in .env");
    }

    const state = randomBytes(16).toString("hex");
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: WHOOP_SCOPES.join(" "),
      state,
    });

    return `${WHOOP_AUTH_URL}?${params.toString()}`;
  }

  /**
   * Exchanges an authorization code for access + refresh tokens.
   * Saves the tokens to encrypted storage after a successful exchange.
   */
  async exchangeCode(code: string): Promise<void> {
    const clientId = process.env.WHOOP_CLIENT_ID;
    const clientSecret = process.env.WHOOP_CLIENT_SECRET;
    const redirectUri = process.env.WHOOP_REDIRECT_URI ?? "http://localhost:3000/callback";

    if (!clientId || !clientSecret) {
      throw new Error("WHOOP_CLIENT_ID and WHOOP_CLIENT_SECRET must be set in .env");
    }

    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    });

    const response = await fetch(WHOOP_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!response.ok) {
      throw new Error(`Token exchange failed: ${response.status}`);
    }

    const data = await response.json() as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };

    const expiresAt = Date.now() + data.expires_in * 1000;
    await this.saveTokens(data.access_token, data.refresh_token, expiresAt);
  }

  /**
   * Uses the stored refresh_token to obtain new access + refresh tokens.
   */
  async refreshAccessToken(): Promise<void> {
    const stored = this.loadTokensSync();
    if (!stored?.refresh_token) {
      throw new Error("No refresh token available. Re-authorize via whoop_get_auth_url.");
    }
    const clientId = process.env.WHOOP_CLIENT_ID;
    const clientSecret = process.env.WHOOP_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new Error("WHOOP_CLIENT_ID and WHOOP_CLIENT_SECRET must be set.");
    }
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: stored.refresh_token,
      client_id: clientId,
      client_secret: clientSecret,
    });
    const response = await fetch(WHOOP_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (!response.ok) throw new Error(`Token refresh failed: ${response.status}`);
    const data = await response.json() as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };
    await this.saveTokens(data.access_token, data.refresh_token, Date.now() + data.expires_in * 1000);
  }

  /**
   * Returns a valid access token, auto-refreshing if the stored token is expired.
   * If a valid env token exists, it is returned immediately (no expiry tracking for env tokens).
   */
  async getValidAccessToken(): Promise<string> {
    // If env token exists, return it (no expiry tracking for env tokens)
    const envToken = process.env.WHOOP_ACCESS_TOKEN;
    if (envToken && !PLACEHOLDER_TOKENS.has(envToken)) return envToken;

    const stored = this.loadTokensSync();
    if (!stored) throw new Error("No tokens found. Use whoop_get_auth_url to authorize.");

    // If expired (with 60s buffer), refresh
    if (stored.expires_at < Date.now() + 60_000) {
      await this.refreshAccessToken();
      const refreshed = this.loadTokensSync();
      if (!refreshed) throw new Error("Token refresh succeeded but tokens not saved.");
      return refreshed.access_token;
    }
    return stored.access_token;
  }

  /**
   * Encrypts and saves tokens to storage/tokens.json.
   */
  async saveTokens(
    access_token: string,
    refresh_token: string,
    expires_at: number
  ): Promise<void> {
    this.ensureStorageDir();

    const key = this.getOrCreateKey();
    const iv = randomBytes(16);
    const cipher = createCipheriv(ALGORITHM, key, iv);

    const payload = JSON.stringify({ access_token, refresh_token, expires_at });
    const encrypted = Buffer.concat([cipher.update(payload, "utf8"), cipher.final()]);

    const envelope = JSON.stringify({
      iv: iv.toString("hex"),
      data: encrypted.toString("hex"),
    });

    const tokenPath = join(this.storageDir, TOKEN_FILE);
    writeFileSync(tokenPath, envelope, { encoding: "utf-8", mode: 0o600 });
    chmodSync(tokenPath, 0o600);
  }

  /**
   * Loads and decrypts tokens from storage/tokens.json.
   * Returns null if file doesn't exist.
   */
  async loadTokens(): Promise<StoredTokens | null> {
    return this.loadTokensSync();
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  loadTokensSync(): StoredTokens | null {
    const tokenPath = join(this.storageDir, TOKEN_FILE);
    if (!existsSync(tokenPath)) return null;

    try {
      const raw = readFileSync(tokenPath, "utf-8");
      const { iv, data } = JSON.parse(raw) as { iv: string; data: string };

      const key = this.getOrCreateKey();
      const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, "hex"));
      const decrypted = Buffer.concat([
        decipher.update(Buffer.from(data, "hex")),
        decipher.final(),
      ]);

      return JSON.parse(decrypted.toString("utf-8")) as StoredTokens;
    } catch {
      return null;
    }
  }

  private getOrCreateKey(): Buffer {
    this.ensureStorageDir();
    const keyPath = join(this.storageDir, KEY_FILE);

    if (existsSync(keyPath)) {
      const hex = readFileSync(keyPath, "utf-8").trim();
      return Buffer.from(hex, "hex");
    }

    const key = randomBytes(32);
    writeFileSync(keyPath, key.toString("hex"), { encoding: "utf-8", mode: 0o600 });
    chmodSync(keyPath, 0o600);
    return key;
  }

  private ensureStorageDir(): void {
    if (!existsSync(this.storageDir)) {
      mkdirSync(this.storageDir, { recursive: true });
    }
  }
}
