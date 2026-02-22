# whoop-mcp

MCP server that exposes Whoop fitness data (recovery, sleep, strain, HRV) as tools consumable by Claude. Authenticates via OAuth 2.0 with the Whoop v2 API and provides computed metrics for autoregulated training decisions.

## Commands

```bash
# Run the server
npm start

# Run tests
npm test

# Type-check without emitting
npm run typecheck

# Build to dist/
npm run build
```

## Architecture

- **Runtime**: Node.js (ESM, TypeScript via tsx)
- **MCP SDK**: `@modelcontextprotocol/sdk` (official)
- **Auth**: OAuth 2.0 Authorization Code flow (Whoop v2 API)
- **Token storage**: `storage/tokens.json` (encrypted, AES-256-CBC, gitignored)
- **Caching**: in-memory, 5 min TTL (recovery/sleep/strain), 24h TTL (body measurements)

## Directory layout

```
src/
  index.ts          # Entry point — wires up server + client + token manager
  server.ts         # MCP server setup and tool registration
  whoop-client.ts   # Whoop API client (fetch calls, pagination)
  auth.ts           # OAuth token management + encrypted storage
  config.ts         # Configuration constants (URLs, scopes, TTLs)
  types.ts          # TypeScript interfaces for Whoop API and tool outputs
__tests__/          # Tests (node:test runner)
storage/            # Token storage (gitignored)
.env.example        # Template for required env vars
```

## Environment variables

```
WHOOP_CLIENT_ID=xxx
WHOOP_CLIENT_SECRET=xxx
WHOOP_REDIRECT_URI=http://localhost:3000/callback
# Phase 1 only (before OAuth flow):
WHOOP_ACCESS_TOKEN=xxx
```

## Whoop API

- Base URL: `https://api.prod.whoop.com/developer/v2`
- Auth header: `Authorization: Bearer {access_token}`
- Pagination: `next_token` field in responses → pass as `?nextToken=xxx`
- Rate limits: 429 with `Retry-After` header

## Tools exposed

| Tool | Params | Returns |
|------|--------|---------|
| `get_recovery_today` | — | recovery_score, hrv_rmssd_milli, resting_heart_rate, spo2, skin_temp |
| `get_recovery_trend` | days (default 7) | records[], avg_recovery, avg_hrv |
| `get_sleep_last_night` | — | sleep_performance_pct, sws_milli, total_sleep_milli, disturbance_count, respiratory_rate |
| `get_strain_recent` | days (default 3) | records[], total_strain |
| `get_hrv_analysis` | — | hrv_7d_avg, hrv_14d_avg, hrv_cv_7d, trend, deload_signal |
| `get_workouts_recent` | days (default 7) | records[], count, total_strain |
| `get_body_measurement` | — | weight_kg, height_m, max_heart_rate |

## Test conventions

- Test runner: `node --test` with `tsx/esm` loader
- Test location: `__tests__/` at root
- Pattern: write test FIRST (must fail) → implement → verify all green
- Never modify tests from previous steps
