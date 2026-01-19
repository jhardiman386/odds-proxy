export const handler = async (event) => {
  const sports = ["nfl", "nba", "nhl", "ncaab"];
  const base = process.env.SITE_BASE_URL || "https://jazzy-mandazi-d04d35.netlify.app";

  const results = [];

  for (const sport of sports) {
    try {
      const res = await fetch(`${base}/.netlify/functions/roster-sync?sport=${sport}`);
      const data = await res.json();
      results.push({
        sport,
        success: true,
        message: data.message || "Synced",
        active_count: data.active_count || null,
        cached: data.cached || false,
      });
    } catch (err) {
      results.push({
        sport,
        success: false,
        error: err.message,
      });
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: "Roster refresh complete",
      results,
      timestamp: new Date().toISOString(),
      auto: !!event.headers["x-nf-schedule-id"], // true if triggered by Netlify Scheduler
    }),
  };
};
