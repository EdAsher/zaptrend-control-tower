"use strict";

const crypto = require("crypto");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");

const db = getFirestore();

function nowIso() {
  return new Date().toISOString();
}

function safeId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);
}

function hashId(input) {
  return crypto.createHash("md5").update(String(input)).digest("hex").slice(0, 16);
}

function buildRunId(country, category) {
  return `social_${safeId(country)}_${safeId(category)}_${Date.now()}`;
}

/**
 * Seed starter local reviewer sources.
 * Replace / expand this list over time with your real curated local reviewers.
 */
function getSeedSources(country, category) {
  const c = String(country || "TH").toUpperCase();
  const k = String(category || "beauty_skincare").toLowerCase();

  const presets = {
    TH: {
      beauty_skincare: [
        {
          source_id: "th_beauty_reviewer_1",
          platform: "instagram",
          handle: "@thbeautyreviewer1",
          display_name: "TH Beauty Reviewer 1",
          url: "https://instagram.com/thbeautyreviewer1"
        },
        {
          source_id: "th_beauty_reviewer_2",
          platform: "tiktok",
          handle: "@thbeautyreviewer2",
          display_name: "TH Beauty Reviewer 2",
          url: "https://tiktok.com/@thbeautyreviewer2"
        },
        {
          source_id: "th_beauty_blog_1",
          platform: "blog",
          handle: "thbeautyblog1",
          display_name: "TH Beauty Blog 1",
          url: "https://example.com/thbeautyblog1"
        }
      ],
      snacks_drinks: [
        {
          source_id: "th_snack_reviewer_1",
          platform: "instagram",
          handle: "@thsnackreviewer1",
          display_name: "TH Snack Reviewer 1",
          url: "https://instagram.com/thsnackreviewer1"
        },
        {
          source_id: "th_snack_reviewer_2",
          platform: "tiktok",
          handle: "@thsnackreviewer2",
          display_name: "TH Snack Reviewer 2",
          url: "https://tiktok.com/@thsnackreviewer2"
        }
      ]
    },
    SG: {
      snacks_drinks: [
        {
          source_id: "sg_snack_reviewer_1",
          platform: "instagram",
          handle: "@sgsnackreviewer1",
          display_name: "SG Snack Reviewer 1",
          url: "https://instagram.com/sgsnackreviewer1"
        },
        {
          source_id: "sg_food_creator_1",
          platform: "tiktok",
          handle: "@sgfoodcreator1",
          display_name: "SG Food Creator 1",
          url: "https://tiktok.com/@sgfoodcreator1"
        }
      ],
      beauty_skincare: [
        {
          source_id: "sg_beauty_reviewer_1",
          platform: "instagram",
          handle: "@sgbeautyreviewer1",
          display_name: "SG Beauty Reviewer 1",
          url: "https://instagram.com/sgbeautyreviewer1"
        },
        {
          source_id: "sg_beauty_reviewer_2",
          platform: "tiktok",
          handle: "@sgbeautyreviewer2",
          display_name: "SG Beauty Reviewer 2",
          url: "https://tiktok.com/@sgbeautyreviewer2"
        }
      ]
    }
  };

  const fallback = [
    {
      source_id: `${safeId(c)}_${safeId(k)}_reviewer_1`,
      platform: "instagram",
      handle: `@${safeId(c)}_${safeId(k)}_reviewer_1`,
      display_name: `${c} ${k} Reviewer 1`,
      url: "https://example.com/reviewer1"
    },
    {
      source_id: `${safeId(c)}_${safeId(k)}_reviewer_2`,
      platform: "tiktok",
      handle: `@${safeId(c)}_${safeId(k)}_reviewer_2`,
      display_name: `${c} ${k} Reviewer 2`,
      url: "https://example.com/reviewer2"
    }
  ];

  return presets?.[c]?.[k] || fallback;
}

/**
 * Demo/starter social mentions generator.
 * Replace later with your real scraper/parser/import pipeline.
 */
function getMockMentions(country, category, source) {
  const c = String(country || "TH").toUpperCase();
  const k = String(category || "beauty_skincare").toLowerCase();

  const catalog = {
    TH: {
      beauty_skincare: [
        { brand: "Srichand", product: "Translucent Powder", hashtag: "#thaibeauty" },
        { brand: "Mizumi", product: "UV Water Serum", hashtag: "#sunscreen" },
        { brand: "Cathy Doll", product: "Lip Matte Tint", hashtag: "#liptint" },
        { brand: "Srichand", product: "Translucent Powder", hashtag: "#powderreview" }
      ],
      snacks_drinks: [
        { brand: "Bento", product: "Spicy Seafood Roll", hashtag: "#thaisnacks" },
        { brand: "Mama", product: "Tom Yum Noodles", hashtag: "#instantnoodles" },
        { brand: "Bento", product: "Spicy Seafood Roll", hashtag: "#snackreview" },
        { brand: "Tasto", product: "Salted Egg Chips", hashtag: "#chips" }
      ]
    },
    SG: {
      snacks_drinks: [
        { brand: "Irvins", product: "Salted Egg Chips", hashtag: "#sgsnacks" },
        { brand: "TWG", product: "Tea Cookies", hashtag: "#giftfinds" },
        { brand: "Irvins", product: "Salted Egg Chips", hashtag: "#snacktok" },
        { brand: "Ya Kun", product: "Kaya Spread", hashtag: "#singaporefinds" }
      ],
      beauty_skincare: [
        { brand: "Suu Balm", product: "Rapid Itch Relief", hashtag: "#sgbeauty" },
        { brand: "Allies of Skin", product: "Peptides Moisturizer", hashtag: "#skincare" },
        { brand: "Suu Balm", product: "Rapid Itch Relief", hashtag: "#dermcare" }
      ]
    }
  };

  const pool =
    catalog?.[c]?.[k] || [
      { brand: "Local Brand", product: "Local Product A", hashtag: "#localfind" },
      { brand: "Local Brand", product: "Local Product B", hashtag: "#revieweditem" }
    ];

  // small deterministic spread per source
  const offset = source.source_id.length % pool.length;
  return [pool[offset], pool[(offset + 1) % pool.length]];
}

async function upsertSocialSource(source, country, category) {
  const ref = db.collection("social_sources").doc(source.source_id);
  const snap = await ref.get();
  const existing = snap.exists ? snap.data() : {};

  const payload = {
    source_id: source.source_id,
    platform: source.platform || "unknown",
    handle: source.handle || "",
    display_name: source.display_name || source.source_id,
    url: source.url || "",
    country: String(country || "").toUpperCase(),
    category: String(category || "").toLowerCase(),
    health_status: "healthy",
    status: "active",
    last_checked: nowIso(),
    updated_at_iso: nowIso(),
    created_at_iso: existing.created_at_iso || nowIso()
  };

  await ref.set(payload, { merge: true });
  return payload;
}

async function savePost(runId, source, country, category, mention) {
  const normalized_name = `${String(mention.brand || "").trim()} ${String(mention.product || "").trim()}`
    .trim()
    .toLowerCase();

  const postKey = `${source.source_id}|${country}|${category}|${normalized_name}|${Date.now()}|${Math.random()}`;
  const postId = `post_${hashId(postKey)}_${Date.now()}`;

  const payload = {
    post_id: postId,
    run_id: runId,
    source_id: source.source_id,
    platform: source.platform || "unknown",
    country: String(country || "").toUpperCase(),
    category: String(category || "").toLowerCase(),
    brand: mention.brand || "",
    product: mention.product || "",
    item_name: `${mention.brand || ""} ${mention.product || ""}`.trim(),
    normalized_name,
    hashtag: mention.hashtag || "",
    captured_at_iso: nowIso(),
    created_at: Timestamp.now(),
    updated_at_iso: nowIso()
  };

  await db.collection("social_posts").doc(postId).set(payload);
  return payload;
}

async function countRecentPostsBySource(sourceId, country, category) {
  const snap = await db
    .collection("social_posts")
    .where("source_id", "==", sourceId)
    .where("country", "==", String(country || "").toUpperCase())
    .where("category", "==", String(category || "").toLowerCase())
    .get();

  return snap.size;
}

async function refreshSourcePostCounts(country, category, sourceIds) {
  const batch = db.batch();

  for (const sourceId of sourceIds) {
    const count = await countRecentPostsBySource(sourceId, country, category);
    const ref = db.collection("social_sources").doc(sourceId);
    batch.set(
      ref,
      {
        post_count: count,
        updated_at_iso: nowIso()
      },
      { merge: true }
    );
  }

  await batch.commit();
}

async function runSocialScan({ country, category }) {
  const normalizedCountry = String(country || "TH").toUpperCase();
  const normalizedCategory = String(category || "beauty_skincare").toLowerCase();
  const runId = buildRunId(normalizedCountry, normalizedCategory);

  const runRef = db.collection("social_scan_runs").doc(runId);

  await runRef.set({
    run_id: runId,
    country: normalizedCountry,
    category: normalizedCategory,
    status: "RUNNING",
    started_at_iso: nowIso(),
    created_at_iso: nowIso(),
    sources_seeded: 0,
    posts_saved: 0
  });

  try {
    const seedSources = getSeedSources(normalizedCountry, normalizedCategory);

    let sourcesSeeded = 0;
    let postsSaved = 0;
    const sourceIds = [];

    for (const source of seedSources) {
      const savedSource = await upsertSocialSource(source, normalizedCountry, normalizedCategory);
      sourcesSeeded += 1;
      sourceIds.push(savedSource.source_id);

      const mentions = getMockMentions(normalizedCountry, normalizedCategory, savedSource);
      for (const mention of mentions) {
        await savePost(runId, savedSource, normalizedCountry, normalizedCategory, mention);
        postsSaved += 1;
      }
    }

    await refreshSourcePostCounts(normalizedCountry, normalizedCategory, sourceIds);

    await runRef.set(
      {
        status: "COMPLETED",
        completed_at_iso: nowIso(),
        sources_seeded: sourcesSeeded,
        posts_saved: postsSaved,
        healthy_sources: sourcesSeeded
      },
      { merge: true }
    );

    return {
      ok: true,
      run_id: runId,
      country: normalizedCountry,
      category: normalizedCategory,
      sources_seeded: sourcesSeeded,
      healthy_sources: sourcesSeeded,
      posts_saved: postsSaved
    };
  } catch (error) {
    await runRef.set(
      {
        status: "FAILED",
        failed_at_iso: nowIso(),
        error: error.message || String(error)
      },
      { merge: true }
    );
    throw error;
  }
}

module.exports = {
  runSocialScan
};