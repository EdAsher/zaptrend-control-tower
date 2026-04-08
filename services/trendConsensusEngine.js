"use strict";

const crypto = require("crypto");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");

function getDb() {
  return getFirestore();
}

function nowIso() {
  return new Date().toISOString();
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
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

function getStatusBand(score, firstSeenAtIso, mentionCount7d) {
  const firstSeenTs = firstSeenAtIso ? new Date(firstSeenAtIso).getTime() : 0;
  const ageDays = firstSeenTs ? (Date.now() - firstSeenTs) / (1000 * 60 * 60 * 24) : 999;

  if (score >= 120 && mentionCount7d >= 2) return "trending";
  if (score >= 70 && ageDays <= 7) return "new_rising";
  if (score >= 35) return "holding";
  return "archive_ready";
}

function computeDailySignal({
  todayMentions,
  todayUniqueSources,
  localBonus,
  exclusivityBonus,
  genericPenalty
}) {
  return (
    Number(todayMentions || 0) * 20 +
    Number(todayUniqueSources || 0) * 30 +
    Number(localBonus || 0) +
    Number(exclusivityBonus || 0) -
    Number(genericPenalty || 0)
  );
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
  const today = todayKey();
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
        mention_count_7d: 0,
        source_ids_7d: new Set(),
        today_mentions: 0,
        today_source_ids: new Set(),
        local_bonus_total: 0,
        exclusivity_bonus_total: 0,
        generic_penalty_total: 0,
        last_seen_at_iso: post.captured_at_iso || post.updated_at_iso || nowIso()
      });
    }

    const row = map.get(key);
    row.mention_count_7d += 1;
    row.source_ids_7d.add(post.source_id);

    if (post.captured_day === today) {
      row.today_mentions += 1;
      row.today_source_ids.add(post.source_id);
      row.local_bonus_total += Number(post.local_bonus || 0);
      row.exclusivity_bonus_total += Number(post.exclusivity_bonus || 0);
      row.generic_penalty_total += Number(post.generic_penalty || 0);
    }

    const currentLast = new Date(row.last_seen_at_iso).getTime();
    const candidateLast = new Date(post.captured_at_iso || post.updated_at_iso || nowIso()).getTime();
    if (candidateLast > currentLast) {
      row.last_seen_at_iso = post.captured_at_iso || post.updated_at_iso || nowIso();
    }
  }

  return Array.from(map.values()).map((row) => {
    const unique_sources_7d = row.source_ids_7d.size;
    const today_unique_sources = row.today_source_ids.size;

    const avgLocalBonus =
      row.today_mentions > 0 ? row.local_bonus_total / row.today_mentions : 0;
    const avgExclusivityBonus =
      row.today_mentions > 0 ? row.exclusivity_bonus_total / row.today_mentions : 0;
    const avgGenericPenalty =
      row.today_mentions > 0 ? row.generic_penalty_total / row.today_mentions : 0;

    const daily_signal = computeDailySignal({
      todayMentions: row.today_mentions,
      todayUniqueSources: today_unique_sources,
      localBonus: avgLocalBonus,
      exclusivityBonus: avgExclusivityBonus,
      genericPenalty: avgGenericPenalty
    });

    return {
      normalized_name: row.normalized_name,
      brand: row.brand,
      product: row.product,
      country: row.country,
      category: row.category,
      mention_count_7d: row.mention_count_7d,
      unique_sources_7d,
      today_mentions: row.today_mentions,
      today_unique_sources,
      daily_signal,
      local_bonus: avgLocalBonus,
      exclusivity_bonus: avgExclusivityBonus,
      generic_penalty: avgGenericPenalty,
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
    const existingSnap = await ref.get();
    const existing = existingSnap.exists ? existingSnap.data() : {};

    const previousScore = Number(existing?.score || 0);
    const retainedScore = previousScore * 0.92;
    const newScore = Number((retainedScore + item.daily_signal).toFixed(2));

    const firstSeenAtIso = existing?.first_seen_at_iso || nowIso();
    const statusBand = getStatusBand(newScore, firstSeenAtIso, item.mention_count_7d);

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

        score: newScore,
        retained_score: Number(retainedScore.toFixed(2)),
        daily_signal: item.daily_signal,

        today_mentions: item.today_mentions,
        today_unique_sources: item.today_unique_sources,
        mention_count_7d: item.mention_count_7d,
        unique_sources_7d: item.unique_sources_7d,

        local_bonus: item.local_bonus,
        exclusivity_bonus: item.exclusivity_bonus,
        generic_penalty: item.generic_penalty,

        status_band: statusBand,
        first_seen_at_iso: firstSeenAtIso,
        last_seen_at_iso: item.last_seen_at_iso,

        updated_at_iso: nowIso(),
        created_at: existing?.created_at || Timestamp.now()
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
          b.daily_signal - a.daily_signal ||
          b.today_unique_sources - a.today_unique_sources ||
          b.today_mentions - a.today_mentions
      )
      .slice(0, Number(limit || 20));

    await saveTrendItems(runId, aggregated);

    const latestSnap = await db
      .collection("trend_items")
      .where("country", "==", normalizedCountry)
      .where("category", "==", normalizedCategory)
      .orderBy("score", "desc")
      .limit(Number(limit || 20))
      .get();

    const results = latestSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

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
      results
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