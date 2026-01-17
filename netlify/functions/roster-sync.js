// netlify/functions/roster-sync.js

import fs from "fs";
import path from "path";

const CACHE_DIR = "/tmp"; // writable in Netlify
const CACHE_FILE = (sport) => path.join(CACHE_DIR, `${sport}_roster_cache.json`);

export const handler = async (event) => {
  const { sport = "nfl" } = event.queryStringParameters;
  const API_KEY = process.env.SPORTSDATAIO_KEY;

  const sportEndpoints = {
    nfl: "nfl/scores/json/Players",
    nba: "nba/scores/json/Players",
    nhl: "nhl/scores/json/Players",
    ncaab: "cbb/scores/json/Players",
    pga: "golf/scores/json/Players",
    ufc: "mma/scores/json/Fighters",
    soccer: "soccer/scores/json/Players",
  };

  if (!API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: "Missing SPORTSDATAIO_KEY env var" }) };
  }

  const endpoint = sportEndpoints[sport];
  if (!endpoint) {
    return { statusCode: 400, body: JSON.stringify({ error: `Invalid sport: ${sport}` }) };
  }

  const url = `https://api.sportsdata.io/v3/${endpoint}`;
  const cachePath = CACHE_FILE(sport);

  try {
    // 🔹 1. Attempt live fetch
    const res = await fetch(url, {
      headers: { "Ocp-Apim-Subscription-Key": API_KEY },
    });

    if (!res.ok) throw new Error(`Upstream ${res.status}`);
    const data = await res.json();

    // 🔹 2. Save cache snapshot
    try {
      fs.writeFileSync(cachePath, JSON.stringify({ data, timestamp: Date.now() }));
    } catch (err) {
      console.warn("Cache write failed:", err);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `✅ ${sport.toUpperCase()} roster synced successfully (LIVE).`,
        active_count: Array.isArray(data) ? data.length : 0,
        cached: false,
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (err) {
    // 🔹 3. Fallback to cached version
    console.error("Roster Sync Error:", err.message);

    try {
      if (fs.existsSync(cachePath)) {
        const cached = JSON.parse(fs.readFileSync(cachePath, "utf-8"));
        return {
          statusCode: 200,
          body: JSON.stringify({
            message: `⚠️ ${sport.toUpperCase()} roster served from cache.`,
            active_count: Array.isArray(cached.data) ? cached.data.length : 0,
            cached: true,
            timestamp: new Date(cached.timestamp).toISOString(),
          }),
        };
      }
    } catch (cacheErr) {
      console.error("Cache read failed:", cacheErr);
    }

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Roster sync failed and no cache available.",
        details: err.message,
      }),
    };
  }
};