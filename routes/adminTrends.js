const express = require("express");
const {
  ingestSignals,
  getSignalMemory
} = require("../services/signalMemoryEngine");

const router = express.Router();

router.post("/trends/ingest-signals", async (req, res) => {
  try {
    const {
      country = "TH",
      category = "beauty_skincare",
      sourceType = "manual_seed",
      signals = []
    } = req.body || {};

    const result = await ingestSignals({
      country,
      category,
      sourceType,
      signals
    });

    res.json(result);
  } catch (err) {
    console.error("[INGEST SIGNALS ERROR]", err);
    res.status(500).json({
      ok: false,
      error: err?.message || "Signal ingestion failed"
    });
  }
});

router.get("/trends/signal-memory", async (req, res) => {
  try {
    const {
      country = "TH",
      category = "beauty_skincare",
      limit = 20
    } = req.query || {};

    const result = await getSignalMemory({
      country,
      category,
      limit
    });

    res.json(result);
  } catch (err) {
    console.error("[SIGNAL MEMORY ERROR]", err);
    res.status(500).json({
      ok: false,
      error: err?.message || "Failed to load signal memory"
    });
  }
});

module.exports = router;