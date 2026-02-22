import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync, chmodSync } from "node:fs";
import { join } from "node:path";

// ─── Constants ────────────────────────────────────────────────────────────────

const PLACEHOLDER_TOKENS = new Set([
  "your_access_token_here",
  "xxx",
  "",
]);

const DEFAULT_STORAGE_DIR = join(process.cwd(), "storage");
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
   * Phase 2: OAuth refresh is wired up in getValidAccessToken().
   */
  getAccessToken(): string {
    const envToken = process.env.WHOOP_ACCESS_TOKEN;
    if (envToken && !PLACEHOLDER_TOKENS.has(envToken)) {
      return envToken;
    }

    // Fall back to stored tokens (loaded synchronously for simplicity)
    const stored = this.loadTokensSync();
    if (stored) {
      return stored.access_token;
    }

    throw new Error(
      "WHOOP_ACCESS_TOKEN is not set and no stored tokens found. " +
      "Set a valid access token in your .env file, or complete the OAuth flow " +
      "using whoop_get_auth_url and whoop_exchange_code."
    );
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
    // Ensure 600 even if file already existed with different perms
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

  private loadTokensSync(): StoredTokens | null {
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

    // Generate new 256-bit key
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
