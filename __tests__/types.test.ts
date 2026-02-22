import { test } from "node:test";
import assert from "node:assert/strict";

// Test that types module exports the expected shapes.
// We import types indirectly by checking that the module resolves
// and that we can use the shapes as TypeScript contracts.
test("types module is importable", async () => {
  const types = await import("../src/types.js");
  // The module should export type guards or at least be importable
  assert.ok(types !== undefined, "types module should be importable");
});

test("WhoopRecoveryRecord shape matches API docs", async () => {
  // Structural check: assign a mock that satisfies the interface.
  // If the interface changes incompatibly, TypeScript will catch it at compile time.
  const { isWhoopRecoveryRecord } = await import("../src/types.js");
  const valid = {
    cycle_id: 1,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    score_state: "SCORED",
    score: {
      recovery_score: 80,
      hrv_rmssd_milli: 65.5,
      resting_heart_rate: 52,
      spo2_percentage: 97.8,
      skin_temp_celsius: 33.2,
    },
  };
  assert.ok(isWhoopRecoveryRecord(valid), "valid record should pass type guard");
  assert.ok(!isWhoopRecoveryRecord({}), "empty object should fail type guard");
  assert.ok(!isWhoopRecoveryRecord({ cycle_id: 1 }), "partial record should fail type guard");
});

test("WhoopSleepRecord shape matches API docs", async () => {
  const { isWhoopSleepRecord } = await import("../src/types.js");
  const valid = {
    id: 1,
    start: "2024-01-01T22:00:00Z",
    end: "2024-01-02T06:00:00Z",
    score_state: "SCORED",
    score: {
      stage_summary: {
        total_slow_wave_sleep_time_milli: 5400000,
        total_in_bed_time_milli: 28800000,
        disturbance_count: 3,
      },
      sleep_performance_percentage: 85,
      respiratory_rate: 15.2,
    },
  };
  assert.ok(isWhoopSleepRecord(valid), "valid sleep record should pass type guard");
  assert.ok(!isWhoopSleepRecord({}), "empty object should fail type guard");
});

test("WhoopCycleRecord shape matches API docs", async () => {
  const { isWhoopCycleRecord } = await import("../src/types.js");
  const valid = {
    id: 1,
    start: "2024-01-01T00:00:00Z",
    end: "2024-01-01T23:59:59Z",
    score_state: "SCORED",
    score: {
      strain: 14.5,
      average_heart_rate: 72,
      max_heart_rate: 165,
      kilojoule: 9500,
    },
  };
  assert.ok(isWhoopCycleRecord(valid), "valid cycle record should pass type guard");
  assert.ok(!isWhoopCycleRecord({}), "empty object should fail type guard");
});

test("WhoopWorkoutRecord shape matches API docs", async () => {
  const { isWhoopWorkoutRecord } = await import("../src/types.js");
  const valid = {
    id: 1,
    start: "2024-01-01T10:00:00Z",
    end: "2024-01-01T11:00:00Z",
    sport_id: 0,
    score_state: "SCORED",
    score: {
      strain: 12.3,
      average_heart_rate: 145,
      max_heart_rate: 180,
      kilojoule: 2400,
    },
  };
  assert.ok(isWhoopWorkoutRecord(valid), "valid workout record should pass type guard");
  assert.ok(!isWhoopWorkoutRecord({}), "empty object should fail type guard");
});
