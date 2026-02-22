# Privacy Policy

**Last updated: February 2026**

## Overview

whoop-mcp is a personal MCP (Model Context Protocol) server that connects your Whoop fitness data to Claude AI. It is intended for **personal, non-commercial use only** by a single user.

## Data Collected

This application accesses the following Whoop data categories via the official Whoop API v2:

- **Recovery data**: recovery score, HRV (RMSSD), resting heart rate, SpO2, skin temperature
- **Sleep data**: sleep performance, sleep stages (SWS), total sleep time, disturbances, respiratory rate
- **Strain/Cycle data**: strain score, heart rate, kilojoules burned
- **Workout data**: activity type, strain, duration, heart rate
- **Body measurements**: weight, height, maximum heart rate

## How Data Is Used

All data is used exclusively to:

1. Provide fitness metrics as context to Claude AI for training planning and autoregulation decisions
2. Generate training recommendations via the `climbing-routine-generator` skill

Data is **never**:
- Sold or shared with third parties
- Stored on external servers
- Used for advertising or analytics
- Retained beyond what is needed for the current session (in-memory cache, 5-minute TTL)

## Data Storage

- **OAuth tokens** are stored locally on your device at `storage/tokens.json`, encrypted with AES-256-CBC
- **No fitness data is persisted to disk** — all data is fetched on demand and cached in memory with a 5-minute TTL
- **No database** is used

## Data Transmission

- Data is transmitted between the Whoop API and your local machine over HTTPS
- Data is passed to Claude AI (Anthropic) only as context within your personal Claude session, governed by [Anthropic's Privacy Policy](https://www.anthropic.com/privacy)

## User Rights

As the sole user of this personal application, you retain full control over your data. You can:

- Revoke application access at any time via the [Whoop developer dashboard](https://developer-dashboard.whoop.com) or your Whoop account settings
- Delete locally stored tokens by removing `storage/tokens.json`

## Contact

This is a personal project. For questions, open an issue at [github.com/juan-azabal/whoop-mcp](https://github.com/juan-azabal/whoop-mcp).
