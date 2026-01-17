import fetch from "node-fetch";

const BASE_URL = "https://jazzy-mandazi-d04d35.netlify.app/.netlify/functions";

export const handler = async () => {
  const now = new Date().toISOString();
  console.log(`🕒 Scheduled maintenance started at ${now}`);

  try {
    // Sync rosters for all sports
    const sports = ["nfl", "nba", "nhl", "ncaab", "pga", "ufc", "soccer"];

    for (const sport of sports) {
      const syncUrl = `${BASE_URL}/router?operation=syncRoster&sport=${sport}`;
      console.log(`🔁 Syncing roster for ${sport}...`);
      const res = await fetch(syncUrl);
      const text = await res.text();
      console.log(`✅ ${sport} roster result:`, text.slice(0, 150)); // Limit log output
    }

    // Purge old caches (this triggers via router’s internal purge)
    const purgeUrl = `${BASE_URL}/router?operation=getRosterStatus`;
    console.log("🧹 Triggering cache purge...");
    const purgeRes = await fetch(purgeUrl);
    const purgeText = await purgeRes.text();
    console.log("✅ Purge check complete:", purgeText.slice(0, 150));

    console.log("🎯 Scheduled maintenance completed successfully.");
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "✅ Scheduled roster sync + cache purge complete",
        timestamp: now,
      }),
    };
  } catch (err) {
    console.error("❌ Scheduled job failed:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Scheduled job failed",
        details: err.message,
        timestamp: now,
      }),
    };
  }
};