import fetch from "node-fetch";
import fs from "fs";
import path from "path";

const CACHE_DIR = "/tmp/router-cache"; // Netlify's temporary writeable cache directory
const BASE_URL = "https://jazzy-mandazi-d04d35.netlify.app/.netlify/functions";
const MAX_CACHE_AGE_HOURS = 12; // How long cached data remains valid

if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

const getCacheFile = (operation, sport) =>
  path.join(CACHE_DIR, `${operation}_${sport || "global"}.json`);

// 🧹 Clean old cache entries automatically
const purgeOldCache = () => {
  try {
    const files = fs.readdirSync(CACHE_DIR);
    const now = Date.now();
    let purged = 0;

    for (const file of files) {
      const filePath = path.join(CACHE_DIR, file);
      const stats = fs.statSync(filePath);
      const ageHours = (now - stats.mtimeMs) / (1000 * 60 * 60);

      if (ageHours > MAX_CACHE_AGE_HOURS) {
        fs.unlinkSync(filePath);
        purged++;
      }
    }

    if (purged > 0) {
      console.log(`🧹 Purged ${purged} expired cache files (> ${MAX_CACHE_AGE_HOURS}h old)`);
    }
  } catch (err) {
    console.warn("⚠️ Cache purge error:", err.message);
  }
};

// Run purge on each execution
purgeOldCache();

export const handler = async (event) => {
  const params = event.queryStringParameters || {};
  const { operation, sport, ...rest } = params;

  if (!operation) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing 'operation' query parameter" }),
    };
  }

  let endpoint;
  switch (operation) {
    case "getRosterStatus":
      endpoint = "roster-status";
      break;
    case "syncRoster":
      endpoint = "roster-sync";
      break;
    case "getOdds":
      endpoint = "odds";
      break;
    default:
      return {
        statusCode: 400,
        body: JSON.stringify({ error: `Invalid operation: ${operation}` }),
      };
  }

  const url = `${BASE_URL}/${endpoint}?${new URLSearchParams(rest)}`;
  const cacheFile = getCacheFile(operation, sport);
  const headers = { "Content-Type": "application/json" };

  // --- Helper: Save cache with timestamp
  const saveCache = (data) => {
    try {
      const timestamp = new Date().toISOString();
      const wrapped = { ts: timestamp, data };
      fs.writeFileSync(cacheFile, JSON.stringify(wrapped, null, 2));
      console.log(`✅ Cached response for ${operation} (${sport || "global"}) at ${timestamp}`);
    } catch (err) {
      console.warn("⚠️ Cache write failed:", err.message);
    }
  };

  // --- Helper: Read cache
  const readCache = () => {
    try {
      if (fs.existsSync(cacheFile)) {
        const cached = JSON.parse(fs.readFileSync(cacheFile));
        console.log(`⚙️ Using cached data for ${operation} (${sport || "global"})`);
        return cached;
      }
    } catch (err) {
      console.warn("⚠️ Cache read failed:", err.message);
    }
    return null;
  };

  // --- Attempt live fetch (retry up to 2x)
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      console.log(`🔄 Fetching ${url} (Attempt ${attempt})`);
      const res = await fetch(url);
      const text = await res.text();

      if (!res.ok) throw new Error(`Upstream ${res.status}: ${text}`);

      const data = JSON.parse(text);
      saveCache(data);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          message: `✅ Live data retrieved successfully (${operation})`,
          source: "live",
          last_synced_at: new Date().toISOString(),
          data,
        }),
      };
    } catch (err) {
      console.error(`❌ Attempt ${attempt} failed: ${err.message}`);

      if (attempt === 2) {
        const cached = readCache();
        if (cached) {
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              message: `⚠️ Using cached data for ${operation} (live source failed)`,
              source: "cache",
              last_synced_at: cached.ts,
              data: cached.data,
            }),
          };
        }
        return {
          statusCode: 502,
          headers,
          body: JSON.stringify({
            error: `All attempts failed for ${operation}`,
            details: err.message,
            last_synced_at: null
          }),
        };
      }
    }
  }
};