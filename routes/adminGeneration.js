const express = require("express");
const {
  runFullGenerationPipeline,
  getGenerationRuns
} = require("../services/generationEngine");

const router = express.Router();

router.get("/generation/runs", async (req, res) => {
  try {
    const {
      country = "TH",
      category = "beauty_skincare",
      limit = 20
    } = req.query || {};

    const result = await getGenerationRuns({
      country,
      category,
      limit
    });

    res.json(result);
  } catch (err) {
    console.error("[GENERATION RUNS ERROR]", err);
    res.status(500).json({
      ok: false,
      error: err?.message || "Failed to load generation runs"
    });
  }
});

router.post("/generation/run", async (req, res) => {
  try {
    const {
      country = "TH",
      category = "beauty_skincare",
      discoveryLimit = 10,
      trialLimit = 15,
      promotionLimit = 15,
      scoreLimit = 20,
      healthLimit = 80,
      reputationLimit = 20,
      dryRun = false
    } = req.body || {};

    const result = await runFullGenerationPipeline({
      country,
      category,
      discoveryLimit,
      trialLimit,
      promotionLimit,
      scoreLimit,
      healthLimit,
      reputationLimit,
      dryRun
    });

    res.json(result);
  } catch (err) {
    console.error("[GENERATION RUN ERROR]", err);
    res.status(500).json({
      ok: false,
      error: err?.message || "Generation run failed"
    });
  }
});

router.get("/generation/status", async (req, res) => {
  try {
    const {
      country = "TH",
      category = "beauty_skincare"
    } = req.query || {};

    const runs = await getGenerationRuns({
      country,
      category,
      limit: 1
    });

    const latest = runs?.rows?.[0] || null;

    res.json({
      ok: true,
      country,
      category,
      engine_status: latest?.status || "IDLE",
      latest_run: latest
    });
  } catch (err) {
    console.error("[GENERATION STATUS ERROR]", err);
    res.status(500).json({
      ok: false,
      error: err?.message || "Failed to load generation status"
    });
  }
});

module.exports = router;