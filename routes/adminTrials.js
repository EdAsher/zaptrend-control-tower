const express = require("express");
const { runTrialEvaluation } = require("../services/trialsEngine");

const router = express.Router();

router.post("/trials/evaluate", async (req, res) => {
  try {
    const {
      country = "TH",
      category = "beauty_skincare",
      limit = 10
    } = req.body || {};

    const result = await runTrialEvaluation({
      country,
      category,
      limit
    });

    res.json(result);
  } catch (err) {
    console.error("[TRIALS EVALUATE ERROR]", err);
    res.status(500).json({
      ok: false,
      error: err?.message || "Trials evaluation failed"
    });
  }
});

module.exports = router;