import fs from "fs";
import path from "path";

const CACHE_DIR = "/tmp";
const CACHE_FILE = (sport) => path.join(CACHE_DIR, `${sport}_roster_cache.json`);
const MAX_CACHE_AGE_HOURS = 12;

export const handler = async (event) => {
  const query = event.queryStringParameters || {};
  const force = query.force === "true";
  const sports = ["nfl", "nba", "nhl", "ncaab", "pga", "ufc", "soccer"];
  const base = process.env.SITE_BASE_URL || "https://jazzy-mandazi-d04d35.netlify.app";

  const results = [];

  for (const sport of sports) {
    const file = CACHE_FILE(sport);
    let lastUpdated = null;
    let needsRefresh = force;

    if (fs.existsSync(file)) {
      const cached = JSON.parse(fs.readFileSync(file, "utf-8"));
      lastUpdated = cached.timestamp;
      const ageHours = (Date.now() - cached.timestamp) / 36e5;
      if (ageHours > MAX_CACHE_AGE_HOURS) needsRefresh = true;
    } else {
      needsRefresh = true;
    }

    // Perform refresh if needed
    if (needsRefresh) {
      try {
        const res = await fetch(`${base}/.netlify/functions/roster-sync?sport=${sport}`);
        const data = await res.json();
        results.push({
          sport,
          status: "🔄 Refreshed",
          message: data.message,
          active_count: data.active_count,
          refreshed: true,
          last_updated: new Date().toISOString(),
        });
      } catch (err) {
        results.push({
          sport,
          status: "❌ Refresh failed",
          error: err.message,
          refreshed: false,
          last_updated: lastUpdated ? new Date(lastUpdated).toISOString() : null,
        });
      }
    } else {
      results.push({
        sport,
        status: "✅ Cache fresh",
        refreshed: false,
        last_updated: new Date(lastUpdated).toISOString(),
      });
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: "Roster status check complete",
      results,
      forced: force,
      timestamp: new Date().toISOString(),
    }),
  };
};