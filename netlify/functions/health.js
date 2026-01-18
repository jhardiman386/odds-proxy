/**
 * ============================================================
 * 🩺 SUPER-PIPELINE HEALTH CHECK (v3.2.1-LTS)
 * Purpose: Verify function runtime, API key presence, and uptime
 * ============================================================
 */

import fetch from "node-fetch";

const ODDS_API_KEY = process.env.ODDS_API_KEY;
const ROSTER_API_KEY =
  process.env.ROSTER_API_KEY || process.env.SPORTSDATAIO_KEY;

// simple helper to test external API reachability (fast HEAD ping)
async function ping(url) {
  try {
    const res = await fetch(url, { method: "HEAD", timeout: 4000 });
    return res.ok ? "ok" : `fail (${res.status})`;
  } catch (err) {
    return `error (${err.message})`;
  }
}

export default async () => {
  const start = Date.now();
  const timestamp = new Date().toISOString();

  const oddsKeySet = !!ODDS_API_KEY;
  const rosterKeySet = !!ROSTER_API_KEY;

  // test external reachability (non-blocking)
  const oddsPing = await ping("https://api.the-odds-api.com");
  const rosterPing = await ping("https://api.sportsdata.io");

  const health = {
    status: "ok",
    timestamp,
    uptime_ms: Date.now() - start,
    keys: {
      odds_api_key: oddsKeySet ? "present" : "missing",
      roster_api_key: rosterKeySet ? "present" : "missing"
    },
    connectivity: {
      odds_api: oddsPing,
      roster_api: rosterPing
    },
    environment: {
      node_version: process.version,
      region: process.env.REGION || "us"
    }
  };

  const statusCode =
    oddsKeySet && rosterKeySet && oddsPing === "ok" && rosterPing === "ok"
      ? 200
      : 500;

  return new Response(JSON.stringify(health, null, 2), {
    status: statusCode,
    headers: { "Content-Type": "application/json" }
  });
};
