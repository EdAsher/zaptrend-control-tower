const express = require("express");
const { runReputationRecalculation } = require("../services/reputationEngine");

const router = express.Router();

router.post("/reputation/recalculate", async (req, res) => {
  try {
    const {
      country = "TH",
      category = "beauty_skincare",
      limit = 20
    } = req.body || {};

    const result = await runReputationRecalculation({
      country,
      category,
      limit
    });

    res.json(result);
  } catch (err) {
    console.error("[REPUTATION RECALCULATE ERROR]", err);
    res.status(500).json({
      ok: false,
      error: err?.message || "Reputation recalculation failed"
    });
  }
});

module.exports = router;