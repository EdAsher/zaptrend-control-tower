const express = require("express");

const {
  getDashboardOverview,
  getDashboardActivity
} = require("../services/dashboardService");

const router = express.Router();

router.get("/dashboard/overview", async (req, res) => {
  try {
    const data = await getDashboardOverview();
    res.json(data);
  } catch (err) {
    console.error("[DASHBOARD OVERVIEW ERROR]", err);
    res.status(500).json({
      ok: false,
      error: err?.message || "Failed to load dashboard overview"
    });
  }
});

router.get("/dashboard/activity", async (req, res) => {
  try {
    const limit = Number(req.query.limit || 20);
    const data = await getDashboardActivity(limit);
    res.json(data);
  } catch (err) {
    console.error("[DASHBOARD ACTIVITY ERROR]", err);
    res.status(500).json({
      ok: false,
      error: err?.message || "Failed to load dashboard activity"
    });
  }
});

module.exports = router;