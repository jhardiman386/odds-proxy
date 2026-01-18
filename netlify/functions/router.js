// ======================================================
// 🧠 router_v3.6.5.js — Unified Odds + ESPN Roster Fallback
// ======================================================

import fetch from "node-fetch";

let cache = { odds: null, props: null, rosters: {} };
let timestamps = {};

// Utility: Safe fetch with retry
async function safeFetch(url, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
      console.warn(`[Attempt ${attempt}] Failed (${res.status})`);
    } catch (err) {
      console.warn(`[Attempt ${attempt}] Error: ${err.message}`);
    }
    await new Promise(r => setTimeout(r, 1000 * attempt));
  }
  return null;
}

// Utility: Save to cache
function saveCache(key, data) {
  cache[key] = data;
  timestamps[key] = new Date().toISOString();
}

// Main handler
export const handler = async (event) => {
  const { operation = "getOdds", sport = "americanfootball_nfl" } =
    event.queryStringParameters || {};

  const ODDS_API_KEY = process.env.ODDS_API_KEY;
  const SPORTS_API_KEY = process.env.SPORTSDATAIO_KEY;

  console.log(`🌀 Router Triggered: ${operation} for ${sport}`);

  // ======================================================
  // 🏈 1. GET ODDS
  // ======================================================
  if (operation === "getOdds") {
    const baseUrl = `https://api.the-odds-api.com/v4/sports/${sport}/odds`;
    const params = `?regions=us,us2&markets=h2h,spreads,totals,player_props&bookmakers=draftkings,fanduel&oddsFormat=american&dateFormat=iso&apiKey=${ODDS_API_KEY}`;
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
  // 🧩 2. PLAYER PROPS
  // ======================================================
  if (operation === "getProps") {
    const url = `https://api.the-odds-api.com/v4/sports/${sport}/odds?regions=us,us2&markets=player_props&bookmakers=draftkings,fanduel&oddsFormat=american&apiKey=${ODDS_API_KEY}`;
    let data = await safeFetch(url);

    if (!data && cache.props) {
      console.log("♻️ Serving cached props from", timestamps.props);
      return { statusCode: 200, body: JSON.stringify({ cached: true, timestamp: timestamps.props, data: cache.props }) };
    }

    if (!data) return { statusCode: 502, body: JSON.stringify({ error: "Player props API failed" }) };

    saveCache("props", data);
    console.log(`✅ Player prop cache refreshed @ ${timestamps.props}`);
    return { statusCode: 200, body: JSON.stringify({ cached: false, timestamp: timestamps.props, data }) };
  }

  // ======================================================
  // 🧠 3. ROSTER SYNC — ESPN FALLBACK
  // ======================================================
  if (operation === "syncRoster") {
    let data = null;

    // Try SportsDataIO if key present
    if (SPORTS_API_KEY) {
      const url = `https://api.sportsdata.io/v3/nfl/scores/json/Players?key=${SPORTS_API_KEY}`;
      data = await safeFetch(url);
      if (data && !data.statusCode && Array.isArray(data)) {
        saveCache(`${sport}_roster`, data);
        console.log(`✅ SportsDataIO roster synced (${data.length} players)`);
        return { statusCode: 200, body: JSON.stringify({ message: "✅ SportsDataIO roster synced", count: data.length, timestamp: timestamps[`${sport}_roster`] }) };
      }
      console.warn("⚠️ SportsDataIO roster failed or unauthorized, switching to ESPN fallback");
    }

    // ESPN fallback
    const espnUrl = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams";
    const espnData = await safeFetch(espnUrl);

    if (espnData && espnData.sports?.[0]?.leagues?.[0]?.teams) {
      const players = espnData.sports[0].leagues[0].teams.flatMap(team =>
        (team.team?.athletes || []).map(a => ({
          PlayerID: a.id,
          Name: a.displayName,
          Team: team.team.displayName,
          Position: a.position?.abbreviation || "N/A"
        }))
      );
      saveCache(`${sport}_roster`, players);
      console.log(`✅ ESPN roster synced (${players.length} players)`);
      return { statusCode: 200, body: JSON.stringify({ message: "✅ ESPN roster synced", count: players.length, timestamp: timestamps[`${sport}_roster`] }) };
    }

    return { statusCode: 502, body: JSON.stringify({ error: "Roster sync failed from all sources" }) };
  }

  // ======================================================
  // 🔍 4. GET ROSTER STATUS
  // ======================================================
  if (operation === "getRosterStatus") {
    const roster = cache[`${sport}_roster`];
    const count = roster ? roster.length : 0;
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `📊 Roster status for ${sport}`,
        cached: !!roster,
        active_count: count,
        last_sync: timestamps[`${sport}_roster`] || "No sync yet"
      })
    };
  }

  // ======================================================
  // 🔁 5. REFRESH ALL
  // ======================================================
  if (operation === "refreshAll") {
    console.log("🕒 Running unified refresh cycle (odds + ESPN roster)...");
    await safeFetch(`https://api.the-odds-api.com/v4/sports/${sport}/odds?regions=us,us2&markets=h2h,spreads,totals&apiKey=${ODDS_API_KEY}`);
    await safeFetch("https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams");
    return { statusCode: 200, body: JSON.stringify({ message: "✅ Refresh complete", timestamp: new Date().toISOString() }) };
  }

  // ======================================================
  // ❌ 6. INVALID OPERATION
  // ======================================================
  return {
    statusCode: 400,
    body: JSON.stringify({
      error: "Invalid operation",
      valid_operations: ["getOdds", "getProps", "syncRoster", "getRosterStatus", "refreshAll"]
    })
  };
};
