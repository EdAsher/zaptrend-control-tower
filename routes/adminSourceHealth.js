const express = require("express");
const { runSourceHealthCheck } = require("../services/sourceHealthEngine");

const router = express.Router();

router.post("/sources/health-check", async (req, res) => {
  try {
    const {
      country = "TH",
      category = "beauty_skincare",
      limit = 50
    } = req.body || {};

    const result = await runSourceHealthCheck({
      country,
      category,
      limit
    });

    res.json(result);
  } catch (err) {
    console.error("[SOURCE HEALTH ERROR]", err);
    res.status(500).json({
      ok: false,
      error: err?.message || "Health check failed"
    });
  }
});

module.exports = router;