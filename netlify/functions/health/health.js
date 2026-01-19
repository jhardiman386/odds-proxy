/**
 * ============================================================
 * 🩺 SUPER-PIPELINE ORCHESTRATOR HEALTH MONITOR v3.2.4
 * Aggregates live system health from primary & backup routers,
 * API keys, and external data providers.
 * ============================================================
 */

const PRIMARY = "https://super-pipeline-orchestrator.netlify.app/.netlify/functions";
const BACKUP = "https://super-pipeline-orchestrator-backup.netlify.app/.netlify/functions";

exports.handler = async () => {
  const start = Date.now();

  const result = {
    status: "degraded",
    timestamp: new Date().toISOString(),
    uptime_ms: 0,
    keys: {},
    connectivity: {},
    environment: {
      node_version: process.version,
      region: process.env.AWS_REGION || "us",
    },
  };

  try {
    // ✅ 1️⃣ Check presence of env keys
    result.keys.odds_api_key = process.env.ODDS_API_KEY ? "present" : "missing";
    result.keys.roster_api_key = process.env.ROSTER_API_KEY ? "present" : "missing";

    // ✅ 2️⃣ Check external API endpoints
    const apiTests = {
      odds_api: "https://api.the-odds-api.com/v4/sports",
      sportsdata_io: "https://api.sportsdata.io/api/sports",
    };

    for (const [key, url] of Object.entries(apiTests)) {
      try {
        const res = await fetch(url, { method: "HEAD", timeout: 3000 });
        result.connectivity[key] = res.ok ? "ok" : `fail (${res.status})`;
      } catch {
        result.connectivity[key] = "fail (timeout)";
      }
    }

    // ✅ 3️⃣ Check primary router
    try {
      const res = await fetch(`${PRIMARY}/router?operation=health`, { timeout: 5000 });
      result.connectivity.router_primary = res.ok ? "ok" : `fail (${res.status})`;
    } catch {
      result.connectivity.router_primary = "fail (timeout)";
    }

    // ✅ 4️⃣ Check backup router (optional redundancy)
    try {
      const res = await fetch(`${BACKUP}/router-backup?operation=health`, { timeout: 5000 });
      result.connectivity.router_backup = res.ok ? "ok" : `fail (${res.status})`;
    } catch {
      result.connectivity.router_backup = "fail (timeout)";
    }

    // ✅ 5️⃣ Aggregate result
    const allOk = Object.values(result.connectivity).every((v) => v.startsWith("ok"));
    result.status = allOk ? "operational" : "degraded";
    result.uptime_ms = Date.now() - start;

    return {
      statusCode: 200,
      body: JSON.stringify(result, null, 2),
    };
  } catch (err) {
    console.error("[Health] Fatal error:", err);
    result.status = "fail";
    result.error = err.message;
    return {
      statusCode: 500,
      body: JSON.stringify(result, null, 2),
    };
  }
};
