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
  console.log(`🕒 Scheduler started at ${now}`);

  const results = [];

  try {
    for (const sport of SPORTS) {
      const syncUrl = `${BASE_URL}/router?operation=syncRoster&sport=${sport}`;
      console.log(`🔁 Syncing roster for ${sport}...`);

      try {
        const res = await fetch(syncUrl);
        const data = await res.text();
        results.push({ sport, result: "success", details: data.slice(0, 100) });
      } catch (err) {
        results.push({ sport, result: "error", details: err.message });
      }
    }

    // Trigger router purge (runs auto-purge logic)
    console.log("🧹 Triggering cache purge...");
    const purgeUrl = `${BASE_URL}/router?operation=getRosterStatus`;
    await fetch(purgeUrl);

    console.log("✅ Scheduler maintenance completed successfully.");

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "✅ All rosters synced + cache refreshed.",
        timestamp: now,
        results
      }),
    };
  } catch (err) {
    console.error("❌ Scheduler failed:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Scheduler run failed.",
        details: err.message,
        timestamp: now,
        results
      }),
    };
  }
};