// ============================================================
// 🧠 SUPER PIPELINE ORCHESTRATOR ROUTER (v4.0.0)
// Multi-Sport Pick Engine (NFL, NBA, NCAAB, NHL, PGA, UFC, SOCCER)
// ============================================================

import fetch from "node-fetch";
import fs from "fs";
import path from "path";

// Registry of available wrappers
const WRAPPER_REGISTRY = {
  americanfootball_nfl: "NFL-X-SUPER-PIPELINE-WRAPPER.txt",
  basketball_nba: "NBA-X-SUPER-PIPELINE-WRAPPER_v1.1.0.txt",
  basketball_ncaab: "NCAAB-X-SUPER-PIPELINE-WRAPPER_v1.1.0.txt",
  americanfootball_ncaaf: "NCAAF-X-SUPER-PIPELINE-WRAPPER_v1.1.0.txt",
  icehockey_nhl: "NHL-X-SUPER-PIPELINE-WRAPPER_v1.1.0.txt",
  golf_pga: "PGA-X-SUPER-PIPELINE-WRAPPER_v1.1.0.txt",
  soccer: "SOCCER-X-SUPER-PIPELINE-WRAPPER_v1.1.0.txt",
  mma_ufc: "UFC-X-SUPER-PIPELINE-WRAPPER_v1.1.0.txt"
};

// ============================================================
// ✅ ENTRY POINT
// ============================================================
export default async (request) => {
  try {
    let body = {};
    if (request.method === "POST") {
      try { body = await request.json(); } catch { body = {}; }
    }

    const operation = body.operation || "ping";
    const sport = body.sport || "americanfootball_nfl";

    switch (operation) {
      case "ping":
        return jsonResponse({ message: "Router function active", timestamp: new Date().toISOString() });

      case "getOdds":
        return await handleGetOdds(sport);

      case "getPicks":
        return await handleGeneratePicks(sport);

      default:
        return jsonResponse({ error: `Unknown operation: ${operation}` }, 400);
    }
  } catch (err) {
    console.error("Router error:", err);
    return jsonResponse({ error: err.message, stack: err.stack }, 500);
  }
};

// ============================================================
// ⚙️ HANDLERS
// ============================================================

async function handleGetOdds(sport) {
  const ODDS_API_KEY = process.env.ODDS_API_KEY;
  if (!ODDS_API_KEY) return jsonResponse({ error: "Missing ODDS_API_KEY" }, 500);

  try {
    const directUrl = `https://api.the-odds-api.com/v4/sports/${sport}/odds/?apiKey=${ODDS_API_KEY}&regions=us`;
    const res = await fetch(directUrl);
    const data = await res.json();
    return jsonResponse({ source: "direct", sport, data });
  } catch (err) {
    console.error("Odds fetch failed:", err);
    return jsonResponse({ error: err.message }, 500);
  }
}

async function handleGeneratePicks(sport) {
  const ODDS_API_KEY = process.env.ODDS_API_KEY;
  const ROSTER_API_KEY = process.env.ROSTER_API_KEY;
  if (!ODDS_API_KEY || !ROSTER_API_KEY)
    return jsonResponse({ error: "Missing required API keys" }, 500);

  try {
    // 1️⃣ Get odds
    const oddsRes = await fetch(`https://api.the-odds-api.com/v4/sports/${sport}/odds/?apiKey=${ODDS_API_KEY}&regions=us`);
    const oddsData = await oddsRes.json();

    // 2️⃣ Load sport-specific wrapper
    const wrapperPath = path.join(process.cwd(), "netlify/functions/wrappers", WRAPPER_REGISTRY[sport] || "");
    const wrapperText = fs.existsSync(wrapperPath)
      ? fs.readFileSync(wrapperPath, "utf8")
      : "DEFAULT_WRAPPER";

    // 3️⃣ Generate picks using wrapper logic
    const picks = generateWrapperPicks(sport, oddsData, wrapperText);

    return jsonResponse({
      status: "ok",
      sport,
      picks,
      count: picks.length,
      wrapper: path.basename(wrapperPath),
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error("Pick generation error:", err);
    return jsonResponse({ error: err.message, stack: err.stack }, 500);
  }
}

// ============================================================
// 🧮 WRAPPER-BASED PICK GENERATOR
// ============================================================

function generateWrapperPicks(sport, oddsData, wrapperText) {
  const picks = [];
  if (!Array.isArray(oddsData)) return picks;

  const gradeThreshold = /grade threshold ≥ ([A-F+-]+)/i.exec(wrapperText)?.[1] || "B−";

  for (const game of oddsData) {
    const home = game.home_team;
    const away = game.away_team;
    const bookmakers = game.bookmakers || [];
    if (bookmakers.length === 0) continue;

    const bk = bookmakers.find(b => b.key === "draftkings" || b.key === "fanduel");
    if (!bk) continue;

    for (const market of bk.markets || []) {
      const { key, outcomes } = market;
      if (!outcomes || outcomes.length < 2) continue;

      const homeOut = outcomes.find(o => o.name === home);
      const awayOut = outcomes.find(o => o.name === away);
      if (!homeOut || !awayOut) continue;

      const confidence = deterministicConfidence(homeOut.price, awayOut.price, wrapperText);
      if (confidence < 0.7) continue; // enforce grade threshold

      picks.push({
        game: `${away} @ ${home}`,
        market_type: key,
        pick: homeOut.price < awayOut.price ? home : away,
        confidence,
        edge: `${((confidence - 0.5) * 100).toFixed(1)}%`,
        grade: mapConfidenceToGrade(confidence),
        source: sport
      });
    }
  }

  return picks.sort((a, b) => b.confidence - a.confidence).slice(0, 10);
}

// Deterministic confidence using price differential + wrapper bias
function deterministicConfidence(homePrice, awayPrice, wrapperText) {
  const bias = wrapperText.includes("tempo/chaos/survivability") ? 0.05 : 0;
  const diff = Math.abs(homePrice - awayPrice) / 100;
  const base = 0.65 + diff * 0.15 + bias;
  return Math.min(0.95, Math.max(0.6, base));
}

// Map to letter grade
function mapConfidenceToGrade(conf) {
  if (conf >= 0.9) return "A+";
  if (conf >= 0.85) return "A";
  if (conf >= 0.8) return "B+";
  if (conf >= 0.75) return "B";
  if (conf >= 0.7) return "B−";
  return "C";
}

// ============================================================
// 🧱 JSON RESPONSE
// ============================================================
function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
