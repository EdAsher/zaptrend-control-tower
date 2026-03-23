const express = require("express");
const {
  getTrendOutputs,
  getTrendRuns
} = require("../services/trendFeedService");

const {
  normalizeTrendRunDoc
} = require("../lib/admin/normalizeTrendRun");

const {
  normalizeTrendOutputDoc
} = require("../lib/admin/normalizeTrendOutput");

const router = express.Router();

router.get("/trends/outputs", async (req, res) => {
  try {
    const {
      country = "TH",
      category = "beauty_skincare",
      status = "",
      limit = 50
    } = req.query || {};

    const result = await getTrendOutputs({
      country,
      category,
      status,
      limit
    });

    // 🔥 OPTIONAL (SAFE TO ENABLE)
    const rows = (result.rows || []).map((doc) =>
      normalizeTrendOutputDoc(doc)
    );

    res.json({
      ...result,
      rows
    });

  } catch (err) {
    console.error("[TREND OUTPUTS ERROR]", err);
    res.status(500).json({
      ok: false,
      error: err?.message || "Failed to load trend outputs"
    });
  }
});

router.get("/trends/runs", async (req, res) => {
  try {
    const {
      country = "TH",
      category = "beauty_skincare",
      limit = 20
    } = req.query || {};

    const result = await getTrendRuns({
      country,
      category,
      limit
    });

    // 🔥 NORMALIZE HERE
    const rows = (result.rows || []).map((doc) =>
      normalizeTrendRunDoc(doc)
    );

    res.json({
      ...result,
      rows
    });

  } catch (err) {
    console.error("[TREND RUNS ERROR]", err);
    res.status(500).json({
      ok: false,
      error: err?.message || "Failed to load trend runs"
    });
  }
});

module.exports = router;