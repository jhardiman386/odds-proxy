// ✅ router.js — stable version for Netlify Functions
import fetch from "node-fetch";

export default async (request) => {
  try {
    // parse incoming body if POST
    let body = {};
    if (request.method === "POST") {
      try {
        body = await request.json();
      } catch {
        body = {};
      }
    }

    const operation = body.operation || "ping";
    const sport = body.sport || "none";

    switch (operation) {
      case "ping":
        return jsonResponse({ message: "Router function active", timestamp: new Date().toISOString() });

      case "getOdds":
        return await getOdds(sport);

      default:
        return jsonResponse({ error: `Unknown operation: ${operation}` }, 400);
    }

  } catch (err) {
    console.error("Router error:", err.message);
    return jsonResponse({ error: err.message, stack: err.stack }, 500);
  }
};

// Example Odds call (dummy structure)
async function getOdds(sport) {
  const ODDS_API_KEY = process.env.ODDS_API_KEY;
  if (!ODDS_API_KEY) {
    return jsonResponse({ error: "Missing ODDS_API_KEY in environment" }, 500);
  }

  try {
    const res = await fetch(`https://api.the-odds-api.com/v4/sports/${sport}/odds/?apiKey=${ODDS_API_KEY}`);
    const data = await res.json();
    return jsonResponse({ message: "Odds retrieved", sport, count: data.length || 0 });
  } catch (err) {
    return jsonResponse({ error: `Failed to fetch odds: ${err.message}` }, 500);
  }
}

// Helper for clean responses
function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
