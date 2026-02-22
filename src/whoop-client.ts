import { WHOOP_BASE_URL, CACHE_TTL_MS } from "./config.js";
import { TokenManager } from "./auth.js";
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

export class WhoopRateLimitError extends Error {
  constructor(public readonly retryAfter: number) {
    super(`Rate limited. Retry after ${retryAfter}s.`);
    this.name = "WhoopRateLimitError";
  }
}

// ─── Cache ────────────────────────────────────────────────────────────────────

interface CacheEntry {
  data: unknown;
  expiresAt: number;
}

// ─── Client ───────────────────────────────────────────────────────────────────

export class WhoopClient {
  private cache = new Map<string, CacheEntry>();
  private readonly cacheTtlMs: number;

  constructor(private readonly tokenManager: TokenManager, cacheTtlMs = CACHE_TTL_MS) {
    this.cacheTtlMs = cacheTtlMs;
  }

  clearCache(): void {
    this.cache.clear();
  }

  getCacheSize(): number {
    return this.cache.size;
  }

  private cacheKey(path: string, params: Record<string, string | number>): string {
    return `${path}:${JSON.stringify(params)}`;
  }

  private authHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.tokenManager.getAccessToken()}`,
      "Content-Type": "application/json",
    };
  }

  private async get<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
    // Check cache first
    const key = this.cacheKey(path, params);
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data as T;
    }

    const url = new URL(`${WHOOP_BASE_URL}${path}`);
    for (const [k, value] of Object.entries(params)) {
      url.searchParams.set(k, String(value));
    }

    const doRequest = async () => {
      return fetch(url.toString(), {
        method: "GET",
        headers: this.authHeaders(),
      });
    };

    const response = await doRequest();

    if (response.status === 401) {
      // Try to refresh and retry once
      try {
        await this.tokenManager.refreshAccessToken();
        const retryResponse = await doRequest();
        if (retryResponse.status === 401) throw new WhoopAuthError();
        if (retryResponse.status === 429) {
          const retryAfter = parseInt(retryResponse.headers.get("Retry-After") ?? "60", 10);
          throw new WhoopRateLimitError(retryAfter);
        }
        if (!retryResponse.ok) throw new WhoopApiError(retryResponse.status, `Whoop API error: ${retryResponse.status}`);
        const result = await retryResponse.json() as T;
        this.cache.set(key, { data: result, expiresAt: Date.now() + this.cacheTtlMs });
        return result;
      } catch (e) {
        if (e instanceof WhoopAuthError || e instanceof WhoopRateLimitError || e instanceof WhoopApiError) throw e;
        throw new WhoopAuthError();
      }
    }

    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get("Retry-After") ?? "60", 10);
      throw new WhoopRateLimitError(retryAfter);
    }

    if (!response.ok) {
      throw new WhoopApiError(response.status, `Whoop API error: ${response.status}`);
    }

    const result = await response.json() as T;
    this.cache.set(key, { data: result, expiresAt: Date.now() + this.cacheTtlMs });
    return result;
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
    return this.get<WhoopPaginatedResponse<WhoopSleepRecord>>("/activity/sleep", {
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
    return this.get<WhoopPaginatedResponse<WhoopWorkoutRecord>>("/activity/workout", {
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
