const express = require("express");
const { getSourcesOverview } = require("../services/sourcesService");
const { normalizeSourceDoc } = require("../lib/admin/normalizeSource");
const { db, FieldValue } = require("../config/firestore");
const { runSourceHealthCheck } = require("../services/sourceHealthEngine");

const router = express.Router();

function getCollectionName(sourceKind) {
  return String(sourceKind || "").toUpperCase() === "CANDIDATE"
    ? "source_discovery_candidates"
    : "ai_sources";
}

/**
 * GET /admin/sources
 */
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

    const ai_sources = (result.ai_sources || []).map((doc) =>
      normalizeSourceDoc(doc)
    );

    const candidates = (result.candidates || []).map((doc) =>
      normalizeSourceDoc(doc)
    );

    res.json({
      ...result,
      ai_sources,
      candidates
    });
  } catch (err) {
    console.error("[SOURCES OVERVIEW ERROR]", err);
    res.status(500).json({
      ok: false,
      error: err?.message || "Failed to load sources"
    });
  }
});

/**
 * POST /admin/sources/recheck
 */
router.post("/sources/recheck", async (req, res) => {
  try {
    const {
      source_id,
      source_kind = "AI_SOURCE",
      country = "",
      category = ""
    } = req.body || {};

    if (!source_id) {
      return res.status(400).json({ ok: false, error: "Missing source_id" });
    }

    const collectionName = getCollectionName(source_kind);
    const docRef = db.collection(collectionName).doc(source_id);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return res.status(404).json({ ok: false, error: "Source not found" });
    }

    const data = docSnap.data();

    const result = await runSourceHealthCheck({
      country: country || data.country || "",
      category: category || data.category || "",
      limit: 200,
      include_candidates: true
    });

    res.json({
      ok: true,
      message: "Rechecked successfully",
      result
    });
  } catch (err) {
    console.error("[RECHECK ERROR]", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * POST /admin/sources/disable
 */
router.post("/sources/disable", async (req, res) => {
  try {
    const {
      source_id,
      source_kind = "AI_SOURCE"
    } = req.body || {};

    if (!source_id) {
      return res.status(400).json({ ok: false, error: "Missing source_id" });
    }

    const collectionName = getCollectionName(source_kind);

    await db.collection(collectionName).doc(source_id).set(
      {
        is_active: false,
        auto_disabled: true,
        auto_disabled_reason: "manual_disable",
        health_status: "disabled",
        health_reason: "manual_disable",
        updated_at: FieldValue.serverTimestamp()
      },
      { merge: true }
    );

    res.json({ ok: true });
  } catch (err) {
    console.error("[DISABLE SOURCE ERROR]", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * POST /admin/sources/enable
 */
router.post("/sources/enable", async (req, res) => {
  try {
    const {
      source_id,
      source_kind = "AI_SOURCE"
    } = req.body || {};

    if (!source_id) {
      return res.status(400).json({ ok: false, error: "Missing source_id" });
    }

    const collectionName = getCollectionName(source_kind);

    await db.collection(collectionName).doc(source_id).set(
      {
        is_active: true,
        auto_disabled: false,
        auto_disabled_reason: "",
        health_status: "unknown",
        health_reason: "",
        health_fail_count: 0,
        health_consecutive_fail_count: 0,
        updated_at: FieldValue.serverTimestamp()
      },
      { merge: true }
    );

    res.json({ ok: true });
  } catch (err) {
    console.error("[ENABLE SOURCE ERROR]", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;