// ✅ HEALTH CHECK FUNCTION — FIXED AUTH + ENDPOINTS
import fetch from "node-fetch";

export default async () => {
  const start = Date.now();
  const timestamp = new Date().toISOString();

  const ODDS_API_KEY = process.env.ODDS_API_KEY;
  const ROSTER_API_KEY = process.env.ROSTER_API_KEY;

  const oddsPing = await testOddsAPI(ODDS_API_KEY);
  const rosterPing = await testSportsDataIO(ROSTER_API_KEY);

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
      sportsdata_io: rosterPing
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

async function testOddsAPI(apiKey) {
  try {
    const res = await fetch(`https://api.the-odds-api.com/v4/sports/?apiKey=${apiKey}`, {
      timeout: 4000
    });
    return res.ok ? "ok" : `fail (${res.status})`;
  } catch (err) {
    return `error (${err.message})`;
  }
}

async function testSportsDataIO(apiKey) {
  try {
    const res = await fetch("https://api.sportsdata.io/v3/nfl/scores/json/Teams", {
      headers: { "Ocp-Apim-Subscription-Key": apiKey },
      timeout: 4000
    });
    return res.ok ? "ok" : `fail (${res.status})`;
  } catch (err) {
    return `error (${err.message})`;
  }
}
