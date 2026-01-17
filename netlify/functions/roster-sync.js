import fetch from "node-fetch";
import fs from "fs";

export async function handler(event, context) {
  try {
    const sport = event.queryStringParameters.sport || "nfl";
    const apiKey = process.env.SPORTSDATAIO_KEY;

    if (!apiKey) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing SportsDataIO API key" })
      };
    }

    const url = `https://api.sportsdata.io/v3/${sport}/scores/json/Players?key=${apiKey}`;
    const response = await fetch(url);
    const players = await response.json();
    const actives = players.filter(p => p.Status === "Active");

    // Optional: Save to a JSON file for persistence
    const cacheFile = "/tmp/${sport}_roster_cache.json";
    fs.writeFileSync(cacheFile, JSON.stringify(actives, null, 2));

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `✅ ${sport.toUpperCase()} roster synced successfully.`,
        active_count: actives.length,
        cache_file: cacheFile,
        timestamp: new Date().toISOString()
      })
    };
  } catch (err) {
    console.error("Roster sync failed:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Roster sync failed" })
    };
  }
}