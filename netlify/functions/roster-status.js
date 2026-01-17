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
    let ageHours = null;
    let needsRefresh = force;

    if (fs.existsSync(file)) {
      const cached = JSON.parse(fs.readFileSync(file, "utf-8"));
      lastUpdated = cached.timestamp;
      ageHours = (Date.now() - cached.timestamp) / 36e5;
      if (ageHours > MAX_CACHE_AGE_HOURS) needsRefresh = true;
    } else {
      needsRefresh = true;
    }

    let statusIcon = "✅";
    let statusText = "Cache fresh";
    let refreshed = false;

    // Refresh logic
    if (needsRefresh) {
      try {
        const res = await fetch(`${base}/.netlify/functions/roster-sync?sport=${sport}`);
        const data = await res.json();
        refreshed = true;
        statusIcon = "🔁";
        statusText = "Refreshed";
        lastUpdated = Date.now();
        ageHours = 0;
      } catch (err) {
        statusIcon = "❌";
        statusText = `Refresh failed: ${err.message}`;
      }
    }

    // Age coloring for dashboard (mobile-friendly)
    let freshnessGrade = "A";
    if (ageHours > 6) freshnessGrade = "B";
    if (ageHours > 12) freshnessGrade = "C";
    if (ageHours > 24) freshnessGrade = "D";
    if (!lastUpdated) freshnessGrade = "F";

    results.push({
      sport,
      status_icon: statusIcon,
      status_text: statusText,
      freshness_grade: freshnessGrade,
      refreshed,
      hours_since_update: ageHours ? Number(ageHours.toFixed(2)) : null,
      last_updated: lastUpdated ? new Date(lastUpdated).toISOString() : null
    });
  }

  // Sort by freshness (oldest first)
  results.sort((a, b) => (b.hours_since_update || 0) - (a.hours_since_update || 0));

  const dashboard = {
    message: "🏈📊 Roster Health Dashboard",
    forced_refresh: force,
    timestamp: new Date().toISOString(),
    summary: {
      total_sports: results.length,
      refreshed_today: results.filter((r) => r.refreshed).length,
      healthy: results.filter((r) => r.freshness_grade === "A").length,
      warning: results.filter((r) => ["B", "C"].includes(r.freshness_grade)).length,
      failed: results.filter((r) => r.freshness_grade === "F").length,
    },
    sports: results
  };

  return {
    statusCode: 200,
    body: JSON.stringify(dashboard, null, 2),
  };
};