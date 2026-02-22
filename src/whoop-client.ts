import { WHOOP_BASE_URL } from "./config.js";
import type { TokenManager } from "./auth.js";
import type {
  WhoopRecoveryRecord,
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
   * @param start ISO date string "YYYY-MM-DD"
   * @param end   ISO date string "YYYY-MM-DD"
   * @param limit max records to return (1-25, Whoop default)
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
}
