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

function stdDev(nums: number[]): number {
  const mean = avg(nums);
  return Math.sqrt(nums.reduce((sum, n) => sum + Math.pow(n - mean, 2), 0) / nums.length);
}

// ─── Sport ID mapping ─────────────────────────────────────────────────────────

const SPORT_ID_MAP: Record<number, string> = {
  0: "Running",
  1: "Cycling",
  16: "Baseball",
  17: "Basketball",
  18: "Rowing",
  20: "Softball",
  21: "Volleyball",
  22: "Weightlifting",
  24: "Cross Country Skiing",
  25: "Functional Fitness",
  26: "Duathlon",
  27: "Golf",
  28: "Hiking/Rucking",
  29: "Horseback Riding",
  30: "Kayaking",
  31: "Martial Arts",
  32: "Mountain Biking",
  33: "Powerlifting",
  34: "Rock Climbing",
  35: "Paddleboarding",
  36: "Trial Biking",
  37: "Running",
  38: "Swimming",
  39: "Tennis",
  40: "Other",
  41: "Yoga",
  42: "Boxing",
  43: "Fencing",
  44: "Field Hockey",
  45: "Football",
  46: "Soccer",
  47: "Lacrosse",
  48: "Rugby",
  49: "Track & Field",
  51: "Gymnastics",
  52: "Stairmaster",
  53: "Skiing",
  54: "Snowboarding",
  55: "Squash",
  56: "Dance",
  57: "Pilates",
  58: "HIIT",
  59: "Climbing",
  60: "Polo",
  61: "Canoeing",
  62: "Obstacle Course Racing",
  63: "Meditation",
  64: "Motocross",
  65: "Caddying",
  66: "Indoor Cycling",
  67: "Strength Training",
  68: "Surfing",
  69: "Swimming",
  70: "Wheelchair Pushing",
  71: "Wheelchair Racing",
  72: "Waterpolo",
  73: "Walking",
  74: "Ultimate",
  75: "Triathlon",
  76: "Spinning",
  77: "Barre",
  78: "Stage Performance",
  79: "Handball",
  80: "Cricket",
  81: "Ice Bath",
  82: "Commuting",
  83: "Gaming",
  84: "Snowshoeing",
  85: "Motorsports",
  86: "HIIT",
  87: "Roller Skating",
  88: "Ice Skating",
  89: "Stretching",
  90: "Other",
  91: "Badminton",
  92: "Volleyball",
  93: "Disc Golf",
  [-1]: "Activity",
};

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
  {
    name: "get_sleep_last_night",
    description:
      "Returns last night's Whoop sleep data: sleep performance percentage, slow wave sleep, total sleep time, disturbance count, and respiratory rate.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_strain_recent",
    description:
      "Returns Whoop strain data for the last N days with total strain computed across all cycles.",
    inputSchema: {
      type: "object" as const,
      properties: {
        days: {
          type: "number",
          description: "Number of days to look back (default: 3)",
        },
      },
      required: [],
    },
  },
  {
    name: "get_hrv_analysis",
    description:
      "Returns computed HRV analysis: 7-day and 14-day averages, coefficient of variation, trend direction, and deload signal.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_workouts_recent",
    description:
      "Returns recent Whoop workout records for the last N days with activity type, strain, duration, and heart rate data.",
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
  {
    name: "get_body_measurement",
    description:
      "Returns Whoop body measurement data: weight in kg, height in meters, and max heart rate.",
    inputSchema: {
      type: "object" as const,
      properties: {},
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

    // ── get_sleep_last_night ────────────────────────────────────────────────
    if (name === "get_sleep_last_night") {
      const { start, end } = lastNDaysRange(1);
      const response = await client.getSleepCollection(start, end, 1);

      if (!response.records || response.records.length === 0) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: "No sleep data found." }) }],
        };
      }

      const r = response.records[0];
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            sleep_performance_pct: r.score.sleep_performance_percentage,
            sws_milli: r.score.stage_summary.total_slow_wave_sleep_time_milli,
            total_sleep_milli: r.score.stage_summary.total_in_bed_time_milli,
            disturbance_count: r.score.stage_summary.disturbance_count,
            respiratory_rate: r.score.respiratory_rate,
          }),
        }],
      };
    }

    // ── get_strain_recent ───────────────────────────────────────────────────
    if (name === "get_strain_recent") {
      const days = typeof (args as Record<string, unknown>).days === "number"
        ? (args as Record<string, unknown>).days as number
        : 3;
      const { start, end } = lastNDaysRange(days);
      const response = await client.getCycleCollection(start, end, days);

      const records = (response.records ?? []).map((r) => ({
        date: r.start.slice(0, 10),
        strain: r.score.strain,
        avg_hr: r.score.average_heart_rate,
        max_hr: r.score.max_heart_rate,
        kilojoule: r.score.kilojoule,
      }));

      const total_strain = records.reduce((sum, r) => sum + r.strain, 0);

      return {
        content: [{
          type: "text",
          text: JSON.stringify({ records, total_strain }),
        }],
      };
    }

    // ── get_hrv_analysis ────────────────────────────────────────────────────
    if (name === "get_hrv_analysis") {
      const { start, end } = lastNDaysRange(14);
      const response = await client.getRecoveryCollection(start, end, 14);

      const sorted = (response.records ?? [])
        .slice()
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      const hrv_7d = sorted.slice(0, 7).map((r) => r.score.hrv_rmssd_milli);
      const hrv_14d = sorted.map((r) => r.score.hrv_rmssd_milli);

      const hrv_7d_avg = avg(hrv_7d);
      const hrv_14d_avg = avg(hrv_14d);
      const hrv_cv_7d = hrv_7d.length > 0 ? (stdDev(hrv_7d) / hrv_7d_avg) * 100 : 0;

      let trend: "up" | "stable" | "down";
      if (hrv_7d_avg > hrv_14d_avg * 1.05) {
        trend = "up";
      } else if (hrv_7d_avg < hrv_14d_avg * 0.95) {
        trend = "down";
      } else {
        trend = "stable";
      }

      const deload_signal = hrv_cv_7d > 10 || hrv_7d_avg < hrv_14d_avg * 0.9;

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            hrv_7d_avg: Math.round(hrv_7d_avg * 100) / 100,
            hrv_14d_avg: Math.round(hrv_14d_avg * 100) / 100,
            hrv_cv_7d: Math.round(hrv_cv_7d * 100) / 100,
            trend,
            deload_signal,
          }),
        }],
      };
    }

    // ── get_workouts_recent ─────────────────────────────────────────────────
    if (name === "get_workouts_recent") {
      const days = typeof (args as Record<string, unknown>).days === "number"
        ? (args as Record<string, unknown>).days as number
        : 7;
      const { start, end } = lastNDaysRange(days);
      const response = await client.getWorkoutCollection(start, end, days * 5);

      const records = (response.records ?? []).map((r) => ({
        date: r.start.slice(0, 10),
        activity_type: SPORT_ID_MAP[r.sport_id] ?? "Activity",
        strain: r.score.strain,
        duration_min: Math.round(
          (new Date(r.end).getTime() - new Date(r.start).getTime()) / 60000
        ),
        avg_hr: r.score.average_heart_rate,
        max_hr: r.score.max_heart_rate,
      }));

      const total_strain = records.reduce((sum, r) => sum + r.strain, 0);

      return {
        content: [{
          type: "text",
          text: JSON.stringify({ records, count: records.length, total_strain }),
        }],
      };
    }

    // ── get_body_measurement ────────────────────────────────────────────────
    if (name === "get_body_measurement") {
      const body = await client.getBodyMeasurement();
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            weight_kg: body.weight_kilogram,
            height_m: body.height_meter,
            max_heart_rate: body.max_heart_rate,
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
