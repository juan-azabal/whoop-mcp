// ─── Whoop API response types (v2) ───────────────────────────────────────────

export interface WhoopRecoveryScore {
  recovery_score: number;
  hrv_rmssd_milli: number;
  resting_heart_rate: number;
  spo2_percentage: number;
  skin_temp_celsius: number;
}

export interface WhoopRecoveryRecord {
  cycle_id: number;
  created_at: string;
  updated_at: string;
  score_state: string;
  score: WhoopRecoveryScore;
}

export interface WhoopStageSummary {
  total_slow_wave_sleep_time_milli: number;
  total_in_bed_time_milli: number;
  disturbance_count: number;
}

export interface WhoopSleepScore {
  stage_summary: WhoopStageSummary;
  sleep_performance_percentage: number;
  respiratory_rate: number;
}

export interface WhoopSleepRecord {
  id: number;
  start: string;
  end: string;
  score_state: string;
  score: WhoopSleepScore;
}

export interface WhoopCycleScore {
  strain: number;
  average_heart_rate: number;
  max_heart_rate: number;
  kilojoule: number;
}

export interface WhoopCycleRecord {
  id: number;
  start: string;
  end: string;
  score_state: string;
  score: WhoopCycleScore;
}

export interface WhoopWorkoutScore {
  strain: number;
  average_heart_rate: number;
  max_heart_rate: number;
  kilojoule: number;
}

export interface WhoopWorkoutRecord {
  id: number | string;
  start: string;
  end: string;
  sport_id: number | null;
  sport_name?: string | null;
  score_state: string;
  score: WhoopWorkoutScore;
}

export interface WhoopBodyMeasurement {
  height_meter: number;
  weight_kilogram: number;
  max_heart_rate: number;
}

export interface WhoopPaginatedResponse<T> {
  records: T[];
  next_token?: string;
}

// ─── Tool output types ────────────────────────────────────────────────────────

export interface RecoveryTodayOutput {
  recovery_score: number;
  hrv_rmssd_milli: number;
  resting_heart_rate: number;
  spo2_percentage: number;
  skin_temp_celsius: number;
}

export interface RecoveryTrendRecord {
  date: string;
  recovery_score: number;
  hrv: number;
}

export interface RecoveryTrendOutput {
  records: RecoveryTrendRecord[];
  avg_recovery: number;
  avg_hrv: number;
}

export interface SleepLastNightOutput {
  sleep_performance_pct: number;
  sws_milli: number;
  total_sleep_milli: number;
  disturbance_count: number;
  respiratory_rate: number;
}

export interface StrainRecord {
  date: string;
  strain: number;
  avg_hr: number;
  max_hr: number;
  kilojoule: number;
}

export interface StrainRecentOutput {
  records: StrainRecord[];
  total_strain: number;
}

export interface HrvAnalysisOutput {
  hrv_7d_avg: number;
  hrv_14d_avg: number;
  hrv_cv_7d: number;
  trend: "up" | "stable" | "down";
  deload_signal: boolean;
}

export interface WorkoutRecord {
  date: string;
  activity_type: string;
  strain: number;
  duration_min: number;
  avg_hr: number;
  max_hr: number;
}

export interface WorkoutsRecentOutput {
  records: WorkoutRecord[];
  count: number;
  total_strain: number;
}

export interface BodyMeasurementOutput {
  weight_kg: number;
  height_m: number;
  max_heart_rate: number;
}

// ─── Runtime type guards ──────────────────────────────────────────────────────

export function isWhoopRecoveryRecord(v: unknown): v is WhoopRecoveryRecord {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Record<string, unknown>;
  if (typeof r.cycle_id !== "number") return false;
  if (typeof r.created_at !== "string") return false;
  if (typeof r.updated_at !== "string") return false;
  if (typeof r.score_state !== "string") return false;
  if (typeof r.score !== "object" || r.score === null) return false;
  const s = r.score as Record<string, unknown>;
  return (
    typeof s.recovery_score === "number" &&
    typeof s.hrv_rmssd_milli === "number" &&
    typeof s.resting_heart_rate === "number" &&
    typeof s.spo2_percentage === "number" &&
    typeof s.skin_temp_celsius === "number"
  );
}

export function isWhoopSleepRecord(v: unknown): v is WhoopSleepRecord {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Record<string, unknown>;
  if (typeof r.id !== "number") return false;
  if (typeof r.score_state !== "string") return false;
  if (typeof r.score !== "object" || r.score === null) return false;
  const s = r.score as Record<string, unknown>;
  if (typeof s.sleep_performance_percentage !== "number") return false;
  if (typeof s.respiratory_rate !== "number") return false;
  if (typeof s.stage_summary !== "object" || s.stage_summary === null) return false;
  const ss = s.stage_summary as Record<string, unknown>;
  return (
    typeof ss.total_slow_wave_sleep_time_milli === "number" &&
    typeof ss.total_in_bed_time_milli === "number" &&
    typeof ss.disturbance_count === "number"
  );
}

export function isWhoopCycleRecord(v: unknown): v is WhoopCycleRecord {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Record<string, unknown>;
  if (typeof r.id !== "number") return false;
  if (typeof r.score_state !== "string") return false;
  if (typeof r.score !== "object" || r.score === null) return false;
  const s = r.score as Record<string, unknown>;
  return (
    typeof s.strain === "number" &&
    typeof s.average_heart_rate === "number" &&
    typeof s.max_heart_rate === "number" &&
    typeof s.kilojoule === "number"
  );
}

export function isWhoopWorkoutRecord(v: unknown): v is WhoopWorkoutRecord {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Record<string, unknown>;
  if (typeof r.id !== "number") return false;
  if (typeof r.sport_id !== "number") return false;
  if (typeof r.score_state !== "string") return false;
  if (typeof r.score !== "object" || r.score === null) return false;
  const s = r.score as Record<string, unknown>;
  return (
    typeof s.strain === "number" &&
    typeof s.average_heart_rate === "number" &&
    typeof s.max_heart_rate === "number" &&
    typeof s.kilojoule === "number"
  );
}
