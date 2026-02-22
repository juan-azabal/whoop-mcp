# whoop-mcp

MCP server that exposes your [Whoop](https://www.whoop.com) fitness data as tools for Claude. Authenticate once via OAuth 2.0 and then ask Claude about your recovery, sleep, strain, HRV, and workouts.

## What it does

Provides 7 data tools and 4 utility tools:

| Tool | Description |
|------|-------------|
| `get_recovery_today` | Today's recovery score, HRV, resting HR, SpO2, skin temp |
| `get_recovery_trend` | Recovery + HRV trend over N days with averages |
| `get_sleep_last_night` | Sleep performance, SWS, total sleep, disturbances, respiratory rate |
| `get_strain_recent` | Strain per day for the last N days |
| `get_hrv_analysis` | 7d/14d HRV averages, coefficient of variation, trend, deload signal |
| `get_workouts_recent` | Workouts for the last N days with activity type, strain, duration, HR |
| `get_body_measurement` | Weight (kg), height (m), max heart rate |
| `whoop_get_auth_url` | Start the OAuth flow — returns the URL to visit |
| `whoop_exchange_code` | Complete the OAuth flow — exchange the code for tokens |
| `whoop_clear_cache` | Force fresh API data on next call |
| `whoop_status` | Auth status, token source, expiry, cache size |

## Prerequisites

1. A [Whoop developer account](https://developer-dashboard.whoop.com)
2. A registered app with these scopes: `read:recovery`, `read:cycles`, `read:sleep`, `read:workout`, `read:body_measurement`, `offline`
3. Redirect URI set to `http://localhost:3000/callback`
4. Node.js v20+ (no Bun required)

## Setup

### 1. Clone and install

```bash
git clone https://github.com/juan-azabal/whoop-mcp.git
cd whoop-mcp
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:
```
WHOOP_CLIENT_ID=your_client_id
WHOOP_CLIENT_SECRET=your_client_secret
WHOOP_REDIRECT_URI=http://localhost:3000/callback
```

### 3. First-time OAuth flow

Start the server in Claude Desktop (see below), then in Claude:

1. Ask Claude: **"Get my Whoop auth URL"**
   - Claude calls `whoop_get_auth_url` and returns a URL
2. Open that URL in your browser and authorize the app
3. Copy the `code` parameter from the redirect URL (e.g. `http://localhost:3000/callback?code=XXXXX`)
4. Ask Claude: **"Exchange this Whoop code: XXXXX"**
   - Claude calls `whoop_exchange_code` with the code
   - Tokens are saved encrypted to `storage/tokens.json`

From that point on, tokens auto-refresh — no manual steps needed.

> **Quick start (manual token):** If you have an access token from the Whoop developer dashboard, add `WHOOP_ACCESS_TOKEN=xxx` to `.env` and skip the OAuth flow.

## Claude Desktop / Claude Code configuration

Add to your MCP config (usually `~/.claude/mcp_config.json` or Claude Desktop settings):

```json
{
  "mcpServers": {
    "whoop": {
      "command": "node",
      "args": ["--import", "tsx/esm", "/absolute/path/to/whoop-mcp/src/index.ts"],
      "env": {
        "WHOOP_CLIENT_ID": "your_client_id",
        "WHOOP_CLIENT_SECRET": "your_client_secret",
        "WHOOP_REDIRECT_URI": "http://localhost:3000/callback"
      }
    }
  }
}
```

Or if you prefer using the `.env` file, omit the `env` block and load it yourself.

## Running tests

```bash
npm test
```

## Example prompts

- "What's my Whoop recovery score today?"
- "Show me my HRV trend for the last 2 weeks"
- "How did I sleep last night?"
- "What workouts did I do this week?"
- "Should I deload? Check my HRV analysis."
- "What's my body weight in Whoop?"

## Architecture

```
src/
  index.ts          # Entry point — wires server + client + token manager
  server.ts         # MCP server, tool registration, request handlers
  whoop-client.ts   # Whoop API client (fetch, cache, error handling)
  auth.ts           # TokenManager: OAuth, refresh, AES-256-CBC storage
  config.ts         # Constants (URLs, scopes, cache TTLs)
  types.ts          # TypeScript interfaces + runtime type guards
storage/            # Encrypted tokens (gitignored, mode 600)
__tests__/          # node:test test suite (57 tests)
```

## Troubleshooting

**"Re-authorization required"** — Your token expired and refresh failed. Run the OAuth flow again via `whoop_get_auth_url`.

**"Cannot reach Whoop API"** — Check your internet connection. The Whoop API base URL is `https://api.prod.whoop.com`.

**"Rate limited"** — Whoop returned 429. Wait the indicated seconds and try again.

**"No recovery data found for today"** — Whoop sometimes takes a few hours after waking up to score your recovery. Try again later or check the Whoop app.
