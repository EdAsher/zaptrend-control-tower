const { db, FieldValue } = require("../config/firestore");
const { env } = require("../config/env");

function buildRunId(prefix = "trendrun") {
  const stamp = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${stamp}_${rand}`;
}

function buildTrendId(prefix = "trend") {
  const stamp = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${stamp}_${rand}`;
}

function normalizeCountry(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeCategory(value) {
  return String(value || "").trim();
}

function toMillis(value) {
  try {
    if (!value) return 0;
    if (typeof value?.toMillis === "function") return value.toMillis();
    if (typeof value?._seconds === "number") return value._seconds * 1000;
    if (typeof value === "string") {
      const ms = Date.parse(value);
      return Number.isNaN(ms) ? 0 : ms;
    }
    return 0;
  } catch {
    return 0;
  }
}

function computeFreshnessScore(lastSeenAt) {
  const now = Date.now();
  const seenMs = toMillis(lastSeenAt);

  if (!seenMs) return 0;

  const hoursAgo = (now - seenMs) / (1000 * 60 * 60);

  if (hoursAgo <= 6) return 25;
  if (hoursAgo <= 24) return 20;
  if (hoursAgo <= 48) return 15;
  if (hoursAgo <= 72) return 10;
  if (hoursAgo <= 168) return 5;

  return 0;
}

function computeSourceTypeScore(sourceTypes = []) {
  const set = new Set((sourceTypes || []).map((x) => String(x || "").trim()));

  let score = 0;
  if (set.has("manual_seed")) score += 5;
  if (set.has("source_scan")) score += 15;
  if (set.has("social_signal")) score += 20;

  return score;
}

function computeTrendScore(memoryDoc) {
  const totalMentions = Number(memoryDoc.total_mentions || 0);
  const cumulativeScore = Number(memoryDoc.cumulative_score || 0);
  const lastSignalScore = Number(memoryDoc.last_signal_score || 0);
  const freshnessScore = computeFreshnessScore(memoryDoc.last_seen_at);
  const sourceTypeScore = computeSourceTypeScore(memoryDoc.source_types || []);

  const score =
    totalMentions * 8 +
    cumulativeScore * 0.5 +
    lastSignalScore * 0.8 +
    freshnessScore +
    sourceTypeScore;

  return Math.round(score);
}

function computeTrendStatus(score) {
  if (score >= 120) return "HOT";
  if (score >= 80) return "TRENDING";
  if (score >= 40) return "WATCHLIST";
  return "LOW_SIGNAL";
}

function isCategoryValidMemory(row, category) {
  const cat = normalizeCategory(category).toLowerCase();
  const text = `${row.brand || ""} ${row.product || ""} ${row.hashtag || ""}`.toLowerCase();

  if (cat === "snacks_drinks") {
    return (
      text.includes("tea") ||
      text.includes("drink") ||
      text.includes("snack") ||
      text.includes("noodle") ||
      text.includes("milk") ||
      text.includes("food") ||
      text.includes("flavor") ||
      text.includes("seaweed") ||
      text.includes("yogurt") ||
      text.includes("juice") ||
      text.includes("coffee") ||
      text.includes("soda") ||
      text.includes("dessert") ||
      text.includes("ice cream") ||
      text.includes("chips") ||
      text.includes("candy")
    );
  }

  if (cat === "souvenirs_local_finds") {
    return (
      text.includes("souvenir") ||
      text.includes("craft") ||
      text.includes("gift") ||
      text.includes("silk") ||
      text.includes("ceramic") ||
      text.includes("tableware") ||
      text.includes("bag") ||
      text.includes("local") ||
      text.includes("market") ||
      text.includes("handmade")
    );
  }

  if (cat === "fashion_accessories") {
    return (
      text.includes("bag") ||
      text.includes("wallet") ||
      text.includes("earring") ||
      text.includes("fashion") ||
      text.includes("accessories") ||
      text.includes("tote") ||
      text.includes("handbag") ||
      text.includes("style") ||
      text.includes("jewelry") ||
      text.includes("bracelet") ||
      text.includes("necklace")
    );
  }

  return true;
}

async function runTrendScoring({
  country,
  category,
  limit = 20
}) {
  const normalizedCountry = normalizeCountry(
    country || env.ZAPTREND_DEFAULT_COUNTRY || "TH"
  );
  const normalizedCategory = normalizeCategory(
    category || env.ZAPTREND_DEFAULT_CATEGORY || "beauty_skincare"
  );
  const normalizedLimit = Number(limit || 20);

  const trendRunId = buildRunId("trendrun");

  const snap = await db
    .collection("signal_memory")
    .where("country", "==", normalizedCountry)
    .where("category", "==", normalizedCategory)
    .get();

  const memoryRows = snap.docs
    .map((doc) => ({
      id: doc.id,
      ...doc.data()
    }))
    .filter((row) => isCategoryValidMemory(row, normalizedCategory));

  const ranked = memoryRows
    .map((row) => {
      const trendScore = computeTrendScore(row);
      const trendStatus = computeTrendStatus(trendScore);

      return {
        memory_key: row.memory_key || row.id,
        country: normalizedCountry,
        category: normalizedCategory,
        brand: row.brand || "",
        product: row.product || "",
        hashtag: row.hashtag || "",
        total_mentions: Number(row.total_mentions || 0),
        cumulative_score: Number(row.cumulative_score || 0),
        last_signal_score: Number(row.last_signal_score || 0),
        source_types: row.source_types || [],
        last_seen_at: row.last_seen_at || null,
        trend_score: trendScore,
        trend_status: trendStatus
      };
    })
    .sort((a, b) => b.trend_score - a.trend_score)
    .slice(0, normalizedLimit);

  const batch = db.batch();

  const trendRunRef = db.collection("trend_runs").doc(trendRunId);
  batch.set(trendRunRef, {
    trend_run_id: trendRunId,
    country: normalizedCountry,
    category: normalizedCategory,
    scored_count: ranked.length,
    status: "COMPLETED",
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp()
  });

  const outputIds = [];

  for (const item of ranked) {
    const trendId = buildTrendId("trend");
    outputIds.push(trendId);

    const outputRef = db.collection("trend_outputs").doc(trendId);

    batch.set(outputRef, {
      trend_output_id: trendId,
      trend_run_id: trendRunId,
      memory_key: item.memory_key,
      country: item.country,
      category: item.category,
      brand: item.brand,
      product: item.product,
      hashtag: item.hashtag,
      total_mentions: item.total_mentions,
      cumulative_score: item.cumulative_score,
      last_signal_score: item.last_signal_score,
      source_types: item.source_types,
      last_seen_at: item.last_seen_at || null,
      trend_score: item.trend_score,
      trend_status: item.trend_status,
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp()
    });
  }

  batch.set(
    trendRunRef,
    {
      trend_output_ids: outputIds
    },
    { merge: true }
  );

  await batch.commit();

  return {
    ok: true,
    message: "Trend scoring completed",
    trend_run_id: trendRunId,
    country: normalizedCountry,
    category: normalizedCategory,
    scored_count: ranked.length,
    trends: ranked
  };
}

module.exports = {
  runTrendScoring
};