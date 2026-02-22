import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { WhoopClient } from "./whoop-client.js";
import { WHOOP_BASE_URL } from "./config.js";

// Suppress unused import warning — WHOOP_BASE_URL used in future steps
void WHOOP_BASE_URL;

function todayISORange(): { start: string; end: string } {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  // Use a small buffer into tomorrow so today's record is included
  const endOfDay = new Date(now);
  endOfDay.setDate(endOfDay.getDate() + 1);
  endOfDay.setHours(0, 0, 0, 0);

  return {
    start: startOfDay.toISOString(),
    end: endOfDay.toISOString(),
  };
}

export function createWhoopServer(client: WhoopClient): Server {
  const server = new Server(
    { name: "whoop-mcp", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  // ── tools/list ──────────────────────────────────────────────────────────────

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "get_recovery_today",
        description:
          "Returns today's Whoop recovery score and physiological metrics: HRV, resting heart rate, SpO2, and skin temperature.",
        inputSchema: {
          type: "object" as const,
          properties: {},
          required: [],
        },
      },
    ],
  }));

  // ── tools/call ──────────────────────────────────────────────────────────────

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name } = request.params;

    if (name === "get_recovery_today") {
      const { start, end } = todayISORange();
      const response = await client.getRecoveryCollection(start, end, 1);

      if (!response.records || response.records.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: "No recovery data found for today." }),
            },
          ],
        };
      }

      const record = response.records[0];
      const output = {
        recovery_score: record.score.recovery_score,
        hrv_rmssd_milli: record.score.hrv_rmssd_milli,
        resting_heart_rate: record.score.resting_heart_rate,
        spo2_percentage: record.score.spo2_percentage,
        skin_temp_celsius: record.score.skin_temp_celsius,
      };

      return {
        content: [{ type: "text", text: JSON.stringify(output) }],
      };
    }

    return {
      content: [{ type: "text", text: JSON.stringify({ error: `Unknown tool: ${name}` }) }],
      isError: true,
    };
  });

  return server;
}
