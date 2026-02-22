const PLACEHOLDER_TOKENS = new Set([
  "your_access_token_here",
  "xxx",
  "",
]);

export class TokenManager {
  /**
   * Returns the current access token.
   * Phase 1: reads from WHOOP_ACCESS_TOKEN env var.
   * Phase 2: will add encrypted storage + OAuth refresh.
   */
  getAccessToken(): string {
    const token = process.env.WHOOP_ACCESS_TOKEN;
    if (!token || PLACEHOLDER_TOKENS.has(token)) {
      throw new Error(
        "WHOOP_ACCESS_TOKEN is not set or is a placeholder. " +
        "Set a valid access token in your .env file, or complete the OAuth flow " +
        "(implemented in Phase 2)."
      );
    }
    return token;
  }
}
