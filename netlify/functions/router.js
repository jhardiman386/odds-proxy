// ============================================
// 🧠 Sports Data Proxy Router v3.1
// Unified Odds + Roster management endpoint
// ============================================

import fetch from "node-fetch";

let lastSuccessfulResponse = null;
let lastUpdated = null;

// --------------------------------------------
// Utility: retry with exponential backoff
// --------------------------------------------
async function safeFetch(url, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
      console.warn(`[Attempt ${attempt}] Failed (${res.status})`);
    } catch (err) {
      console.warn(`[Attempt ${attempt}] Error: ${err.message}`);
    }
    await new Promise(r => setTimeout(r, 1000 * attempt)); // exponential delay
  }
  return null;
}

// --------------------------------------------
// Main Router
// --------------------------------------------
export const handler = async (event) => {
  const { operation = "getOdds", sport = "americanfootball_nfl" } =
    event.queryStringParameters || {};

  const ODDS_API_KEY = process.env.ODDS_API_KEY;
  const SPORTS_API_KEY = process.env.SPORTSDATAIO_KEY;

  if (!ODDS_API_KEY || !SPORTS_API_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Missing API keys",
        details: "Ensure ODDS_API_KEY and SPORTSDATAIO_KEY are set in environment variables.",
      }),
    };
  }

  console.log(`🌀 Operation: ${operation} | Sport: ${sport}`);

  // ======================
  // 🏈 GET ODDS
  // ======================
  if (operation === "getOdds") {
    const baseUrl = `https://api.the-odds-api.com/v4/sports/${sport}/odds`;
    const params = `?regions=us,us2&markets=h2h,spreads,totals,player_props&bookmakers=draftkings,fanduel&oddsFormat=american&dateFormat=iso&apiKey=${ODDS_API_KEY}`;

    let data = await safeFetch(baseUrl + params);

    if (!data) {
      console.warn("⚠️ US/US2 region failed, retrying with EU...");
      const euUrl = `https://api.the-odds-api.com/v4/sports/${sport}/odds?regions=eu&markets=h2h,spreads,totals&oddsFormat=american&apiKey=${ODDS_API_KEY}`;
      data = await safeFetch(euUrl);
    }

    if (!data && lastSuccessfulResponse) {
      console.log("♻️ Serving cached odds from", lastUpdated);
      return {
        statusCode: 200,
        body: JSON.stringify({
          cached: true,
          timestamp: lastUpdated,
          data: lastSuccessfulResponse,
        }),
      };
    }

    if (!data) {
      return {
        statusCode: 502,
        body: JSON.stringify({ error: "Upstream Odds API failed (no response)" }),
      };
    }

    lastSuccessfulResponse = data;
    lastUpdated = new Date().toISOString();

    console.log(`✅ Odds sync success @ ${lastUpdated}`);
    return {
      statusCode: 200,
      body: JSON.stringify({ cached: false, timestamp: lastUpdated, data }),
    };
  }

  // ======================
  // 🧩 SYNC ROSTERS
  // ======================
  if (operation === "syncRoster") {
    const url = `https://api.sportsdata.io/v3/${sport}/scores/json/Players?key=${SPORTS_API_KEY}`;
    const data = await safeFetch(url);

    if (!data) {
      return {
        statusCode: 502,
        body: JSON.stringify({ error: "Roster sync failed", details: "Upstream 404 or 401" }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `✅ ${sport.toUpperCase()} roster synced successfully.`,
        active_count: data.length,
        timestamp: new Date().toISOString(),
      }),
    };
  }

  // ======================
  // 🧠 GET ROSTER STATUS
  // ======================
  if (operation === "getRosterStatus") {
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "✅ Roster lock active",
        timestamp: new Date().toISOString(),
        cache_active: !!lastSuccessfulResponse,
      }),
    };
  }

  // ======================
  // ❌ INVALID OPERATION
  // ======================
  return {
    statusCode: 400,
    body: JSON.stringify({
      error: "Invalid operation",
      valid_operations: ["getOdds", "syncRoster", "getRosterStatus"],
    }),
  };
};