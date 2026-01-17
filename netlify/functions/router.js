
// ======================================================
// ⚙️ router_v3.6.2.js
// Unified Odds + Player Props + Roster Management
// Includes Sport Key Mapping + Safer Fetch + Auto-Cache
// ======================================================

import fetch from "node-fetch";

let cache = {
  odds: null,
  props: null,
  rosters: {},
};
let timestamps = {};

// --------------------------------------------
// Utility: Retry with exponential backoff
// --------------------------------------------
async function safeFetch(url, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
      console.warn(`[Attempt ${attempt}] Failed (${res.status}) for ${url}`);
    } catch (err) {
      console.warn(`[Attempt ${attempt}] Error: ${err.message}`);
    }
    await new Promise(r => setTimeout(r, 1000 * attempt));
  }
  return null;
}

// --------------------------------------------
// Utility: Save to cache
// --------------------------------------------
function saveCache(key, data) {
  cache[key] = data;
  timestamps[key] = new Date().toISOString();
}

// --------------------------------------------
// 🧩 Sport Key Mapper (Fixes 404/401 on roster sync)
// --------------------------------------------
const sportMap = {
  americanfootball_nfl: "nfl",
  basketball_nba: "nba",
  icehockey_nhl: "nhl",
  baseball_mlb: "mlb",
  soccer_epl: "soccer",
};

// --------------------------------------------
// Main Handler
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
        details: "Set ODDS_API_KEY and SPORTSDATAIO_KEY in your environment variables.",
      }),
    };
  }

  console.log(`🌀 Router Triggered: ${operation} for ${sport}`);

  // ======================================================
  // 🏈 1. GAME ODDS FETCH + CACHE
  // ======================================================
  if (operation === "getOdds") {
    const baseUrl = `https://api.the-odds-api.com/v4/sports/${sport}/odds`;
    const params = `?regions=us,us2&markets=h2h,spreads,totals,player_props&bookmakers=draftkings,fanduel&oddsFormat=american&dateFormat=iso&apiKey=${ODDS_API_KEY}`;
    let data = await safeFetch(baseUrl + params);

    if (!data) {
      console.warn("⚠️ US/US2 failed, retrying EU fallback...");
      const fallbackUrl = `${baseUrl}?regions=eu&markets=h2h,spreads,totals&oddsFormat=american&apiKey=${ODDS_API_KEY}`;
      data = await safeFetch(fallbackUrl);
    }

    if (!data && cache.odds) {
      console.log("♻️ Serving cached odds from", timestamps.odds);
      return {
        statusCode: 200,
        body: JSON.stringify({
          cached: true,
          timestamp: timestamps.odds,
          data: cache.odds,
        }),
      };
    }

    if (!data) {
      return {
        statusCode: 502,
        body: JSON.stringify({ error: "Odds API upstream failure" }),
      };
    }

    saveCache("odds", data);
    console.log(`✅ Odds cache refreshed @ ${timestamps.odds}`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        cached: false,
        timestamp: timestamps.odds,
        data,
      }),
    };
  }

  // ======================================================
  // 🧩 2. PLAYER PROP CACHING
  // ======================================================
  if (operation === "getProps") {
    const url = `https://api.the-odds-api.com/v4/sports/${sport}/odds?regions=us,us2&markets=player_props&bookmakers=draftkings,fanduel&oddsFormat=american&apiKey=${ODDS_API_KEY}`;
    let data = await safeFetch(url);

    if (!data && cache.props) {
      console.log("♻️ Serving cached props from", timestamps.props);
      return {
        statusCode: 200,
        body: JSON.stringify({
          cached: true,
          timestamp: timestamps.props,
          data: cache.props,
        }),
      };
    }

    if (!data) {
      return {
        statusCode: 502,
        body: JSON.stringify({ error: "Player props API failed" }),
      };
    }

    saveCache("props", data);
    console.log(`✅ Player prop cache refreshed @ ${timestamps.props}`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        cached: false,
        timestamp: timestamps.props,
        data,
      }),
    };
  }

  // ======================================================
  // 🧠 3. ROSTER SYNC (ALL SPORTS) — FIXED ENDPOINT
  // ======================================================
  if (operation === "syncRoster") {
    const apiSport = sportMap[sport] || sport;
    const url = `https://api.sportsdata.io/v3/${apiSport}/scores/json/Players?key=${SPORTS_API_KEY}`;
    const data = await safeFetch(url);

    if (!data) {
      return {
        statusCode: 502,
        body: JSON.stringify({
          error: "Roster sync failed",
          details: "Upstream 404/401 on both v3 and v4 endpoints",
        }),
      };
    }

    saveCache(`${sport}_roster`, data);
    console.log(`✅ ${sport.toUpperCase()} roster synced (${data.length} active)`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `✅ ${sport.toUpperCase()} roster synced successfully.`,
        active_count: data.length,
        timestamp: timestamps[`${sport}_roster`],
      }),
    };
  }

  // ======================================================
  // 🔁 4. AUTO-REFRESH HOOK (for scheduler)
  // ======================================================
  if (operation === "refreshAll") {
    console.log("🕒 Running unified refresh cycle...");
    const sports = ["americanfootball_nfl", "basketball_nba", "icehockey_nhl"];

    for (const s of sports) {
      const apiSport = sportMap[s] || s;
      await safeFetch(
        `https://api.sportsdata.io/v3/${apiSport}/scores/json/Players?key=${SPORTS_API_KEY}`
      );
      await safeFetch(
        `https://api.the-odds-api.com/v4/sports/${s}/odds?regions=us,us2&markets=h2h,spreads,totals&bookmakers=draftkings&apiKey=${ODDS_API_KEY}`
      );
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "✅ All sports refreshed successfully (rosters + odds)",
        timestamp: new Date().toISOString(),
      }),
    };
  }

  // ======================================================
  // ❌ 5. INVALID OPERATION HANDLER
  // ======================================================
  return {
    statusCode: 400,
    body: JSON.stringify({
      error: "Invalid operation",
      valid_operations: [
        "getOdds",
        "getProps",
        "syncRoster",
        "getRosterStatus",
        "refreshAll",
      ],
    }),
  };
};
