"use strict";

const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const { getFirestore } = require("firebase-admin/firestore");

// IMPORTANT:
// Require service files only AFTER Firebase Admin is initialized.
const { runSocialScan } = require("./services/socialScanEngine");
const { runTrendConsensus } = require("./services/trendConsensusEngine");

const db = getFirestore();
const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

function safeUpper(value, fallback) {
  return String(value || fallback).trim().toUpperCase();
}

function safeLower(value, fallback) {
  return String(value || fallback).trim().toLowerCase();
}

app.get("/health", async (req, res) => {
  res.json({
    ok: true,
    service: "zaptrend-lite",
    ts: new Date().toISOString()
  });
});

/**
 * POST /admin/lite/social/run
 * body: { country, category }
 */
app.post("/admin/lite/social/run", async (req, res) => {
  try {
    const country = safeUpper(req.body?.country, "TH");
    const category = safeLower(req.body?.category, "beauty_skincare");

    const result = await runSocialScan({ country, category });
    return res.status(200).json(result);
  } catch (error) {
    console.error("[lite/social/run]", error);
    return res.status(500).json({
      ok: false,
      error: error.message || "Failed to run social scan"
    });
  }
});

/**
 * POST /admin/lite/trends/run
 * body: { country, category, limit? }
 */
app.post("/admin/lite/trends/run", async (req, res) => {
  try {
    const country = safeUpper(req.body?.country, "TH");
    const category = safeLower(req.body?.category, "beauty_skincare");
    const limit = Number(req.body?.limit || 20);

    const result = await runTrendConsensus({ country, category, limit });
    return res.status(200).json(result);
  } catch (error) {
    console.error("[lite/trends/run]", error);
    return res.status(500).json({
      ok: false,
      error: error.message || "Failed to run trend consensus"
    });
  }
});

/**
 * GET /admin/lite/sources?country=TH&category=beauty_skincare
 */
app.get("/admin/lite/sources", async (req, res) => {
  try {
    const country = safeUpper(req.query?.country, "TH");
    const category = safeLower(req.query?.category, "beauty_skincare");

    const snap = await db
      .collection("social_sources")
      .where("country", "==", country)
      .where("category", "==", category)
      .orderBy("updated_at_iso", "desc")
      .get();

    const results = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    return res.status(200).json({
      ok: true,
      country,
      category,
      count: results.length,
      results
    });
  } catch (error) {
    console.error("[lite/sources]", error);
    return res.status(500).json({
      ok: false,
      error: error.message || "Failed to fetch sources"
    });
  }
});

/**
 * GET /admin/lite/trends/latest?country=TH&category=beauty_skincare&limit=20
 */
app.get("/admin/lite/trends/latest", async (req, res) => {
  try {
    const country = safeUpper(req.query?.country, "TH");
    const category = safeLower(req.query?.category, "beauty_skincare");
    const limit = Number(req.query?.limit || 20);

    const snap = await db
      .collection("trend_items")
      .where("country", "==", country)
      .where("category", "==", category)
      .orderBy("score", "desc")
      .limit(limit)
      .get();

    const results = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    return res.status(200).json({
      ok: true,
      country,
      category,
      count: results.length,
      results
    });
  } catch (error) {
    console.error("[lite/trends/latest]", error);
    return res.status(500).json({
      ok: false,
      error: error.message || "Failed to fetch latest trends"
    });
  }
});

/**
 * POST /admin/lite/daily/run
 * body: { countries?: [], categories?: [] }
 */
app.post("/admin/lite/daily/run", async (req, res) => {
  try {
    const countries =
      Array.isArray(req.body?.countries) && req.body.countries.length
        ? req.body.countries.map((x) => safeUpper(x, "TH"))
        : ["TH"];

    const categories =
      Array.isArray(req.body?.categories) && req.body.categories.length
        ? req.body.categories.map((x) => safeLower(x, "beauty_skincare"))
        : ["beauty_skincare"];

    const results = [];

    for (const country of countries) {
      for (const category of categories) {
        const social = await runSocialScan({ country, category });
        const trends = await runTrendConsensus({ country, category, limit: 20 });

        results.push({
          country,
          category,
          social_run_id: social.run_id,
          trend_run_id: trends.run_id,
          posts_saved: social.posts_saved,
          generated_count: trends.generated_count
        });
      }
    }

    return res.status(200).json({
      ok: true,
      processed: results.length,
      results
    });
  } catch (error) {
    console.error("[lite/daily/run]", error);
    return res.status(500).json({
      ok: false,
      error: error.message || "Failed to run lite daily job"
    });
  }
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`ZapTrend Lite API listening on ${PORT}`);
});