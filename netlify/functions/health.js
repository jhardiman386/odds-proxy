// netlify/functions/health.js

import fetch from "node-fetch";  // ✅ REQUIRED

export default async () => {
  const start = Date.now();
  const timestamp = new Date().toISOString();

  const ODDS_API_KEY = process.env.ODDS_API_KEY;
  const ROSTER_API_KEY = process.env.ROSTER_API_KEY;

  const oddsPing = await testAPI("https://api.the-odds-api.com");
  const rosterPing = await testAPI("https://api.sportsdata.io");

  const result = {
    status: "ok",
    timestamp,
    uptime_ms: Date.now() - start,
    keys: {
      odds_api_key: ODDS_API_KEY ? "present" : "missing",
      roster_api_key: ROSTER_API_KEY ? "present" : "missing"
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

  return new Response(JSON.stringify(result, null, 2), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
};

async function testAPI(url) {
  try {
    const res = await fetch(url, { method: "HEAD", timeout: 3000 });
    return res.ok ? "ok" : `fail (${res.status})`;
  } catch (err) {
    return `error (${err.message})`;
  }
}
