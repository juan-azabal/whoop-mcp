import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { TokenManager } from "./auth.js";
import { WhoopClient } from "./whoop-client.js";
import { createWhoopServer } from "./server.js";

async function main() {
  const tokenManager = new TokenManager();
  const client = new WhoopClient(tokenManager);
  const server = createWhoopServer(client);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("whoop-mcp server started (stdio)");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
