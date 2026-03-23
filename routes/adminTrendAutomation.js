const express = require("express");
const {
  runFullTrendCycle,
  getAutomationRuns
} = require("../services/trendAutomationEngine");
const {
  runMultiTrendCycle,
  getMultiAutomationRuns
} = require("../services/trendMultiAutomationEngine");
const { env } = require("../config/env");

const router = express.Router();

function hasValidAutomationToken(req) {
  const incoming = String(req.headers["x-zaptrend-token"] || "").trim();
  const expected = String(env.ZAPTREND_AUTOMATION_TOKEN || "").trim();

  if (!expected) return false;
  return incoming && incoming === expected;
}

router.post("/trends/run-full-cycle", async (req, res) => {
  try {
    const {
      country = "TH",
      category = "beauty_skincare",
      scoreLimit = 20
    } = req.body || {};

    const result = await runFullTrendCycle({
      country,
      category,
      scoreLimit
    });

    res.json(result);
  } catch (err) {
    console.error("[TREND AUTOMATION ERROR]", err);
    res.status(500).json({
      ok: false,
      error: err?.message || "Trend automation failed"
    });
  }
});

router.post("/trends/run-scheduled-cycle", async (req, res) => {
  try {
    if (!hasValidAutomationToken(req)) {
      return res.status(401).json({
        ok: false,
        error: "Unauthorized"
      });
    }

    const {
      country = "TH",
      category = "beauty_skincare",
      scoreLimit = 20
    } = req.body || {};

    const result = await runFullTrendCycle({
      country,
      category,
      scoreLimit
    });

    res.json(result);
  } catch (err) {
    console.error("[SCHEDULED TREND AUTOMATION ERROR]", err);
    res.status(500).json({
      ok: false,
      error: err?.message || "Scheduled trend automation failed"
    });
  }
});

router.post("/trends/run-multi-cycle", async (req, res) => {
  try {
    if (!hasValidAutomationToken(req)) {
      return res.status(401).json({
        ok: false,
        error: "Unauthorized"
      });
    }

    const {
      countries = [],
      categories = [],
      scoreLimit = 10
    } = req.body || {};

    const result = await runMultiTrendCycle({
      countries,
      categories,
      scoreLimit
    });

    res.json(result);
  } catch (err) {
    console.error("[MULTI TREND AUTOMATION ERROR]", err);
    res.status(500).json({
      ok: false,
      error: err?.message || "Multi trend automation failed"
    });
  }
});

router.get("/trends/automation-runs", async (req, res) => {
  try {
    const {
      country = "TH",
      category = "beauty_skincare",
      limit = 20
    } = req.query || {};

    const result = await getAutomationRuns({
      country,
      category,
      limit
    });

    res.json(result);
  } catch (err) {
    console.error("[AUTOMATION RUNS ERROR]", err);
    res.status(500).json({
      ok: false,
      error: err?.message || "Failed to load automation runs"
    });
  }
});

router.get("/trends/multi-runs", async (req, res) => {
  try {
    const { limit = 20 } = req.query || {};
    const result = await getMultiAutomationRuns(limit);
    res.json(result);
  } catch (err) {
    console.error("[MULTI AUTOMATION RUNS ERROR]", err);
    res.status(500).json({
      ok: false,
      error: err?.message || "Failed to load multi automation runs"
    });
  }
});

module.exports = router;