"use strict";

const crypto = require("crypto");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");

function getDb() {
  return getFirestore();
}

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
  return `trend_${safeId(country)}_${safeId(category)}_${Date.now()}`;
}

function normalizeItemName(brand, product) {
  return `${String(brand || "").trim()} ${String(product || "").trim()}`
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function computeRecencyBoost(isoStrings = []) {
  const now = Date.now();
  let boost = 0;

  for (const iso of isoStrings) {
    const ts = new Date(iso).getTime();
    if (!Number.isFinite(ts)) continue;

    const diffHours = (now - ts) / (1000 * 60 * 60);

    if (diffHours <= 24) boost += 6;
    else if (diffHours <= 72) boost += 4;
    else if (diffHours <= 168) boost += 2;
    else boost += 1;
  }

  return boost;
}

function scoreItem({ mentionCount, uniqueSourceCount, recencyBoost }) {
  return mentionCount * 5 + uniqueSourceCount * 10 + recencyBoost;
}

async function readRecentPosts(country, category) {
  const db = getDb();

  const normalizedCountry = String(country || "TH").toUpperCase();
  const normalizedCategory = String(category || "beauty_skincare").toLowerCase();

  const snap = await db
    .collection("social_posts")
    .where("country", "==", normalizedCountry)
    .where("category", "==", normalizedCategory)
    .get();

  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

function aggregatePosts(posts) {
  const map = new Map();

  for (const post of posts) {
    const key =
      normalizeItemName(post.brand, post.product) ||
      post.normalized_name ||
      post.item_name;

    if (!key) continue;

    if (!map.has(key)) {
      map.set(key, {
        normalized_name: key,
        brand: post.brand || "",
        product: post.product || "",
        country: post.country || "",
        category: post.category || "",
        mention_count: 0,
        source_ids: new Set(),
        captured_at_list: [],
        last_seen_at_iso: post.captured_at_iso || post.updated_at_iso || nowIso()
      });
    }

    const row = map.get(key);
    row.mention_count += 1;
    row.source_ids.add(post.source_id);
    row.captured_at_list.push(post.captured_at_iso || post.updated_at_iso || nowIso());

    const currentLast = new Date(row.last_seen_at_iso).getTime();
    const candidateLast = new Date(
      post.captured_at_iso || post.updated_at_iso || nowIso()
    ).getTime();

    if (candidateLast > currentLast) {
      row.last_seen_at_iso = post.captured_at_iso || post.updated_at_iso || nowIso();
    }
  }

  return Array.from(map.values()).map((row) => {
    const unique_source_count = row.source_ids.size;
    const recency_boost = computeRecencyBoost(row.captured_at_list);

    const score = scoreItem({
      mentionCount: row.mention_count,
      uniqueSourceCount: unique_source_count,
      recencyBoost: recency_boost
    });

    return {
      normalized_name: row.normalized_name,
      brand: row.brand,
      product: row.product,
      country: row.country,
      category: row.category,
      mention_count: row.mention_count,
      unique_source_count,
      recency_boost,
      score,
      last_seen_at_iso: row.last_seen_at_iso
    };
  });
}

async function saveTrendItems(runId, items) {
  const db = getDb();
  const batch = db.batch();

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    const rank = i + 1;
    const trendId = `trend_${hashId(
      `${item.country}|${item.category}|${item.normalized_name}`
    )}`;

    const ref = db.collection("trend_items").doc(trendId);

    batch.set(
      ref,
      {
        trend_id: trendId,
        trend_run_id: runId,
        rank,
        item_name: `${item.brand || ""} ${item.product || ""}`.trim(),
        normalized_name: item.normalized_name,
        brand: item.brand,
        product: item.product,
        country: item.country,
        category: item.category,
        mention_count: item.mention_count,
        unique_source_count: item.unique_source_count,
        recency_boost: item.recency_boost,
        score: item.score,
        last_seen_at_iso: item.last_seen_at_iso,
        updated_at_iso: nowIso(),
        created_at: Timestamp.now()
      },
      { merge: true }
    );
  }

  await batch.commit();
}

async function runTrendConsensus({ country, category, limit = 20 }) {
  const db = getDb();

  const normalizedCountry = String(country || "TH").toUpperCase();
  const normalizedCategory = String(category || "beauty_skincare").toLowerCase();
  const runId = buildRunId(normalizedCountry, normalizedCategory);

  const runRef = db.collection("trend_consensus_runs").doc(runId);

  await runRef.set({
    run_id: runId,
    country: normalizedCountry,
    category: normalizedCategory,
    status: "RUNNING",
    started_at_iso: nowIso(),
    created_at_iso: nowIso(),
    source_posts: 0,
    generated_count: 0
  });

  try {
    const posts = await readRecentPosts(normalizedCountry, normalizedCategory);

    const aggregated = aggregatePosts(posts)
      .sort(
        (a, b) =>
          b.score - a.score ||
          b.unique_source_count - a.unique_source_count ||
          b.mention_count - a.mention_count
      )
      .slice(0, Number(limit || 20));

    await saveTrendItems(runId, aggregated);

    await runRef.set(
      {
        status: "COMPLETED",
        completed_at_iso: nowIso(),
        source_posts: posts.length,
        generated_count: aggregated.length
      },
      { merge: true }
    );

    return {
      ok: true,
      run_id: runId,
      country: normalizedCountry,
      category: normalizedCategory,
      source_posts: posts.length,
      generated_count: aggregated.length,
      results: aggregated
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
  runTrendConsensus
};