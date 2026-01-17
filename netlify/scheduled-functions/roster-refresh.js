// netlify/scheduled-functions/roster-refresh.js
export const handler = async () => {
  const sports = ["nfl", "nba", "nhl", "ncaab"];
  const base = process.env.SITE_BASE_URL || "https://jazzy-mandazi-d04d35.netlify.app";

  for (const sport of sports) {
    await fetch(`${base}/.netlify/functions/roster-sync?sport=${sport}`);
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Rosters refreshed" }),
  };
};