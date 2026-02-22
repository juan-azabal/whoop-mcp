import { WHOOP_BASE_URL } from "./config.js";
import type { TokenManager } from "./auth.js";
import type {
  WhoopRecoveryRecord,
  WhoopSleepRecord,
  WhoopCycleRecord,
  WhoopWorkoutRecord,
  WhoopBodyMeasurement,
  WhoopPaginatedResponse,
} from "./types.js";

// ─── Custom errors ────────────────────────────────────────────────────────────

export class WhoopAuthError extends Error {
  constructor(message = "Whoop token expired or invalid (401).") {
    super(message);
    this.name = "WhoopAuthError";
  }
}

export class WhoopApiError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "WhoopApiError";
  }
}

// ─── Client ───────────────────────────────────────────────────────────────────

export class WhoopClient {
  constructor(private readonly tokenManager: TokenManager) {}

  private authHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.tokenManager.getAccessToken()}`,
      "Content-Type": "application/json",
    };
  }

  private async get<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
    const url = new URL(`${WHOOP_BASE_URL}${path}`);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, String(value));
    }

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: this.authHeaders(),
    });

    if (response.status === 401) {
      throw new WhoopAuthError();
    }

    if (!response.ok) {
      throw new WhoopApiError(response.status, `Whoop API error: ${response.status}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Fetches recovery records for a date range.
   */
  async getRecoveryCollection(
    start: string,
    end: string,
    limit: number
  ): Promise<WhoopPaginatedResponse<WhoopRecoveryRecord>> {
    return this.get<WhoopPaginatedResponse<WhoopRecoveryRecord>>("/recovery", {
      start,
      end,
      limit,
    });
  }

  /**
   * Fetches sleep records for a date range.
   */
  async getSleepCollection(
    start: string,
    end: string,
    limit: number
  ): Promise<WhoopPaginatedResponse<WhoopSleepRecord>> {
    return this.get<WhoopPaginatedResponse<WhoopSleepRecord>>("/sleep", {
      start,
      end,
      limit,
    });
  }

  /**
   * Fetches cycle (strain) records for a date range.
   */
  async getCycleCollection(
    start: string,
    end: string,
    limit: number
  ): Promise<WhoopPaginatedResponse<WhoopCycleRecord>> {
    return this.get<WhoopPaginatedResponse<WhoopCycleRecord>>("/cycle", {
      start,
      end,
      limit,
    });
  }

  /**
   * Fetches workout records for a date range.
   */
  async getWorkoutCollection(
    start: string,
    end: string,
    limit: number
  ): Promise<WhoopPaginatedResponse<WhoopWorkoutRecord>> {
    return this.get<WhoopPaginatedResponse<WhoopWorkoutRecord>>("/workout", {
      start,
      end,
      limit,
    });
  }

  /**
   * Fetches body measurement data.
   */
  async getBodyMeasurement(): Promise<WhoopBodyMeasurement> {
    return this.get<WhoopBodyMeasurement>("/user/measurement/body");
  }
}
