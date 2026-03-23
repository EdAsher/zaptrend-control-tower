const { db, FieldValue } = require("../config/firestore");
const { runFullTrendCycle } = require("./trendAutomationEngine");

function buildRunId(prefix = "multiautorun") {
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

async function getCoverageConfig() {
  const doc = await db.collection("config").doc("coverage").get();

  if (!doc.exists) {
    return {
      countries_enabled: ["TH"],
      categories_enabled: ["beauty_skincare"]
    };
  }

  const data = doc.data() || {};

  return {
    countries_enabled: Array.isArray(data.countries_enabled)
      ? data.countries_enabled
      : ["TH"],
    categories_enabled: Array.isArray(data.categories_enabled)
      ? data.categories_enabled
      : ["beauty_skincare"]
  };
}

async function runMultiTrendCycle({
  countries = [],
  categories = [],
  scoreLimit = 10
} = {}) {
  const multiRunId = buildRunId("multiautorun");
  const startedAtIso = new Date().toISOString();

  const runRef = db.collection("trend_multi_runs").doc(multiRunId);

  await runRef.set({
    multi_run_id: multiRunId,
    status: "RUNNING",
    started_at_iso: startedAtIso,
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp()
  });

  try {
    const coverage = await getCoverageConfig();

    const selectedCountries =
      countries.length > 0
        ? countries.map(normalizeCountry)
        : coverage.countries_enabled.map(normalizeCountry);

    const selectedCategories =
      categories.length > 0
        ? categories.map(normalizeCategory)
        : coverage.categories_enabled.map(normalizeCategory);

    const combinations = [];

    for (const country of selectedCountries) {
      for (const category of selectedCategories) {
        combinations.push({ country, category });
      }
    }

    const results = [];

    for (const combo of combinations) {
      try {
        const result = await runFullTrendCycle({
          country: combo.country,
          category: combo.category,
          scoreLimit
        });

        results.push({
          country: combo.country,
          category: combo.category,
          ok: true,
          automation_run_id: result.automation_run_id,
          trend_run_id: result?.trend_score?.trend_run_id || null,
          scored_count: result?.trend_score?.scored_count || 0,
          sources_scanned: result?.source_scan?.sources_scanned || 0
        });
      } catch (error) {
        results.push({
          country: combo.country,
          category: combo.category,
          ok: false,
          error_message: error?.message || String(error)
        });
      }
    }

    const finishedAtIso = new Date().toISOString();

    await runRef.set(
      {
        status: "COMPLETED",
        finished_at_iso: finishedAtIso,
        total_combinations: combinations.length,
        success_count: results.filter((r) => r.ok).length,
        failed_count: results.filter((r) => !r.ok).length,
        results,
        updated_at: FieldValue.serverTimestamp()
      },
      { merge: true }
    );

    return {
      ok: true,
      message: "Multi trend cycle completed",
      multi_run_id: multiRunId,
      total_combinations: combinations.length,
      success_count: results.filter((r) => r.ok).length,
      failed_count: results.filter((r) => !r.ok).length,
      results
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

async function getMultiAutomationRuns(limit = 20) {
  const normalizedLimit = Number(limit || 20);

  const snap = await db.collection("trend_multi_runs").limit(100).get();

  let rows = snap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data()
  }));

  rows.sort((a, b) => {
    const aMs = Date.parse(a.started_at_iso || "") || 0;
    const bMs = Date.parse(b.started_at_iso || "") || 0;
    return bMs - aMs;
  });

  rows = rows.slice(0, normalizedLimit);

  return {
    ok: true,
    total: rows.length,
    rows
  };
}

module.exports = {
  runMultiTrendCycle,
  getMultiAutomationRuns
};