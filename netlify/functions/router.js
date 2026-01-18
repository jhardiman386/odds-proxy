/**
 * UNIFIED SPORTS DATA ROUTER (v3.2.1-LTS)
 * Resilient version — supports multi-endpoint + fallback chains
 * Works with Super-Pipeline Orchestrator v3.2.x
 */

import fetch from "node-fetch";

const ODDS_API_KEY = process.env.ODDS_API_KEY;
const ROSTER_API_KEY = process.env.ROSTER_API_KEY;

// --- Primary & fallback endpoints
const ENDPOINTS = {
  odds: [
    "https://api.the-odds-api.com/v4/sports",
    "https://api.oddsjam.com/v4/sports",            // fallback 1
    "https://sports-api.io/v4/sports"               // fallback 2
  ],
  roster: [
    "https://api.sportsdata.io/v4",
    "https://backup.sportsdata.io/v4"
  ]
};

const DEFAULTS = {
  region: "us",
  markets: "h2h,spreads,totals,player_props",
  bookmakers: "draftkings,fanduel",
  oddsFormat: "american",
  dateFormat: "iso"
};

// helper — try multiple sources until one succeeds
async function tryFetch(urls, opts = {}) {
  for (const url of urls) {
    try {
      const res = await fetch(url, opts);
      if (res.ok) return await res.json();
    } catch (err) {
      console.warn(`❌ ${url} failed:`, err.message);
    }
  }
  throw new Error("All endpoints failed.");
}

export default async (req, res) => {
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

    let payload = {};

    switch (operation) {
      // ------------------------------------------------------------------
      case "getRosterStatus": {
        const urls = ENDPOINTS.roster.map(
          base => `${base}/${sport}/scores/json/Players?key=${ROSTER_API_KEY}`
        );
        const data = await tryFetch(urls);
        payload = { message: "Roster status fetched", sport, count: data?.length || 0, data };
        break;
      }

      case "syncRoster": {
        const urls = ENDPOINTS.roster.map(
          base => `${base}/${sport}/scores/json/Players?key=${ROSTER_API_KEY}`
        );
        const data = await tryFetch(urls, { cache: "no-store" });
        payload = { message: "Roster synced", sport, count: data?.length || 0, data };
        break;
      }

      case "getOdds": {
        const urls = ENDPOINTS.odds.map(
          base =>
            `${base}/${sport}/odds?regions=${regions}&markets=${markets}&bookmakers=${bookmakers}` +
            `&oddsFormat=${oddsFormat}&dateFormat=${dateFormat}&apiKey=${ODDS_API_KEY}`
        );
        const data = await tryFetch(urls);
        payload = {
          message: "Odds data retrieved",
          sport,
          region: regions,
          marketCount: data?.length || 0,
          data
        };
        break;
      }

      default:
        return res.status(400).json({ message: `Unknown operation: ${operation}` });
    }

    return res.status(200).json(payload);
  } catch (err) {
    console.error("Router error:", err);
    return res.status(500).json({
      message: "Router function failed",
      error: err.message
    });
  }
};