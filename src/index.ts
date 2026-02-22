import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { TokenManager } from "./auth.js";
import { WhoopClient } from "./whoop-client.js";
import { createWhoopServer } from "./server.js";

async function checkAuthStatus(tokenManager: TokenManager): Promise<void> {
  // Check env token first
  if (tokenManager.hasValidEnvToken()) {
    console.error("[whoop-mcp] ✅ Auth: env token found (WHOOP_ACCESS_TOKEN)");
    return;
  }

  // Check stored tokens
  const stored = await tokenManager.loadTokens();
  if (!stored) {
    console.error(
      "[whoop-mcp] ⚠️  Not authenticated. Use whoop_get_auth_url in Claude to connect your Whoop account."
    );
    return;
  }

  const now = Date.now();
  const expiresIn = Math.round((stored.expires_at - now) / 1000);

  if (stored.expires_at < now) {
    // Attempt refresh
    console.error("[whoop-mcp] 🔄 Stored token expired — attempting refresh...");
    try {
      await tokenManager.refreshAccessToken();
      console.error("[whoop-mcp] ✅ Auth: token refreshed successfully");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[whoop-mcp] ❌ Token refresh failed: ${msg}`);
      console.error("[whoop-mcp] ⚠️  Use whoop_get_auth_url in Claude to re-authorize.");
    }
  } else {
    console.error(
      `[whoop-mcp] ✅ Auth: stored token valid (expires in ${Math.round(expiresIn / 60)}min)`
    );
  }
}

async function main() {
  const tokenManager = new TokenManager();
  const client = new WhoopClient(tokenManager);
  const server = createWhoopServer(client, tokenManager);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Auth check runs after connecting (non-blocking for startup)
  checkAuthStatus(tokenManager).catch((err) => {
    console.error("[whoop-mcp] Auth check error:", err);
  });

  console.error("[whoop-mcp] Server started (stdio)");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
