const express = require("express");
const { getSourcesOverview } = require("../services/sourcesService");
const { normalizeSourceDoc } = require("../lib/admin/normalizeSource");

const router = express.Router();

router.get("/sources", async (req, res) => {
  try {
    const {
      country = "",
      category = "",
      status = "",
      limit = 100
    } = req.query || {};

    const result = await getSourcesOverview({
      country,
      category,
      status,
      limit
    });

    // 🔥 NORMALIZE HERE
    const rows = (result.rows || []).map((doc) =>
      normalizeSourceDoc(doc)
    );

    res.json({
      ...result,
      rows
    });

  } catch (err) {
    console.error("[SOURCES OVERVIEW ERROR]", err);
    res.status(500).json({
      ok: false,
      error: err?.message || "Failed to load sources"
    });
  }
});

module.exports = router;