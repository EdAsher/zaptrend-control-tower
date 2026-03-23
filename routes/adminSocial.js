const express = require("express");
const {
  runSocialScan,
  runDiscoveryBoost
} = require("../services/socialSignalEngine");

const router = express.Router();

router.post("/social/run", async (req, res) => {
  try {
    const { country = "TH", category = "beauty_skincare" } = req.body || {};
    const result = await runSocialScan({ country, category });
    res.json(result);
  } catch (err) {
    console.error("[SOCIAL RUN ERROR]", err);
    res.status(500).json({
      ok: false,
      error: err?.message || "Social run failed"
    });
  }
});

router.post("/social/discovery-boost", async (req, res) => {
  try {
    const {
      country = "TH",
      category = "beauty_skincare",
      theme = "local_exclusive",
      limit = 5,
      dry_run = false
    } = req.body || {};

    const result = await runDiscoveryBoost({
      country,
      category,
      theme,
      limit,
      dryRun: dry_run
    });

    res.json(result);
  } catch (err) {
    console.error("[DISCOVERY BOOST ERROR]", err);
    res.status(500).json({
      ok: false,
      error: err?.message || "Discovery boost failed"
    });
  }
});

module.exports = router;