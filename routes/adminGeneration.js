const express = require("express");

const router = express.Router();

router.get("/generation/status", async (req, res) => {
  res.json({
    countdown_seconds: 0,
    next_generation_local_iso: "",
    timezone: "Asia/Singapore",
    latest_run: null,
    queued_runs: [],
    failed_runs: [],
    latest_output_preview: null
  });
});

router.post("/processQueued", async (req, res) => {
  res.json({ ok: true, message: "Queue processed" });
});

router.post("/runDaily", async (req, res) => {
  res.json({ ok: true, message: "Daily generation triggered" });
});

module.exports = router;