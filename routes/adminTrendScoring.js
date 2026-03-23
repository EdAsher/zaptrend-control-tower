const express = require("express");
const { runTrendScoring } = require("../services/trendScoringEngine");

const router = express.Router();

router.post("/trends/score", async (req, res) => {
  try {
    const {
      country = "TH",
      category = "beauty_skincare",
      limit = 20
    } = req.body || {};

    const result = await runTrendScoring({
      country,
      category,
      limit
    });

    res.json(result);
  } catch (err) {
    console.error("[TREND SCORING ERROR]", err);
    res.status(500).json({
      ok: false,
      error: err?.message || "Trend scoring failed"
    });
  }
});

module.exports = router;