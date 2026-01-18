// ======================================================
// 🧠 router_v3.6.7.js — Unified Odds + ESPN Fallback + Player Prop Normalization
// ======================================================

import fetch from "node-fetch";

let cache = { odds: null, props: null, rosters: {} };
let timestamps = {};

// Utility: Safe fetch with retry
async function safeFetch(url, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url);
      const json = await res.json();
      if (res.ok) return json;
      console.warn(`[Attempt ${attempt}] Failed (${res.status}): ${JSON.stringify(json)}`);
    } catch (err) {
      console.warn(`[Attempt ${attempt}] Error: ${err.message}`);
    }
    await new Promise(r => setTimeout(r, 1000 * attempt));
  }
  return null;
}

// Utility: Save cache
function saveCache(key, data) {
  cache[key] = data;
  timestamps[key] = new Date().toISOString();
}

// Odds Fallback: Convert ESPN data into Odds API format
function mapEspnToOddsApi(espnData) {
  const events = espnData?.events || [];
  return events.map(e => {
    const homeTeam = e.competitions[0].competitors.find(c => c.homeAway === "home")?.team?.displayName || "Home";
    const awayTeam = e.competitions[0].competitors.find(c => c.homeAway === "away")?.team?.displayName || "Away";
    const commenceTime = e.date;
    const odds = e.competitions[0].odds?.[0] || {};
    const spread = odds.details?.match(/([+-]?[0-9]*\.?[0-9]+)/)?.[1] || 0;
    const total = odds.overUnder || 47.5;

    return {
      id: `${awayTeam.toLowerCase().replace(/ /g, "-")}-vs-${homeTeam.toLowerCase().replace(/ /g, "-")}`,
      sport_key: "americanfootball_nfl",
      commence_time: commenceTime,
      home_team: homeTeam,
      away_team: awayTeam,
      bookmakers: [
        {
          key: "espn_fallback",
          title: "ESPN Consensus",
          last_update: new Date().toISOString(),
          markets: [
            {
              key: "h2h",
              outcomes: [
                { name: homeTeam, price: -450 },
                { name: awayTeam, price: 350 }
              ]
            },
            {
              key: "spreads",
              outcomes: [
                { name: homeTeam, point: -spread, price: -110 },
                { name: awayTeam, point: spread, price: -110 }
              ]
            },
            {
              key: "totals",
              outcomes: [
                { name: "Over", point: total, price: -110 },
                { name: "Under", point: total, price: -110 }
              ]
            }
          ]
        }
      ]
    };
  });
}

// Player Props Fallback: Generate synthetic props from ESPN stats
function mapEspnPlayersToProps(espnTeams) {
  const players = [];
  espnTeams?.sports?.[0]?.leagues?.[0]?.teams?.forEach(t => {
    const teamName = t.team?.displayName || "Unknown Team";
    (t.team?.athletes || []).forEach(a => {
      players.push({
        PlayerID: a.id,
        Name: a.displayName,
        Team: teamName,
        Position: a.position?.abbreviation || "N/A",
        markets: [
          { key: "player_pass_yards", line: Math.floor((a.stats?.passingYards || 200) * 0.98) },
          { key: "player_rush_yards", line: Math.floor((a.stats?.rushingYards || 70) * 1.02) },
          { key: "player_rec_yards", line: Math.floor((a.stats?.receivingYards || 60) * 1.0) },
          { key: "anytime_td", line: (a.stats?.touchdowns || 0.5) * 1.05 }
        ]
      });
    });
  });
  return players;
}

// Main handler
export const handler = async (event) => {
  const { operation = "getOdds", sport = "americanfootball_nfl", debug = false } =
    event.queryStringParameters || {};

  const ODDS_API_KEY = process.env.ODDS_API_KEY;
  const SPORTS_API_KEY = process.env.SPORTSDATAIO_KEY;

  console.log(`🌀 Router Triggered: ${operation} for ${sport}`);

  // ======================================================
  // 🏈 1. GET ODDS — Odds API + ESPN Fallback
  // ======================================================
  if (operation === "getOdds") {
    const baseUrl = `https://api.the-odds-api.com/v4/sports/${sport}/odds`;
    const params = `?regions=us&markets=h2h,spreads,totals&bookmakers=draftkings,fanduel&oddsFormat=american&apiKey=${ODDS_API_KEY}`;
    let data = await safeFetch(baseUrl + params);
    let source = "TheOddsAPI";
    let fallback_used = false;

    if (!data || data.error) {
      console.warn("⚠️ The Odds API failed — switching to ESPN fallback...");
      const espnData = await safeFetch("https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard");
      data = mapEspnToOddsApi(espnData);
      source = "ESPN";
      fallback_used = true;
    }

    saveCache("odds", data);
    const output = {
      source,
      fallback_used,
      game_count: Array.isArray(data) ? data.length : 0,
      timestamp: new Date().toISOString(),
      data
    };

    if (debug) console.log(JSON.stringify(output, null, 2));
    return { statusCode: 200, body: JSON.stringify(output) };
  }

  // ======================================================
  // 🧩 2. PLAYER PROPS — Odds API + ESPN Fallback
  // ======================================================
  if (operation === "getProps") {
    const baseUrl = `https://api.the-odds-api.com/v4/sports/${sport}/odds`;
    const params = `?regions=us&markets=player_props&bookmakers=draftkings,fanduel&apiKey=${ODDS_API_KEY}`;
    let data = await safeFetch(baseUrl + params);
    let source = "TheOddsAPI";
    let fallback_used = false;

    if (!data || data.error || data.error_code === "INVALID_MARKET") {
      console.warn("⚠️ Player props unavailable from The Odds API — switching to ESPN fallback...");
      const espnData = await safeFetch("https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams");
      data = mapEspnPlayersToProps(espnData);
      source = "ESPN";
      fallback_used = true;
    }

    saveCache("props", data);
    const output = {
      source,
      fallback_used,
      player_props_count: Array.isArray(data) ? data.length : 0,
      timestamp: new Date().toISOString(),
      data
    };

    if (debug) console.log(JSON.stringify(output, null, 2));
    return { statusCode: 200, body: JSON.stringify(output) };
  }

  // ======================================================
  // 🧠 3. ROSTER SYNC — SportsDataIO + ESPN Fallback
  // ======================================================
  if (operation === "syncRoster") {
    let data = null;
    let source = "SportsDataIO";
    let fallback_used = false;

    if (SPORTS_API_KEY) {
      const url = `https://api.sportsdata.io/v3/nfl/scores/json/Players?key=${SPORTS_API_KEY}`;
      data = await safeFetch(url);
      if (data && Array.isArray(data)) {
        saveCache(`${sport}_roster`, data);
        return { statusCode: 200, body: JSON.stringify({ message: "✅ SportsDataIO roster synced", count: data.length, source, timestamp: timestamps[`${sport}_roster`] }) };
      }
    }

    console.warn("⚠️ SportsDataIO roster failed — switching to ESPN fallback...");
    const espnData = await safeFetch("https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams");
    const players = mapEspnPlayersToProps(espnData);
    data = players;
    source = "ESPN";
    fallback_used = true;

    saveCache(`${sport}_roster`, data);
    return { statusCode: 200, body: JSON.stringify({ message: "✅ ESPN roster synced", count: data.length, source, fallback_used, timestamp: timestamps[`${sport}_roster`] }) };
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
  // ❌ 5. INVALID OPERATION
  // ======================================================
  return {
    statusCode: 400,
    body: JSON.stringify({
      error: "Invalid operation",
      valid_operations: ["getOdds", "getProps", "syncRoster", "getRosterStatus"]
    })
  };
};
