import fs from "fs";
import path from "path";

const CACHE_DIR = "/tmp";

export const handler = async () => {
  const sports = ["nfl", "nba", "nhl", "ncaab", "pga", "ufc", "soccer"];
  const results = [];

  for (const sport of sports) {
    const file = path.join(CACHE_DIR, `${sport}_roster_cache.json`);
    if (fs.existsSync(file)) {
      const { timestamp } = JSON.parse(fs.readFileSync(file, "utf-8"));
      results.push({
        sport,
        status: "✅ Cached",
        last_updated: new Date(timestamp).toISOString(),
      });
    } else {
      results.push({
        sport,
        status: "⚠️ No cache found",
        last_updated: null,
      });
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: "Roster cache status report",
      results,
      timestamp: new Date().toISOString(),
    }),
  };
};