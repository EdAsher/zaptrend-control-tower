const express = require("express");
const { runPromotion } = require("../services/promotionEngine");

const router = express.Router();

router.post("/discovery/promote", async (req, res) => {
  try {
    const {
      country = "TH",
      category = "beauty_skincare",
      limit = 10
    } = req.body || {};

    const result = await runPromotion({
      country,
      category,
      limit
    });

    res.json(result);
  } catch (err) {
    console.error("[DISCOVERY PROMOTE ERROR]", err);
    res.status(500).json({
      ok: false,
      error: err?.message || "Promotion failed"
    });
  }
});

module.exports = router;