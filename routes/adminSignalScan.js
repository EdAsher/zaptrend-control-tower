const express = require("express");
const { runSourceSignalScan } = require("../services/sourceSignalScanEngine");

const router = express.Router();

router.post("/trends/source-scan", async (req, res) => {
  try {
    const { country = "TH", category = "beauty_skincare" } = req.body || {};

    const result = await runSourceSignalScan({ country, category });

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      ok: false,
      error: err.message
    });
  }
});

module.exports = router;