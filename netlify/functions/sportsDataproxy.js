// ======================================================
// 🧠 sportsDataproxy.js
// Unified Data Proxy Handler – orchestrates calls to router
// Includes roster freshness handshake (Jan 2026)
// ======================================================

import fetch from "node-fetch";

// --------------------------------------------
// 🧩 ROSTER HANDSHAKE
// --------------------------------------------
async function getRosterStatus(sport = "americanfootball_nfl") {
  const url = `https://jazzy-mandazi-d04d35.netlify.app/.netlify/functions/router?operation=getRosterStatus&sport=${sport}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Roster status check failed (${res.status})`);
  return await res.json();
}

async function syncRosterIfStale(sport = "americanfootball_nfl") {
  const status = await getRosterStatus(sport);
  console.log(`📊 Roster Check → ${status.active_count} players | Last Sync ${status.last_sync}`);

  let needsSync = false;
  if (!status.cached || !status.last_sync) needsSync = true;
  else {
    const ageHours =
      (Date.now() - new Date(status.last_sync).getTime()) / (1000 * 60 * 60);
    if (ageHours > 12) needsSync = true;
  }

  if (!needsSync) {
    console.log(`✅ ${sport.toUpperCase()} roster fresh (<12h). Using cached data.`);
    return status;
  }

  console.log(`⚙️ Roster stale → running live sync for ${sport} ...`);
  const syncUrl = `https://jazzy-mandazi-d04d35.netlify.app/.netlify/functions/router?operation=syncRoster&sport=${sport}`;
  const res = await fetch(syncUrl);
  if (!res.ok) throw new Error(`Roster sync failed (${res.status})`);
  const syncResult = await res.json();
  console.log(`✅ Roster refreshed @ ${syncResult.timestamp} (${syncResult.active_count} active)`);
  return syncResult;
}

// --------------------------------------------
// 🏈 SPORTS DATA PROXY WRAPPER
// --------------------------------------------
export async function sportsDataProxy({
  operation = "getOdds",
  sport = "americanfootball_nfl",
  force = false,
  regions = "us,us2",
  markets = "h2h,spreads,totals,player_props",
  bookmakers = "draftkings,fanduel",
  oddsFormat = "american",
  dateFormat = "iso"
} = {}) {

  if (operation === "getRosterStatus" || operation === "syncRoster") {
    return await syncRosterIfStale(sport);
  }

  const url = `https://jazzy-mandazi-d04d35.netlify.app/.netlify/functions/router?operation=${operation}&sport=${sport}&regions=${regions}&markets=${markets}&bookmakers=${bookmakers}&oddsFormat=${oddsFormat}&dateFormat=${dateFormat}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`sportsDataProxy failed (${res.status})`);
  const data = await res.json();

  console.log(`✅ ${operation} pulled successfully for ${sport}`);
  return data;
}
