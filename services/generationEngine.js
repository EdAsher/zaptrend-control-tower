const { db, FieldValue } = require("../config/firestore");
const { env } = require("../config/env");
const { DEFAULTS } = require("../config/constants");

const { runDiscoveryBoost } = require("./socialSignalEngine");
const { runSourceHealthCheck } = require("./sourceHealthEngine");
const { runTrialEvaluation } = require("./trialsEngine");
const { runPromotion } = require("./promotionEngine");
const { runSourceSignalScan } = require("./sourceSignalScanEngine");
const { runTrendScoring } = require("./trendScoringEngine");
const { runReputationRecalculation } = require("./reputationEngine");

function buildRunId(prefix = "generationrun") {
  const stamp = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${stamp}_${rand}`;
}

function normalizeCountry(value) {
  return String(
    value || env.ZAPTREND_DEFAULT_COUNTRY || DEFAULTS.COUNTRY
  ).trim().toUpperCase();
}

function normalizeCategory(value) {
  return String(
    value || env.ZAPTREND_DEFAULT_CATEGORY || DEFAULTS.CATEGORY
  ).trim();
}

async function runFullGenerationPipeline({
  country,
  category,
  discoveryLimit = 10,
  trialLimit = 15,
  promotionLimit = 15,
  scoreLimit = 20,
  healthLimit = 80,
  reputationLimit = 20,
  dryRun = false
} = {}) {
  const normalizedCountry = normalizeCountry(country);
  const normalizedCategory = normalizeCategory(category);

  const generationRunId = buildRunId("generationrun");
  const startedAtIso = new Date().toISOString();

  const runRef = db.collection("generation_runs").doc(generationRunId);

  await runRef.set({
    generation_run_id: generationRunId,
    country: normalizedCountry,
    category: normalizedCategory,
    status: "RUNNING",
    started_at_iso: startedAtIso,
    discovery_limit: Number(discoveryLimit || 10),
    trial_limit: Number(trialLimit || 15),
    promotion_limit: Number(promotionLimit || 15),
    score_limit: Number(scoreLimit || 20),
    health_limit: Number(healthLimit || 80),
    reputation_limit: Number(reputationLimit || 20),
    dry_run: Boolean(dryRun),
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp()
  });

  try {
    const discovery = await runDiscoveryBoost({
      country: normalizedCountry,
      category: normalizedCategory,
      limit: Number(discoveryLimit || 10),
      dryRun: Boolean(dryRun)
    });

    const health = await runSourceHealthCheck({
      country: normalizedCountry,
      category: normalizedCategory,
      limit: Number(healthLimit || 80),
      include_candidates: true
    });

    const trials = await runTrialEvaluation({
      country: normalizedCountry,
      category: normalizedCategory,
      limit: Number(trialLimit || 15)
    });

    const promotion = await runPromotion({
      country: normalizedCountry,
      category: normalizedCategory,
      limit: Number(promotionLimit || 15)
    });

    const sourceScan = await runSourceSignalScan({
      country: normalizedCountry,
      category: normalizedCategory
    });

    const trendScore = await runTrendScoring({
      country: normalizedCountry,
      category: normalizedCategory,
      limit: Number(scoreLimit || 20)
    });

    const reputation = await runReputationRecalculation({
      country: normalizedCountry,
      category: normalizedCategory,
      limit: Number(reputationLimit || 20)
    });

    const finishedAtIso = new Date().toISOString();

    const summary = {
      discovered_count: discovery?.candidates_created || 0,
      health_checked: health?.checked || 0,
      health_updated: health?.updated || 0,
      trials_evaluated: trials?.evaluated_count || 0,
      trials_approved: trials?.approved_count || 0,
      trials_rejected: trials?.rejected_count || 0,
      promoted_count: promotion?.promoted_count || 0,
      sources_scanned: sourceScan?.sources_scanned || 0,
      signals_extracted: sourceScan?.signals_extracted || 0,
      trends_scored: trendScore?.scored_count || 0,
      reputation_recalculated: reputation?.recalculated_count || 0
    };

    await runRef.set(
      {
        status: "COMPLETED",
        finished_at_iso: finishedAtIso,
        summary,
        discovery_run_id: discovery?.discovery_run_id || null,
        promotion_run_id: promotion?.promotion_run_id || null,
        trend_run_id: trendScore?.trend_run_id || null,
        reputation_run_id: reputation?.reputation_run_id || null,
        top_trends: (trendScore?.trends || []).slice(0, 5).map((t) => ({
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
      message: "Full generation pipeline completed",
      generation_run_id: generationRunId,
      country: normalizedCountry,
      category: normalizedCategory,
      summary,
      discovery,
      health,
      trials,
      promotion,
      source_scan: sourceScan,
      trend_score: trendScore,
      reputation
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

async function getGenerationRuns({
  country,
  category,
  limit = 20
} = {}) {
  const normalizedCountry = normalizeCountry(country);
  const normalizedCategory = normalizeCategory(category);
  const normalizedLimit = Number(limit || 20);

  const snap = await db.collection("generation_runs").limit(100).get();

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
  runFullGenerationPipeline,
  getGenerationRuns
};