const { db, FieldValue } = require("../config/firestore");
const { COLLECTIONS, STATUSES, DEFAULTS } = require("../config/constants");
const { env } = require("../config/env");

function isoNow() {
  return new Date().toISOString();
}

function normalizeCountry(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeCategory(value) {
  return String(value || "").trim();
}

function buildRunId(prefix = "socialrun") {
  const stamp = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${stamp}_${rand}`;
}

function getMockSocialSources({ country, category }) {
  const cc = normalizeCountry(country);
  const cat = normalizeCategory(category);

  return [
    {
      source_id: `${cc}_${cat}_tiktok_creator_alpha`,
      platform: "tiktok",
      handle: "@thai_beauty_finds",
      url: "https://www.tiktok.com/",
      source_weight: 0.95
    },
    {
      source_id: `${cc}_${cat}_instagram_creator_beta`,
      platform: "instagram",
      handle: "@bangkok_skincare_daily",
      url: "https://www.instagram.com/",
      source_weight: 0.9
    },
    {
      source_id: `${cc}_${cat}_youtube_creator_gamma`,
      platform: "youtube",
      handle: "@ThaiBeautyRadar",
      url: "https://www.youtube.com/",
      source_weight: 0.85
    }
  ];
}

function extractMentionsFromSources({ country, category, sources }) {
  const cc = normalizeCountry(country);
  const cat = normalizeCategory(category);

  return [
    {
      mention_id: buildRunId("mention"),
      brand: "Srichand",
      product: "Translucent Powder",
      hashtag: "#thaibeauty",
      score: 88,
      country: cc,
      category: cat,
      signal_type: "brand_product",
      discovered_from: sources[0]?.source_id || null
    },
    {
      mention_id: buildRunId("mention"),
      brand: "Mistine",
      product: "Eyeliner",
      hashtag: "#bangkokfinds",
      score: 80,
      country: cc,
      category: cat,
      signal_type: "product_trend",
      discovered_from: sources[1]?.source_id || null
    },
    {
      mention_id: buildRunId("mention"),
      brand: "Yanhee",
      product: "Acne Gel",
      hashtag: "#thai skincare",
      score: 76,
      country: cc,
      category: cat,
      signal_type: "problem_solution",
      discovered_from: sources[2]?.source_id || null
    }
  ];
}

function buildSignalScoreSummary(mentions = []) {
  const total = mentions.reduce((sum, item) => sum + Number(item.score || 0), 0);

  const topBrands = mentions
    .map((m) => ({ name: m.brand, score: m.score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const topProducts = mentions
    .map((m) => ({ name: m.product, score: m.score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const topHashtags = mentions
    .map((m) => ({ name: m.hashtag, score: m.score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return {
    total,
    top_brands: topBrands,
    top_products: topProducts,
    top_hashtags: topHashtags
  };
}

function buildDiscoveryGuidance({ country, category, mentions }) {
  const top = [...mentions].sort((a, b) => b.score - a.score).slice(0, 3);

  return {
    country: normalizeCountry(country),
    category: normalizeCategory(category),
    suggested_candidates: top.map((m, index) => ({
      candidate_rank: index + 1,
      derived_from_brand: m.brand,
      derived_from_product: m.product,
      relevance_score: m.score,
      guidance_reason: `Strong repeated social signal from ${m.brand} / ${m.product}`
    }))
  };
}

async function persistSocialRun({
  runId,
  country,
  category,
  startedAt,
  finishedAt,
  sources,
  mentions,
  signalScoreSummary,
  discoveryGuidance
}) {
  const runRef = db.collection(COLLECTIONS.SOCIAL_RUNS).doc(runId);

  await runRef.set({
    run_id: runId,
    country,
    category,
    started_at: startedAt,
    finished_at: finishedAt,
    sources_scanned: sources.length,
    mentions_detected: mentions.length,
    signal_score_summary: signalScoreSummary,
    discovery_guidance: discoveryGuidance,
    source_ids: sources.map((s) => s.source_id),
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
    status: STATUSES.COMPLETED
  });

  const batch = db.batch();

  for (const mention of mentions) {
    const mentionRef = db
      .collection(COLLECTIONS.SOCIAL_MENTIONS)
      .doc(mention.mention_id);

    batch.set(mentionRef, {
      ...mention,
      run_id: runId,
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp()
    });
  }

  await batch.commit();
}

async function persistDiscoveryRun({
  runId,
  country,
  category,
  theme,
  limit,
  dryRun,
  candidates
}) {
  const discoveryRunId = buildRunId("discoveryrun");
  const runRef = db.collection(COLLECTIONS.DISCOVERY_RUNS).doc(discoveryRunId);

  await runRef.set({
    discovery_run_id: discoveryRunId,
    social_run_id: runId || null,
    country,
    category,
    theme,
    limit,
    dry_run: dryRun,
    accepted_count: 0,
    trialed_count: candidates.length,
    candidates_created: candidates.length,
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
    status: dryRun ? STATUSES.DRY_RUN : STATUSES.COMPLETED
  });

  const batch = db.batch();

  for (const candidate of candidates) {
    const ref = db
      .collection(COLLECTIONS.SOURCE_DISCOVERY_CANDIDATES)
      .doc(candidate.candidate_id);

    batch.set(ref, {
      ...candidate,
      discovery_run_id: discoveryRunId,
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp()
    });
  }

  await batch.commit();

  return discoveryRunId;
}

async function runSocialScan({ country, category }) {
  const runId = buildRunId("socialrun");
  const startedAt = isoNow();

  const normalizedCountry = normalizeCountry(
    country || env.ZAPTREND_DEFAULT_COUNTRY || DEFAULTS.COUNTRY
  );
  const normalizedCategory = normalizeCategory(
    category || env.ZAPTREND_DEFAULT_CATEGORY || DEFAULTS.CATEGORY
  );

  console.log("[SOCIAL SIGNAL ENGINE] runSocialScan:start", {
    runId,
    country: normalizedCountry,
    category: normalizedCategory
  });

  const sources = getMockSocialSources({
    country: normalizedCountry,
    category: normalizedCategory
  });

  const mentions = extractMentionsFromSources({
    country: normalizedCountry,
    category: normalizedCategory,
    sources
  });

const { ingestSignals } = require("./signalMemoryEngine");

await ingestSignals({
  country: normalizedCountry,
  category: normalizedCategory,
  sourceType: "social_signal", // 🔥 IMPORTANT
  signals: mentions.map((m) => ({
    brand: m.brand,
    product: m.product,
    hashtag: m.hashtag,
    source_weight: 1.2,        // 🔥 stronger than source scan
    engagement: 2,
    freshness_boost: 1.5,
    source_ref: m.discovered_from || "social"
  }))
});

  const signalScoreSummary = buildSignalScoreSummary(mentions);

  const discoveryGuidance = buildDiscoveryGuidance({
    country: normalizedCountry,
    category: normalizedCategory,
    mentions
  });

  const finishedAt = isoNow();

  await persistSocialRun({
    runId,
    country: normalizedCountry,
    category: normalizedCategory,
    startedAt,
    finishedAt,
    sources,
    mentions,
    signalScoreSummary,
    discoveryGuidance
  });

  const result = {
    ok: true,
    message: "Social run completed",
    run_id: runId,
    country: normalizedCountry,
    category: normalizedCategory,
    started_at: startedAt,
    finished_at: finishedAt,
    sources_scanned: sources.length,
    mentions_detected: mentions.length,
    mentions,
    signal_score_summary: signalScoreSummary,
    discovery_guidance: discoveryGuidance
  };

  console.log("[SOCIAL SIGNAL ENGINE] runSocialScan:done", {
    runId,
    sources_scanned: result.sources_scanned,
    mentions_detected: result.mentions_detected
  });

  return result;
}

async function runDiscoveryBoost({
  country,
  category,
  theme,
  limit,
  dryRun
}) {
  const normalizedCountry = normalizeCountry(
    country || env.ZAPTREND_DEFAULT_COUNTRY || DEFAULTS.COUNTRY
  );
  const normalizedCategory = normalizeCategory(
    category || env.ZAPTREND_DEFAULT_CATEGORY || DEFAULTS.CATEGORY
  );
  const normalizedTheme = String(theme || DEFAULTS.THEME).trim();
  const normalizedLimit = Number(limit || env.ZAPTREND_DISCOVERY_LIMIT || 0);

  console.log("[DISCOVERY BOOST] start", {
    country: normalizedCountry,
    category: normalizedCategory,
    limit: normalizedLimit
  });

  // 🔥 REALISTIC curated fallback URLs (replace later with real AI discovery)
  const seedSources = [
    { url: "https://konvy.com/", domain: "konvy.com" },
    { url: "https://looksi.com/", domain: "looksi.com" },
    { url: "https://madamefin.com/", domain: "madamefin.com" },
    { url: "https://peachy.co.th/", domain: "peachy.co.th" },
    { url: "https://sudsapda.com/", domain: "sudsapda.com" },
    { url: "https://vanillamagazine.com/", domain: "vanillamagazine.com" }
  ];

  // 🔥 Load existing AI sources to prevent duplicates
  const aiSnap = await db.collection(COLLECTIONS.AI_SOURCES).get();
  const existingDomains = new Set(
    aiSnap.docs.map(d => (d.data().domain || "").toLowerCase())
  );

  // 🔥 Load candidates to prevent duplicates
  const candidateSnap = await db.collection(COLLECTIONS.SOURCE_DISCOVERY_CANDIDATES).get();
  const existingCandidates = new Set(
    candidateSnap.docs.map(d => (d.data().domain || "").toLowerCase())
  );

  const candidates = [];

  for (const source of seedSources) {
    const url = source.url;
    const domain = source.domain;

    if (!url || !url.startsWith("http")) continue;
    if (!domain) continue;

    // 🔥 Skip duplicates
    if (existingDomains.has(domain)) continue;
    if (existingCandidates.has(domain)) continue;

    candidates.push({
      candidate_id: buildRunId("candidate"),
      country: normalizedCountry,
      category: normalizedCategory,
      theme: normalizedTheme,

      url,
      domain,

      source_type: "curated_seed",

      status: dryRun ? STATUSES.DRY_RUN : STATUSES.CANDIDATE,

      quality_score: 85,
      reputation_score: 10,

      trial_runs_remaining: 3,
      fail_count: 0,
      success_count: 0,

      health_status: "unknown",
      is_active: true,
      auto_disabled: false
    });
  }

  const finalCandidates = candidates.slice(0, normalizedLimit);

  const discoveryRunId = await persistDiscoveryRun({
    runId: null,
    country: normalizedCountry,
    category: normalizedCategory,
    theme: normalizedTheme,
    limit: normalizedLimit,
    dryRun,
    candidates: finalCandidates
  });

  return {
    ok: true,
    message: "Discovery boost completed (clean)",
    discovery_run_id: discoveryRunId,
    candidates_created: finalCandidates.length,
    candidates: finalCandidates
  };
}

module.exports = {
  runSocialScan,
  runDiscoveryBoost
};