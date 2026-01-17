/**
 * ============================================================
 * CONFIG VALIDATOR v3.2.0 — Super-Pipeline Orchestrator
 * ============================================================
 * Validates pipeline, parlay, output, display, and market ingest settings
 * before any pick or parlay generation.
 * ============================================================
 */

import fs from "fs";
import path from "path";

const CONFIG_DIR = path.resolve("./data");
const EXPECTED_VERSION = "3.2.0";

const REQUIRED_FILES = [
  "pipeline_settings.json",
  "parlay_settings.json",
  "output_contract.json",
  "display_settings.json",
  "market_ingest_settings.json"
];

const WRAPPER_FILES = [
  "NFL-X-SUPER-PIPELINE-WRAPPER.txt",
  "NBA-X-SUPER-PIPELINE-WRAPPER_v1.1.0.txt",
  "NHL-X-SUPER-PIPELINE-WRAPPER_v1.1.0.txt",
  "NCAAB-X-SUPER-PIPELINE-WRAPPER_v1.1.0.txt",
  "NCAAF-X-SUPER-PIPELINE-WRAPPER_v1.1.0.txt",
  "PGA-X-SUPER-PIPELINE-WRAPPER_v1.1.0.txt",
  "SOCCER-X-SUPER-PIPELINE-WRAPPER_v1.1.0.txt",
  "UFC-X-SUPER-PIPELINE-WRAPPER_v1.1.0.txt"
];

const color = {
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  reset: "\x1b[0m"
};

export async function validateConfigs() {
  console.log("\n🔍 Running Super-Pipeline Config Health Check...\n");

  const results = [];

  for (const file of REQUIRED_FILES) {
    const filePath = path.join(CONFIG_DIR, file);
    try {
      if (!fs.existsSync(filePath)) {
        results.push({ file, status: "⚠️ Missing", color: color.yellow });
        continue;
      }

      const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
      const version = data.version || "unknown";

      if (version !== EXPECTED_VERSION) {
        results.push({
          file,
          status: `⚠️ Version mismatch (v${version})`,
          color: color.yellow
        });
        continue;
      }

      results.push({ file, status: "✅ OK", color: color.green });
    } catch (err) {
      results.push({ file, status: "❌ Invalid JSON", color: color.red });
    }
  }

  const wrapperPath = path.resolve("./");
  const wrappersFound = WRAPPER_FILES.filter(f =>
    fs.existsSync(path.join(wrapperPath, f))
  );

  if (wrappersFound.length < WRAPPER_FILES.length) {
    results.push({
      file: "Wrappers",
      status: `⚠️ ${wrappersFound.length}/${WRAPPER_FILES.length} Found`,
      color: color.yellow
    });
  } else {
    results.push({
      file: "Wrappers",
      status: "✅ All Verified",
      color: color.green
    });
  }

  // Summary Output
  console.log("─────────────────────────────────────────────");
  for (const r of results) {
    console.log(`${r.color}${r.status}${color.reset} — ${r.file}`);
  }
  console.log("─────────────────────────────────────────────\n");

  const hasCriticalError = results.some(r => r.status.includes("❌"));
  const hasWarnings = results.some(r => r.status.includes("⚠️"));

  if (hasCriticalError) {
    console.log(`${color.red}❌ Critical error detected — aborting run.${color.reset}\n`);
    throw new Error("CONFIG_VALIDATION_FAILED");
  }

  if (hasWarnings) {
    console.log(`${color.yellow}⚠️ Warnings detected — continuing with caution.${color.reset}\n`);
  } else {
    console.log(`${color.green}✅ All configurations synchronized and healthy.${color.reset}\n`);
  }

  return { results, hasWarnings, hasCriticalError };
}

// If this file is run directly via Node:
if (process.argv[1] === new URL(import.meta.url).pathname) {
  validateConfigs();
}