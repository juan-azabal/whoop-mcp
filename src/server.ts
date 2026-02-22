import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { WhoopClient } from "./whoop-client.js";

// ─── Date helpers ─────────────────────────────────────────────────────────────

function todayISORange(): { start: string; end: string } {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(now);
  endOfDay.setDate(endOfDay.getDate() + 1);
  endOfDay.setHours(0, 0, 0, 0);

  return {
    start: startOfDay.toISOString(),
    end: endOfDay.toISOString(),
  };
}

function lastNDaysRange(days: number): { start: string; end: string } {
  const now = new Date();
  const end = new Date(now);
  end.setDate(end.getDate() + 1);
  end.setHours(0, 0, 0, 0);

  const start = new Date(now);
  start.setDate(start.getDate() - days);
  start.setHours(0, 0, 0, 0);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

// ─── Tool definitions (for tools/list) ───────────────────────────────────────

const TOOL_DEFINITIONS = [
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
  {
    name: "get_recovery_trend",
    description:
      "Returns Whoop recovery data for the last N days with computed averages for recovery score and HRV.",
    inputSchema: {
      type: "object" as const,
      properties: {
        days: {
          type: "number",
          description: "Number of days to look back (default: 7)",
        },
      },
      required: [],
    },
  },
];

// ─── Server factory ───────────────────────────────────────────────────────────

export function createWhoopServer(client: WhoopClient): Server {
  const server = new Server(
    { name: "whoop-mcp", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  // ── tools/list ──────────────────────────────────────────────────────────────

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOL_DEFINITIONS,
  }));

  // ── tools/call ──────────────────────────────────────────────────────────────

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;

    // ── get_recovery_today ──────────────────────────────────────────────────
    if (name === "get_recovery_today") {
      const { start, end } = todayISORange();
      const response = await client.getRecoveryCollection(start, end, 1);

      if (!response.records || response.records.length === 0) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: "No recovery data found for today." }) }],
        };
      }

      const r = response.records[0];
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            recovery_score: r.score.recovery_score,
            hrv_rmssd_milli: r.score.hrv_rmssd_milli,
            resting_heart_rate: r.score.resting_heart_rate,
            spo2_percentage: r.score.spo2_percentage,
            skin_temp_celsius: r.score.skin_temp_celsius,
          }),
        }],
      };
    }

    // ── get_recovery_trend ──────────────────────────────────────────────────
    if (name === "get_recovery_trend") {
      const days = typeof (args as Record<string, unknown>).days === "number"
        ? (args as Record<string, unknown>).days as number
        : 7;
      const { start, end } = lastNDaysRange(days);
      const response = await client.getRecoveryCollection(start, end, days);

      const records = (response.records ?? []).map((r) => ({
        date: r.created_at.slice(0, 10),
        recovery_score: r.score.recovery_score,
        hrv: r.score.hrv_rmssd_milli,
      }));

      const avgRecovery = avg(records.map((r) => r.recovery_score));
      const avgHrv = avg(records.map((r) => r.hrv));

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            records,
            avg_recovery: Math.round(avgRecovery * 10) / 10,
            avg_hrv: Math.round(avgHrv * 10) / 10,
          }),
        }],
      };
    }

    return {
      content: [{ type: "text", text: JSON.stringify({ error: `Unknown tool: ${name}` }) }],
      isError: true,
    };
  });

  return server;
}
