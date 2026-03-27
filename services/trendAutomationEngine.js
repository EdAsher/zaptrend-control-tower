const { db, FieldValue } = require("../config/firestore");
const { env } = require("../config/env");
const { runSourceSignalScan } = require("./sourceSignalScanEngine");
const { runTrendScoring } = require("./trendScoringEngine");
const { runSourceHealthCheck } = require("./sourceHealthEngine");
const { runReputationRecalculation } = require("./reputationEngine");

function buildRunId(prefix = "autorun") {
  const stamp = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${stamp}_${rand}`;
}

function normalizeCountry(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeCategory(value) {
  return String(value || "").trim();
}

async function runFullTrendCycle({
  country,
  category,
  scoreLimit = 20
}) {
  const normalizedCountry = normalizeCountry(
    country || env.ZAPTREND_DEFAULT_COUNTRY || "TH"
  );
  const normalizedCategory = normalizeCategory(
    category || env.ZAPTREND_DEFAULT_CATEGORY || "beauty_skincare"
  );

  const automationRunId = buildRunId("autorun");
  const startedAtIso = new Date().toISOString();

  const runRef = db.collection("trend_automation_runs").doc(automationRunId);

  await runRef.set({
    automation_run_id: automationRunId,
    country: normalizedCountry,
    category: normalizedCategory,
    status: "RUNNING",
    started_at_iso: startedAtIso,
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp()
  });

  try {
    // 🔥 STEP 0 — HEALTH CHECK
    const healthResult = await runSourceHealthCheck({
      country: normalizedCountry,
      category: normalizedCategory,
      limit: 50
    });

    // 🔥 STEP 1 — SOURCE SIGNAL SCAN + MEMORY UPDATE
    const sourceScanResult = await runSourceSignalScan({
      country: normalizedCountry,
      category: normalizedCategory
    });

    // 🔥 STEP 2 — TREND SCORING
    const trendScoreResult = await runTrendScoring({
      country: normalizedCountry,
      category: normalizedCategory,
      limit: scoreLimit
    });

    // 🔥 STEP 3 — REPUTATION RECALCULATION
    const reputationResult = await runReputationRecalculation({
      country: normalizedCountry,
      category: normalizedCategory,
      limit: 20
    });

    const finishedAtIso = new Date().toISOString();

    await runRef.set(
      {
        status: "COMPLETED",
        finished_at_iso: finishedAtIso,

        health_checked: healthResult?.checked || 0,
        health_updated: healthResult?.updated || 0,

        sources_scanned: sourceScanResult?.sources_scanned || 0,
        signals_extracted: sourceScanResult?.signals_extracted || 0,
        ingested_count:
          sourceScanResult?.ingestion_result?.ingested_count || 0,

        trend_run_id: trendScoreResult?.trend_run_id || null,
        scored_count: trendScoreResult?.scored_count || 0,

        reputation_recalculated_count:
          reputationResult?.recalculated_count || 0,
        reputation_run_id: reputationResult?.reputation_run_id || null,

        top_trends: (trendScoreResult?.trends || []).slice(0, 5).map((t) => ({
          brand: t.brand || "",
          product: t.product || "",
          trend_score: t.trend_score || 0,
          trend_status: t.trend_status || ""
        })),

        updated_at: FieldValue.serverTimestamp()
      },
      { merge: true }
    );

    return {
      ok: true,
      message: "Full trend cycle completed",
      automation_run_id: automationRunId,
      country: normalizedCountry,
      category: normalizedCategory,
      health: healthResult,
      source_scan: sourceScanResult,
      trend_score: trendScoreResult,
      reputation: reputationResult
    };
  } catch (error) {
    const finishedAtIso = new Date().toISOString();

    await runRef.set(
      {
        status: "FAILED",
        finished_at_iso: finishedAtIso,
        error_message: error?.message || String(error),
        updated_at: FieldValue.serverTimestamp()
      },
      { merge: true }
    );

    throw error;
  }
}

async function getAutomationRuns({
  country,
  category,
  limit = 20
}) {
  const normalizedCountry = normalizeCountry(
    country || env.ZAPTREND_DEFAULT_COUNTRY || "TH"
  );
  const normalizedCategory = normalizeCategory(
    category || env.ZAPTREND_DEFAULT_CATEGORY || "beauty_skincare"
  );
  const normalizedLimit = Number(limit || 20);

  const snap = await db.collection("trend_automation_runs").limit(100).get();

  let rows = snap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data()
  }));

  rows = rows.filter((row) => {
    return (
      String(row.country || "").toUpperCase() === normalizedCountry &&
      String(row.category || "") === normalizedCategory
    );
  });

  rows.sort((a, b) => {
    const aMs = Date.parse(a.started_at_iso || "") || 0;
    const bMs = Date.parse(b.started_at_iso || "") || 0;
    return bMs - aMs;
  });

  rows = rows.slice(0, normalizedLimit);

  return {
    ok: true,
    country: normalizedCountry,
    category: normalizedCategory,
    total: rows.length,
    rows
  };
}

module.exports = {
  runFullTrendCycle,
  getAutomationRuns
};