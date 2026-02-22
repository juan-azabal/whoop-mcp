export const WHOOP_BASE_URL = "https://api.prod.whoop.com/developer/v2";
export const WHOOP_AUTH_URL = "https://api.prod.whoop.com/oauth/oauth2/auth";
export const WHOOP_TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token";

export const WHOOP_SCOPES = [
  "read:recovery",
  "read:cycles",
  "read:sleep",
  "read:workout",
  "read:body_measurement",
  "offline",
];

export const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
export const BODY_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
