/**
 * ============================================================
 * sportsCache.js — In-Memory & File Cache Layer v3.2.0
 * ============================================================
 * Provides reusable caching for odds, props, and rosters across
 * all sports. Speeds up API calls and adds resilience to outages.
 * ============================================================
 */

import fs from "fs";
import path from "path";

const CACHE_DIR = path.resolve("./.cache");
const CACHE_TTL_MINUTES = 180; // 3 hours

if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

/**
 * 🕒 Get current timestamp in ISO format
 */
const now = () => new Date().toISOString();

/**
 * 🧮 Check if cache entry is expired
 */
function isExpired(entry) {
  if (!entry || !entry.timestamp) return true;
  const ageMinutes =
    (Date.now() - new Date(entry.timestamp).getTime()) / 1000 / 60;
  return ageMinutes > CACHE_TTL_MINUTES;
}

/**
 * 💾 Save cache entry (in-memory + file)
 */
export function setCache(key, data) {
  const cacheFile = path.join(CACHE_DIR, `${key}.json`);
  const entry = {
    timestamp: now(),
    data
  };
  fs.writeFileSync(cacheFile, JSON.stringify(entry, null, 2));
  inMemoryCache[key] = entry;
  console.log(`💾 Cache saved: ${key} (${CACHE_TTL_MINUTES} min TTL)`);
}

/**
 * 🔎 Load cache entry (checks memory first, then file)
 */
export function getCache(key) {
  if (inMemoryCache[key] && !isExpired(inMemoryCache[key])) {
    console.log(`⚡ Cache hit (memory): ${key}`);
    return inMemoryCache[key].data;
  }

  const cacheFile = path.join(CACHE_DIR, `${key}.json`);
  if (fs.existsSync(cacheFile)) {
    const entry = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
    if (!isExpired(entry)) {
      console.log(`⚡ Cache hit (disk): ${key}`);
      inMemoryCache[key] = entry;
      return entry.data;
    } else {
      console.warn(`⌛ Cache expired: ${key}`);
      fs.unlinkSync(cacheFile);
    }
  }

  console.log(`🚫 Cache miss: ${key}`);
  return null;
}

/**
 * 🧹 Clean expired cache files
 */
export function cleanCache() {
  const files = fs.readdirSync(CACHE_DIR);
  let removed = 0;
  for (const f of files) {
    const file = path.join(CACHE_DIR, f);
    const entry = JSON.parse(fs.readFileSync(file, "utf8"));
    if (isExpired(entry)) {
      fs.unlinkSync(file);
      removed++;
    }
  }
  if (removed > 0)
    console.log(`🧹 Cleaned ${removed} expired cache entries.`);
}

const inMemoryCache = {};

/**
 * 🧩 Cached Fetch Helper
 * Attempts cache before making API call.
 * @param {string} key unique cache identifier
 * @param {Function} fetchFn async function to fetch fresh data
 * @param {boolean} forceRefresh whether to skip cache
 */
export async function cachedFetch(key, fetchFn, forceRefresh = false) {
  if (!forceRefresh) {
    const cached = getCache(key);
    if (cached) return cached;
  }

  console.log(`🌐 Fetching fresh data for: ${key}`);
  const data = await fetchFn();
  if (data) setCache(key, data);
  return data;
}
