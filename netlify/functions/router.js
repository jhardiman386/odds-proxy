/**
 * ============================================================
 * 🧠 UNIFIED SPORTS DATA ROUTER (v3.2.1-LTS)
 * Compatible with Super-Pipeline Orchestrator v3.2+
 * Supports: getOdds, getRosterStatus, syncRoster
 * Netlify-native (ESM) using Response object
 * ============================================================
 */

import fetch from "node-fetch";

// ============================================================
// 🔐 ENVIRONMENT VARIABLES
// ============================================================
const ODDS_API_KEY = process.env.ODDS_API_KEY;
const ROSTER_API_KEY =
  process.env.ROSTER_API_KEY || process.env.SPORTSDATAIO_KEY;

// ============================================================
// 🌎 PRIMARY & FALLBACK ENDPOINTS
// ============================================================
const ENDPOINTS = {
  odds: [
    "https://api.the-odds-api.com/v4/sports",
    "https://api.oddsjam.com/v4/sports",     // fallback 1
    "https://sports-api.io/v4/sports"        // fallback 2
  ],
  roster: [
    "https://api.sportsdata.io/v4",
    "https://backup.sportsdata.io/v4"
  ]
};

// ============================================================
// ⚙️ DEFAULT CONFIG
// ============================================================
const DEFAULTS = {
  region: "us",
  markets: "h2h,spreads,totals,player_props",
  bookmakers: "draftkings,fanduel",
  oddsFormat: "american",
  dateFormat: "iso"
};

// ============================================================
// 🔁 HELPER: TRY MULTIPLE ENDPOINTS UNTIL SUCCESS
// ============================================================
async function tryFetch(urls, opts = {}) {
  for (const url of urls) {
    try {
      const res = await fetch(url, opts);
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn(`❌ ${url} failed: ${err.message}`);
    }
  }
  throw new Error("All endpoints failed.");
}

// ============================================================
// 🚀 MAIN HANDLER (Netlify ESM)
// ============================================================
export default async (req) => {
  try {
    const body = await req.json();
    const {
      operation,
      sport = "americanfootball_nfl",
      regions = DEFAULTS.region,
      markets = DEFAULTS.markets,
      bookmakers = DEFAULTS.bookmakers,
      oddsFormat = DEFAULTS.oddsFormat,
      dateFormat = DEFAULTS.dateFormat
    } = body;

    if (!operation) {
      return new Response(
        JSON.stringify({ message: "Missing required field: operation" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    let payload = {};

    switch (operation) {
      // ========================================================
      // 1️⃣  GET ROSTER STATUS
      // ========================================================
      case "getRosterStatus": {
        const urls = ENDPOINTS.roster.map(
          base => `${base}/${sport}/scores/json/Players?key=${ROSTER_API_KEY}`
        );
        const data = await tryFetch(urls);
        payload = {
          message: "Roster status fetched successfully",
          sport,
          count: data?.length || 0,
          data
        };
        break;
      }

      // ========================================================
      // 2️⃣  SYNC ROSTER (FORCE REFRESH)
      // ========================================================
      case "syncRoster": {
        const urls = ENDPOINTS.roster.map(
          base => `${base}/${sport}/scores/json/Players?key=${ROSTER_API_KEY}`
        );
        const data = await tryFetch(urls, { cache: "no-store" });
        payload = {
          message: "Roster synced successfully",
          sport,
          count: data?.length || 0,
          data
        };
        break;
      }

      // ========================================================
      // 3️⃣  GET ODDS (SPREADS / TOTALS / PROPS)
      // ========================================================
      case "getOdds": {
        const urls = ENDPOINTS.odds.map(
          base =>
            `${base}/${sport}/odds?regions=${regions}&markets=${markets}` +
            `&bookmakers=${bookmakers}&oddsFormat=${oddsFormat}` +
            `&dateFormat=${dateFormat}&apiKey=${ODDS_API_KEY}`
        );
        const data = await tryFetch(urls);
        payload = {
          message: "Odds data retrieved successfully",
          sport,
          region: regions,
          marketCount: data?.length || 0,
          data
        };
        break;
      }

      // ========================================================
      // ❌ UNKNOWN OPERATION
      // ========================================================
      default:
        return new Response(
          JSON.stringify({ message: `Unknown operation: ${operation}` }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
    }

    // ========================================================
    // ✅ SUCCESS RESPONSE
    // ========================================================
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    console.error("Router error:", err);
    return new Response(
      JSON.stringify({ message: "Router function failed", error: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
