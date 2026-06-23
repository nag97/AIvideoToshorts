/**
 * Upstash Redis Client
 * Initializes and exports a REST-based Redis client
 */

const { Redis } = require("@upstash/redis");

if (
  !process.env.UPSTASH_REDIS_REST_URL ||
  !process.env.UPSTASH_REDIS_REST_TOKEN
) {
  console.error(
    "ERROR: Missing Upstash Redis credentials in environment variables.",
  );
  console.error(
    "Please set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN",
  );
  process.exit(1);
}

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

console.log("[Redis] Upstash Redis client initialized");

module.exports = redis;
