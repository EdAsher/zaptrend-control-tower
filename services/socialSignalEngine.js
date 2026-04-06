const { db, FieldValue } = require("../config/firestore");
const { COLLECTIONS, STATUSES, DEFAULTS } = require("../config/constants");
const { env } = require("../config/env");
const { createDiscoveryCandidates } = require("./discoveryEngine");
const { ingestSignals } = require("./signalMemoryEngine");

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

function getCategorySocialSources({ country, category }) {
  const cc = normalizeCountry(country);
  const cat = normalizeCategory(category);

  const sourceMap = {
    snacks_drinks: {
      TH: [
        {
          source_id: `${cc}_${cat}_tiktok_snacks_th_1`,
          platform: "tiktok",
          handle: "@bangkoksnackhunt",
          url: "https://www.tiktok.com/",
          source_weight: 0.95,
          creator_type: "food_reviewer"
        },
        {
          source_id: `${cc}_${cat}_instagram_snacks_th_2`,
          platform: "instagram",
          handle: "@thaifoodfinds",
          url: "https://www.instagram.com/",
          source_weight: 0.9,
          creator_type: "local_reviewer"
        },
        {
          source_id: `${cc}_${cat}_youtube_snacks_th_3`,
          platform: "youtube",
          handle: "@ThaiSnackRadar",
          url: "https://www.youtube.com/",
          source_weight: 0.85,
          creator_type: "trend_reviewer"
        }
      ],
      SG: [
        {
          source_id: `${cc}_${cat}_tiktok_snacks_sg_1`,
          platform: "tiktok",
          handle: "@sgsnackfinds",
          url: "https://www.tiktok.com/",
          source_weight: 0.95,
          creator_type: "food_reviewer"
        },
        {
          source_id: `${cc}_${cat}_instagram_snacks_sg_2`,
          platform: "instagram",
          handle: "@sgmunchradar",
          url: "https://www.instagram.com/",
          source_weight: 0.9,
          creator_type: "local_reviewer"
        },
        {
          source_id: `${cc}_${cat}_youtube_snacks_sg_3`,
          platform: "youtube",
          handle: "@SingaporeSnackWatch",
          url: "https://www.youtube.com/",
          source_weight: 0.85,
          creator_type: "trend_reviewer"
        }
      ]
    },

    souvenirs_local_finds: {
      TH: [
        {
          source_id: `${cc}_${cat}_tiktok_souvenir_th_1`,
          platform: "tiktok",
          handle: "@bangkokgiftfinds",
          url: "https://www.tiktok.com/",
          source_weight: 0.95,
          creator_type: "market_reviewer"
        },
        {
          source_id: `${cc}_${cat}_instagram_souvenir_th_2`,
          platform: "instagram",
          handle: "@chatuchakfinds",
          url: "https://www.instagram.com/",
          source_weight: 0.9,
          creator_type: "local_creator"
        },
        {
          source_id: `${cc}_${cat}_youtube_souvenir_th_3`,
          platform: "youtube",
          handle: "@ThaiSouvenirRadar",
          url: "https://www.youtube.com/",
          source_weight: 0.85,
          creator_type: "shopping_reviewer"
        }
      ]
    },

    fashion_accessories: {
      TH: [
        {
          source_id: `${cc}_${cat}_tiktok_fashion_th_1`,
          platform: "tiktok",
          handle: "@bangkokstylefinds",
          url: "https://www.tiktok.com/",
          source_weight: 0.95,
          creator_type: "fashion_creator"
        },
        {
          source_id: `${cc}_${cat}_instagram_fashion_th_2`,
          platform: "instagram",
          handle: "@thaifashionedit",
          url: "https://www.instagram.com/",
          source_weight: 0.9,
          creator_type: "style_reviewer"
        },
        {
          source_id: `${cc}_${cat}_youtube_fashion_th_3`,
          platform: "youtube",
          handle: "@ThaiAccessoryRadar",
          url: "https://www.youtube.com/",
          source_weight: 0.85,
          creator_type: "trend_reviewer"
        }
      ]
    }
  };

  const byCategory = sourceMap[cat] || {};
  const byCountry = byCategory[cc] || [];

  if (byCountry.length > 0) return byCountry;

  return [
    {
      source_id: `${cc}_${cat}_social_generic_1`,
      platform: "instagram",
      handle: "@localtrendwatch",
      url: "https://www.instagram.com/",
      source_weight: 0.8,
      creator_type: "generic_local_reviewer"
    },
    {
      source_id: `${cc}_${cat}_social_generic_2`,
      platform: "tiktok",
      handle: "@localfindsradar",
      url: "https://www.tiktok.com/",
      source_weight: 0.8,
      creator_type: "generic_local_creator"
    }
  ];
}

function getCategoryMentions({ country, category, sources }) {
  const cc = normalizeCountry(country);
  const cat = normalizeCategory(category);

  const mentionMap = {
    snacks_drinks: {
      TH: [
        {
          brand: "Pocky Thailand",
          product: "Thai Milk Tea Flavor",
          hashtag: "#thaiflavors",
          score: 88,
          signal_type: "limited_flavor"
        },
        {
          brand: "Tao Kae Noi",
          product: "Seaweed Snacks",
          hashtag: "#thaistreetsnack",
          score: 84,
          signal_type: "viral_snack"
        },
        {
          brand: "Ichitan",
          product: "Green Tea Drink",
          hashtag: "#thaidrinks",
          score: 80,
          signal_type: "drink_trend"
        }
      ],
      SG: [
        {
          brand: "Irvins",
          product: "Salted Egg Snacks",
          hashtag: "#sgsnackfinds",
          score: 90,
          signal_type: "iconic_local_snack"
        },
        {
          brand: "TWG",
          product: "Tea Gift Sets",
          hashtag: "#sggiftablefood",
          score: 82,
          signal_type: "giftable_local_find"
        },
        {
          brand: "Old Chang Kee",
          product: "Snack Packs",
          hashtag: "#sgbites",
          score: 78,
          signal_type: "local_favorite"
        }
      ]
    },

    souvenirs_local_finds: {
      TH: [
        {
          brand: "Chatuchak Market",
          product: "Handmade Crafts",
          hashtag: "#bangkoksouvenir",
          score: 90,
          signal_type: "artisan_local_find"
        },
        {
          brand: "Thai Silk",
          product: "Scarves",
          hashtag: "#thailandcraft",
          score: 84,
          signal_type: "giftable_local_find"
        },
        {
          brand: "Benjarong",
          product: "Ceramic Tableware",
          hashtag: "#thaiceramics",
          score: 80,
          signal_type: "rare_cultural_item"
        }
      ]
    },

    fashion_accessories: {
      TH: [
        {
          brand: "Gentlewoman",
          product: "Canvas Tote Bag",
          hashtag: "#bangkokfashion",
          score: 90,
          signal_type: "viral_accessory"
        },
        {
          brand: "Naraya",
          product: "Mini Handbag",
          hashtag: "#thaifashionfinds",
          score: 84,
          signal_type: "giftable_local_find"
        },
        {
          brand: "Chatuchak Fashion",
          product: "Statement Earrings",
          hashtag: "#marketstyle",
          score: 80,
          signal_type: "local_designer_trend"
        }
      ]
    }
  };

  const rawMentions =
    (mentionMap[cat] && mentionMap[cat][cc]) ||
    [
      {
        brand: "Local Trend",
        product: "Featured Item",
        hashtag: "#localfinds",
        score: 70,
        signal_type: "generic_local_signal"
      }
    ];

  return rawMentions.map((item, index) => ({
    mention_id: buildRunId("mention"),
    brand: item.brand,
    product: item.product,
    hashtag: item.hashtag,
    score: Number(item.score || 0),
    country: cc,
    category: cat,
    signal_type: item.signal_type || "brand_product",
    discovered_from: sources[index % Math.max(1, sources.length)]?.source_id || null
  }));
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
  const top = [...mentions].sort((a, b) => b.score - a.score).slice(0, 5);

  return {
    country: normalizeCountry(country),
    category: normalizeCategory(category),
    suggested_candidates: top.map((m, index) => ({
      candidate_rank: index + 1,
      derived_from_brand: m.brand,
      derived_from_product: m.product,
      relevance_score: m.score,
      guidance_reason: `Strong local social signal around ${m.brand} / ${m.product}`
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
    accepted_count: candidates.length,
    trialed_count: candidates.length,
    candidates_created: candidates.length,
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
    status: dryRun ? STATUSES.DRY_RUN : STATUSES.COMPLETED
  });

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

  const sources = getCategorySocialSources({
    country: normalizedCountry,
    category: normalizedCategory
  });

  const mentions = getCategoryMentions({
    country: normalizedCountry,
    category: normalizedCategory,
    sources
  });

  await ingestSignals({
    country: normalizedCountry,
    category: normalizedCategory,
    sourceType: "social_signal",
    signals: mentions.map((m) => ({
      brand: m.brand,
      product: m.product,
      hashtag: m.hashtag,
      source_weight: 1.2,
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
    theme: normalizedTheme,
    limit: normalizedLimit,
    dryRun
  });

  const seedSources = [
    { url: "https://www.beauticool.com" },
    { url: "https://www.karmarts.com" },
    { url: "https://www.eveandboy.com" },
    { url: "https://www.lazada.co.th" },
    { url: "https://shopee.co.th" },
    { url: "https://www.central.co.th" },
    { url: "https://www.robinson.co.th" },
    { url: "https://www.watsons.co.th" },
    { url: "https://www.boots.co.th" },
    { url: "https://www.konvy.com" },
    { url: "https://www.looksi.com" },
    { url: "https://www.siwilai.com" },
    { url: "https://pantip.com" },
    { url: "https://www.jeban.com" },
    { url: "https://www.cosmenet.in.th" },
    { url: "https://www.beautrium.com" },
    { url: "https://www.konvy.com/blog" },
    { url: "https://www.sudsapda.com" },
    { url: "https://www.thairath.co.th/women" },
    { url: "https://www.sanook.com/women" }
  ];

  const discoveryResult = await createDiscoveryCandidates({
    country: normalizedCountry,
    category: normalizedCategory,
    theme: normalizedTheme,
    limit: normalizedLimit,
    candidateSeeds: seedSources
  });

  const discoveryRunId = await persistDiscoveryRun({
    runId: null,
    country: normalizedCountry,
    category: normalizedCategory,
    theme: normalizedTheme,
    limit: normalizedLimit,
    dryRun,
    candidates: discoveryResult.candidates || []
  });

  return {
    ok: true,
    message: "Discovery boost completed",
    discovery_run_id: discoveryRunId,
    country: normalizedCountry,
    category: normalizedCategory,
    theme: normalizedTheme,
    limit: normalizedLimit,
    dry_run: dryRun,
    candidates_created: discoveryResult.candidates_created || 0,
    skipped_count: discoveryResult.skipped_count || 0,
    skipped: discoveryResult.skipped || [],
    candidates: discoveryResult.candidates || []
  };
}

module.exports = {
  runSocialScan,
  runDiscoveryBoost
};