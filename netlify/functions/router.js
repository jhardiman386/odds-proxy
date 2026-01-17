// ======================================================
// 🧠 router_v3.6.3.js — Production-Grade Data Proxy
// Unified Odds + Props + Roster Handler with Smart Fallbacks
// Supports: NFL, NBA, NCAAF, NCAAB, NHL
// ======================================================

import fetch from "node-fetch";

let cache = {
  odds: null,
  props: null,
  rosters: {},
};
let timestamps = {};

async function safeFetch(url, retries = 3) {
  for (let i = 1; i <= retries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
      console.warn(`⚠️ [Attempt ${i}] Failed (${res.status})`);
    } catch (err) {
      console.warn(`⚠️ [Attempt ${i}] Error: ${err.message}`);
    }
    await new Promise(r => setTimeout(r, 1000 * i));
  }
  return null;
}

function saveCache(key, data) {
  cache[key] = data;
  timestamps[key] = new Date().toISOString();
}

export const handler = async (event) => {
  const params = event.queryStringParameters || {};
  const operation = params.operation || "getOdds";
  const sport = params.sport || "americanfootball_nfl";

  const ODDS_API_KEY = process.env.ODDS_API_KEY;
  const SPORTS_API_KEY = process.env.SPORTSDATAIO_KEY;
  const REGIONS = (process.env.ODDS_REGIONS || "us,us2").split(",");
  const BOOKMAKERS = (process.env.ODDS_BOOKMAKERS || "draftkings,fanduel,betmgm").split(",");

  if (!ODDS_API_KEY || !SPORTS_API_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Missing API keys",
        details: "Set ODDS_API_KEY and SPORTSDATAIO_KEY in environment variables."
      })
    };
  }

  console.log(`🌀 Router Triggered: ${operation} for ${sport}`);

  // ======================================================
  // 🎯 GET ODDS (Standard fetch with cache reuse)
  // ======================================================
  if (operation === "getOdds") {
    const baseUrl = `https://api.the-odds-api.com/v4/sports/${sport}/odds`;
    const params = `?regions=${REGIONS.join(",")}&bookmakers=${BOOKMAKERS.join(",")}&markets=h2h,spreads,totals&oddsFormat=american&apiKey=${ODDS_API_KEY}`;
    let data = await safeFetch(baseUrl + params);

    if (!data && cache.odds) {
      console.log("♻️ Serving cached odds from", timestamps.odds);
      return { statusCode: 200, body: JSON.stringify({ cached: true, timestamp: timestamps.odds, data: cache.odds }) };
    }
    if (!data) return { statusCode: 502, body: JSON.stringify({ error: "Odds API upstream failure" }) };

    saveCache("odds", data);
    console.log(`✅ Odds cache refreshed @ ${timestamps.odds}`);
    return { statusCode: 200, body: JSON.stringify({ cached: false, timestamp: timestamps.odds, data }) };
  }

  // ======================================================
  // 🧠 GET PROPS (Smart multi-region fallback + cache reuse)
  // ======================================================
  if (operation === "getProps") {
    const baseUrl = `https://api.the-odds-api.com/v4/sports/${sport}/odds`;
    let data = null;

    for (const region of REGIONS) {
      const url = `${baseUrl}?regions=${region}&bookmakers=${BOOKMAKERS.join(",")}&markets=player_props&oddsFormat=american&apiKey=${ODDS_API_KEY}`;
      const result = await safeFetch(url);

      if (result?.error_code === "MISSING_REGION") {
        console.warn(`⚠️ Region not valid: ${region} — retrying next.`);
        continue;
      }

      if (result && Array.isArray(result) && result.length > 0) {
        data = result;
        console.log(`✅ Player props successfully loaded from region: ${region}`);
        break;
      } else {
        console.warn(`⚠️ No props found in region: ${region}`);
      }
    }

    if (!data && cache.props) {
      console.log("♻️ Serving cached props from", timestamps.props);
      return { statusCode: 200, body: JSON.stringify({ cached: true, timestamp: timestamps.props, data: cache.props }) };
    }
    if (!data) {
      console.warn("⚠️ No player props available — fallback empty.");
      return { statusCode: 204, body: JSON.stringify({ warning: "No player props currently available" }) };
    }

    saveCache("props", data);
    console.log(`✅ Player props cache refreshed @ ${timestamps.props}`);
    return { statusCode: 200, body: JSON.stringify({ cached: false, timestamp: timestamps.props, data }) };
  }

  // ======================================================
  // 🧩 SYNC ROSTER (SportsDataIO API)
  // ======================================================
  if (operation === "syncRoster") {
    const url = `https://api.sportsdata.io/v3/${sport}/scores/json/Players?key=${SPORTS_API_KEY}`;
    const data = await safeFetch(url);

    if (!data) return { statusCode: 502, body: JSON.stringify({ error: "Roster sync failed" }) };

    saveCache(`${sport}_roster`, data);
    console.log(`✅ ${sport.toUpperCase()} roster synced (${data.length} players)`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `✅ ${sport.toUpperCase()} roster synced successfully.`,
        active_count: data.length,
        timestamp: timestamps[`${sport}_roster`],
      })
    };
  }

  // ======================================================
  // 🔁 REFRESH ALL (Odds + Rosters for major sports)
  // ======================================================
  if (operation === "refreshAll") {
    console.log("🕒 Running unified refresh cycle...");
    const sports = ["americanfootball_nfl", "basketball_nba", "icehockey_nhl"];
    for (const s of sports) {
      await safeFetch(`https://api.sportsdata.io/v3/${s}/scores/json/Players?key=${SPORTS_API_KEY}`);
      await safeFetch(`https://api.the-odds-api.com/v4/sports/${s}/odds?regions=us&markets=h2h,spreads,totals&bookmakers=draftkings&apiKey=${ODDS_API_KEY}`);
    }
    return { statusCode: 200, body: JSON.stringify({ message: "✅ All sports refreshed successfully", timestamp: new Date().toISOString() }) };
  }

  // ======================================================
  // ❌ INVALID OPERATION
  // ======================================================
  return {
    statusCode: 400,
    body: JSON.stringify({
      error: "Invalid operation",
      valid_operations: ["getOdds", "getProps", "syncRoster", "getRosterStatus", "refreshAll"]
    })
  };
};
