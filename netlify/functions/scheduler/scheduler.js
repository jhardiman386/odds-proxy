import fetch from "node-fetch";

const BASE_URL = "https://jazzy-mandazi-d04d35.netlify.app/.netlify/functions";
const SPORTS = [
  "americanfootball_nfl",
  "americanfootball_ncaaf",
  "basketball_nba",
  "basketball_ncaab",
  "icehockey_nhl",
  "baseball_mlb",
  "mma_mixed_martial_arts",
  "golf_pga",
  "soccer"
];

export const handler = async () => {
  const now = new Date().toISOString();
  console.log(`🕒 Scheduler maintenance started at ${now}`);

  const results = [];

  try {
    for (const sport of SPORTS) {
      console.log(`🔁 Syncing roster for ${sport}...`);
      const rosterUrl = `${BASE_URL}/router?operation=syncRoster&sport=${sport}`;
      const rosterRes = await fetch(rosterUrl);
      const rosterText = await rosterRes.text();
      results.push({
        type: "roster",
        sport,
        status: rosterRes.ok ? "success" : "error",
        details: rosterText.slice(0, 100),
      });

      console.log(`📊 Pre-caching odds for ${sport}...`);
      const oddsUrl = `${BASE_URL}/router?operation=getOdds&sport=${sport}&regions=us,us2&bookmakers=draftkings,fanduel&markets=all&oddsFormat=american`;
      const oddsRes = await fetch(oddsUrl);
      const oddsText = await oddsRes.text();
      results.push({
        type: "odds",
        sport,
        status: oddsRes.ok ? "success" : "error",
        details: oddsText.slice(0, 100),
      });
    }

    // Trigger router purge (runs auto-purge internally)
    console.log("🧹 Triggering cache purge...");
    const purgeUrl = `${BASE_URL}/router?operation=getRosterStatus`;
    await fetch(purgeUrl);

    console.log("✅ Full maintenance cycle completed successfully.");
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "✅ All rosters and odds synced + cache refreshed.",
        timestamp: now,
        results,
      }),
    };
  } catch (err) {
    console.error("❌ Scheduler failure:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Scheduler run failed.",
        details: err.message,
        timestamp: now,
        results,
      }),
    };
  }
};
