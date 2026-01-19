/**
 * ============================================================
 * 🧭 SUPER-PIPELINE ORCHESTRATOR BACKUP ROUTER v1.0
 * Fallback router for redundancy — shorter timeouts, no recursion.
 * ============================================================
 */

const BASE_URL =
  "https://super-pipeline-orchestrator.netlify.app/.netlify/functions";

exports.handler = async (event) => {
  try {
    const params = event.queryStringParameters || {};
    const operation = params.operation || "";
    const sport = params.sport || "";
    const regions = params.regions || "us,us2";
    const markets = params.markets || "all";
    const bookmakers = params.bookmakers || "draftkings,fanduel";
    const oddsFormat = params.oddsFormat || "american";
    const dateFormat = params.dateFormat || "iso";
    const force = params.force || false;

    console.log(`[BackupRouter] Operation: ${operation || "(none)"} | Sport: ${sport}`);

    // Helper to safely call downstream Netlify function
    const safeFetch = async (fn, query) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000); // shorter timeout
      const url = `${BASE_URL}/${fn}?${query}`;
      console.log(`[BackupRouter] → ${url}`);

      try {
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);
        const text = await res.text();
        return {
          statusCode: res.status,
          body: text || JSON.stringify({ message: "Empty downstream response" }),
        };
      } catch (err) {
        console.error(`[BackupRouter] Downstream fetch failed: ${err.message}`);
        return {
          statusCode: 502,
          body: JSON.stringify({
            error: "Downstream function timeout or failure",
            target: fn,
            message: err.message,
          }),
        };
      }
    };

    // ============================================================
    // ROUTING LOGIC
    // ============================================================
    switch (operation) {
      // ✅ Basic health endpoint
      case "":
      case "health":
      case "status":
        return {
          statusCode: 200,
          body: JSON.stringify({
            status: "ok",
            service: "router-backup",
            timestamp: new Date().toISOString(),
            environment: {
              node_version: process.version,
              region: process.env.AWS_REGION || "us",
            },
          }),
        };

      // 🏈 ROSTER OPS
      case "getRosterStatus":
      case "rosterStatus":
        return await safeFetch("roster-status", `sport=${sport}&force=${force}`);

      case "syncRoster":
      case "rosterSync":
        return await safeFetch("roster-sync", `sport=${sport}`);

      case "refreshRoster":
      case "rosterRefresh":
        return await safeFetch("roster-refresh", `sport=${sport}`);

      // 🎯 ODDS / MARKET
      case "getOdds":
      case "odds":
        return await safeFetch(
          "sportsDataproxy",
          `operation=getOdds&sport=${sport}&regions=${regions}&markets=${markets}&bookmakers=${bookmakers}&oddsFormat=${oddsFormat}&dateFormat=${dateFormat}`
        );

      // 🕒 SCHEDULER / VALIDATION
      case "scheduler":
        return await safeFetch("scheduler", "");

      case "validate_configs":
      case "validateConfigs":
        return await safeFetch("validate_configs", "");

      // 🚨 DEFAULT
      default:
        return {
          statusCode: 400,
          body: JSON.stringify({
            error: "Unsupported operation (backup router)",
            received_operation: operation,
          }),
        };
    }
  } catch (err) {
    console.error("[BackupRouter] Fatal:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Router-backup internal error",
        details: err.message || "No message",
      }),
    };
  }
};
