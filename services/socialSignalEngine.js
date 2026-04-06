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

function getCountryLanguageProfile(country) {
  const cc = normalizeCountry(country);

  const map = {
    TH: {
      primary_language: "th",
      allowed_languages: ["th", "en"],
      local_audience_note:
        "Prioritize Thai-language creators, Thai comments, Thai captions, and Thai-native reviewers. English-only foreign reviewers should not dominate the trend signal.",
      reviewer_constraint:
        "Prefer Thai local creators reviewing Thai local items for Thai audiences."
    },
    SG: {
      primary_language: "en",
      allowed_languages: ["en", "zh", "ms"],
      local_audience_note:
        "Prioritize Singapore-local reviewers, Singapore food/media accounts, and posts relevant to Singapore shoppers.",
      reviewer_constraint:
        "Prefer Singapore-local creators and local shopper/reviewer behavior."
    },
    MY: {
      primary_language: "ms",
      allowed_languages: ["ms", "en", "zh"],
      local_audience_note:
        "Prioritize Malaysia-local reviewers, Malay or locally used languages, and local shopper behavior.",
      reviewer_constraint:
        "Prefer Malaysia-local creators reviewing items relevant to Malaysia audiences."
    },
    JP: {
      primary_language: "ja",
      allowed_languages: ["ja", "en"],
      local_audience_note:
        "Prioritize Japanese-language creators and Japan-local reviews.",
      reviewer_constraint:
        "Prefer Japan-local creators speaking to Japan audiences."
    },
    KR: {
      primary_language: "ko",
      allowed_languages: ["ko", "en"],
      local_audience_note:
        "Prioritize Korean-language creators and Korea-local reviews.",
      reviewer_constraint:
        "Prefer Korea-local creators speaking to Korea audiences."
    },
    VN: {
      primary_language: "vi",
      allowed_languages: ["vi", "en"],
      local_audience_note:
        "Prioritize Vietnamese-language creators and Vietnam-local reviews.",
      reviewer_constraint:
        "Prefer Vietnam-local creators speaking to Vietnam audiences."
    }
  };

  return (
    map[cc] || {
      primary_language: "en",
      allowed_languages: ["en"],
      local_audience_note:
        "Prioritize local reviewers from the target country.",
      reviewer_constraint:
        "Prefer country-local creators over foreign/global reviewers."
    }
  );
}

function buildLocalSocialPrompt({ country, category, sources, languageProfile }) {
  const sourceLines = sources
    .map(
      (s, i) =>
        `${i + 1}. ${s.platform} ${s.handle} | language=${s.source_language} | audience=${s.audience_locale} | creator_type=${s.creator_type} | local_confidence=${s.local_confidence}`
    )
    .join("\n");

  return `
You are evaluating LOCAL social signals for marketplace trend discovery.

Country: ${country}
Category: ${category}

Primary language: ${languageProfile.primary_language}
Allowed languages: ${languageProfile.allowed_languages.join(", ")}

Important rules:
- ${languageProfile.local_audience_note}
- ${languageProfile.reviewer_constraint}
- Prioritize local-language reviews, local comments, local captions, and local buying behavior.
- Do NOT over-weight foreign reviewers discussing the market from outside the country.
- Prefer signals about:
  - locally made items
  - exclusive finds
  - limited-edition local products
  - giftable items
  - traveler-buyable / bring-back-able goods
  - local review buzz

Candidate social source examples:
${sourceLines}
`.trim();
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
          handle: "@กินไรดีกรุงเทพ",
          url: "https://www.tiktok.com/",
          source_weight: 0.95,
          creator_type: "food_reviewer",
          source_language: "th",
          audience_locale: "th-TH",
          local_confidence: 0.98
        },
        {
          source_id: `${cc}_${cat}_instagram_snacks_th_2`,
          platform: "instagram",
          handle: "@ขนมไทยรีวิว",
          url: "https://www.instagram.com/",
          source_weight: 0.9,
          creator_type: "local_reviewer",
          source_language: "th",
          audience_locale: "th-TH",
          local_confidence: 0.96
        },
        {
          source_id: `${cc}_${cat}_youtube_snacks_th_3`,
          platform: "youtube",
          handle: "@ThaiSnackRadar",
          url: "https://www.youtube.com/",
          source_weight: 0.85,
          creator_type: "trend_reviewer",
          source_language: "th",
          audience_locale: "th-TH",
          local_confidence: 0.92
        }
      ],
      SG: [
        {
          source_id: `${cc}_${cat}_tiktok_snacks_sg_1`,
          platform: "tiktok",
          handle: "@sgsnackfinds",
          url: "https://www.tiktok.com/",
          source_weight: 0.95,
          creator_type: "food_reviewer",
          source_language: "en",
          audience_locale: "en-SG",
          local_confidence: 0.95
        },
        {
          source_id: `${cc}_${cat}_instagram_snacks_sg_2`,
          platform: "instagram",
          handle: "@sgmunchradar",
          url: "https://www.instagram.com/",
          source_weight: 0.9,
          creator_type: "local_reviewer",
          source_language: "en",
          audience_locale: "en-SG",
          local_confidence: 0.94
        },
        {
          source_id: `${cc}_${cat}_youtube_snacks_sg_3`,
          platform: "youtube",
          handle: "@SingaporeSnackWatch",
          url: "https://www.youtube.com/",
          source_weight: 0.85,
          creator_type: "trend_reviewer",
          source_language: "en",
          audience_locale: "en-SG",
          local_confidence: 0.9
        }
      ]
    },

    souvenirs_local_finds: {
      TH: [
        {
          source_id: `${cc}_${cat}_tiktok_souvenir_th_1`,
          platform: "tiktok",
          handle: "@ของฝากกรุงเทพ",
          url: "https://www.tiktok.com/",
          source_weight: 0.95,
          creator_type: "market_reviewer",
          source_language: "th",
          audience_locale: "th-TH",
          local_confidence: 0.98
        },
        {
          source_id: `${cc}_${cat}_instagram_souvenir_th_2`,
          platform: "instagram",
          handle: "@ของฝากไทยน่าซื้อ",
          url: "https://www.instagram.com/",
          source_weight: 0.9,
          creator_type: "local_creator",
          source_language: "th",
          audience_locale: "th-TH",
          local_confidence: 0.96
        },
        {
          source_id: `${cc}_${cat}_youtube_souvenir_th_3`,
          platform: "youtube",
          handle: "@ThaiSouvenirRadar",
          url: "https://www.youtube.com/",
          source_weight: 0.85,
          creator_type: "shopping_reviewer",
          source_language: "th",
          audience_locale: "th-TH",
          local_confidence: 0.92
        }
      ]
    },

    fashion_accessories: {
      TH: [
        {
          source_id: `${cc}_${cat}_tiktok_fashion_th_1`,
          platform: "tiktok",
          handle: "@แฟชั่นกรุงเทพรีวิว",
          url: "https://www.tiktok.com/",
          source_weight: 0.95,
          creator_type: "fashion_creator",
          source_language: "th",
          audience_locale: "th-TH",
          local_confidence: 0.97
        },
        {
          source_id: `${cc}_${cat}_instagram_fashion_th_2`,
          platform: "instagram",
          handle: "@thaifashionedit",
          url: "https://www.instagram.com/",
          source_weight: 0.9,
          creator_type: "style_reviewer",
          source_language: "th",
          audience_locale: "th-TH",
          local_confidence: 0.94
        },
        {
          source_id: `${cc}_${cat}_youtube_fashion_th_3`,
          platform: "youtube",
          handle: "@ThaiAccessoryRadar",
          url: "https://www.youtube.com/",
          source_weight: 0.85,
          creator_type: "trend_reviewer",
          source_language: "th",
          audience_locale: "th-TH",
          local_confidence: 0.9
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
      creator_type: "generic_local_reviewer",
      source_language: getCountryLanguageProfile(cc).primary_language,
      audience_locale: cc,
      local_confidence: 0.8
    },
    {
      source_id: `${cc}_${cat}_social_generic_2`,
      platform: "tiktok",
      handle: "@localfindsradar",
      url: "https://www.tiktok.com/",
      source_weight: 0.8,
      creator_type: "generic_local_creator",
      source_language: getCountryLanguageProfile(cc).primary_language,
      audience_locale: cc,
      local_confidence: 0.8
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
          signal_type: "limited_flavor",
          review_language: "th",
          local_evidence:
            "รีวิวโดยคนไทยพูดถึงรสชาติไทยนมชาและความน่าซื้อกลับ",
          travel_buyable: true,
          local_confidence: 0.96
        },
        {
          brand: "Tao Kae Noi",
          product: "Seaweed Snacks",
          hashtag: "#thaistreetsnack",
          score: 84,
          signal_type: "viral_snack",
          review_language: "th",
          local_evidence:
            "คอนเทนต์ไทยรีวิวขนมพกง่าย ซื้อฝากได้",
          travel_buyable: true,
          local_confidence: 0.94
        },
        {
          brand: "Ichitan",
          product: "Green Tea Drink",
          hashtag: "#thaidrinks",
          score: 80,
          signal_type: "drink_trend",
          review_language: "th",
          local_evidence:
            "รีวิวภาษาไทยจากผู้บริโภคไทยในตลาดท้องถิ่น",
          travel_buyable: true,
          local_confidence: 0.92
        }
      ],
      SG: [
        {
          brand: "Irvins",
          product: "Salted Egg Snacks",
          hashtag: "#sgsnackfinds",
          score: 90,
          signal_type: "iconic_local_snack",
          review_language: "en",
          local_evidence:
            "Singapore-local reviewers discussing giftable salted egg snacks",
          travel_buyable: true,
          local_confidence: 0.96
        },
        {
          brand: "TWG",
          product: "Tea Gift Sets",
          hashtag: "#sggiftablefood",
          score: 82,
          signal_type: "giftable_local_find",
          review_language: "en",
          local_evidence:
            "Singapore reviewers highlighting premium tea sets as bring-back gifts",
          travel_buyable: true,
          local_confidence: 0.93
        },
        {
          brand: "Old Chang Kee",
          product: "Snack Packs",
          hashtag: "#sgbites",
          score: 78,
          signal_type: "local_favorite",
          review_language: "en",
          local_evidence:
            "Singapore local snack reviewers mentioning easy-to-share snack packs",
          travel_buyable: true,
          local_confidence: 0.9
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
          signal_type: "artisan_local_find",
          review_language: "th",
          local_evidence:
            "ผู้รีวิวไทยพูดถึงงานคราฟต์ทำมือที่หาซื้อได้เฉพาะในตลาดท้องถิ่น",
          travel_buyable: true,
          local_confidence: 0.97
        },
        {
          brand: "Thai Silk",
          product: "Scarves",
          hashtag: "#thailandcraft",
          score: 84,
          signal_type: "giftable_local_find",
          review_language: "th",
          local_evidence:
            "คอนเทนต์ไทยเน้นผ้าไหมเป็นของฝากที่มีเอกลักษณ์",
          travel_buyable: true,
          local_confidence: 0.94
        },
        {
          brand: "Benjarong",
          product: "Ceramic Tableware",
          hashtag: "#thaiceramics",
          score: 80,
          signal_type: "rare_cultural_item",
          review_language: "th",
          local_evidence:
            "รีวิวไทยเน้นความเป็นงานฝีมือและเอกลักษณ์วัฒนธรรม",
          travel_buyable: true,
          local_confidence: 0.92
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
          signal_type: "viral_accessory",
          review_language: "th",
          local_evidence:
            "ครีเอเตอร์ไทยพูดถึงกระเป๋ายอดฮิตที่หาซื้อในไทย",
          travel_buyable: true,
          local_confidence: 0.97
        },
        {
          brand: "Naraya",
          product: "Mini Handbag",
          hashtag: "#thaifashionfinds",
          score: 84,
          signal_type: "giftable_local_find",
          review_language: "th",
          local_evidence:
            "รีวิวไทยชี้ว่าเหมาะสำหรับซื้อฝากและพกกลับ",
          travel_buyable: true,
          local_confidence: 0.94
        },
        {
          brand: "Chatuchak Fashion",
          product: "Statement Earrings",
          hashtag: "#marketstyle",
          score: 80,
          signal_type: "local_designer_trend",
          review_language: "th",
          local_evidence:
            "รีวิวไทยจากตลาดท้องถิ่นเกี่ยวกับดีไซน์เนอร์และงานแฮนด์เมด",
          travel_buyable: true,
          local_confidence: 0.92
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
        signal_type: "generic_local_signal",
        review_language: getCountryLanguageProfile(cc).primary_language,
        local_evidence: "Local-language mention from local creators",
        travel_buyable: true,
        local_confidence: 0.8
      }
    ];

  return rawMentions.map((item, index) => {
    const source = sources[index % Math.max(1, sources.length)] || {};
    return {
      mention_id: buildRunId("mention"),
      brand: item.brand,
      product: item.product,
      hashtag: item.hashtag,
      score: Number(item.score || 0),
      country: cc,
      category: cat,
      signal_type: item.signal_type || "brand_product",
      discovered_from: source.source_id || null,
      review_language: item.review_language || getCountryLanguageProfile(cc).primary_language,
      local_evidence: item.local_evidence || "",
      travel_buyable: item.travel_buyable !== false,
      local_confidence: Number(item.local_confidence || source.local_confidence || 0.8),
      audience_locale: source.audience_locale || cc,
      creator_type: source.creator_type || "local_reviewer"
    };
  });
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
      review_language: m.review_language || "",
      travel_buyable: m.travel_buyable !== false,
      local_confidence: Number(m.local_confidence || 0),
      guidance_reason: `Strong local social signal around ${m.brand} / ${m.product}`
    }))
  };
}

function getDiscoverySeedSources({ country, category }) {
  const cc = normalizeCountry(country);
  const cat = normalizeCategory(category);

  const seedMap = {
    snacks_drinks: {
      TH: [
        { url: "https://www.foodpanda.co.th" },
        { url: "https://www.makro.co.th" },
        { url: "https://www.tops.co.th" },
        { url: "https://www.bangkokfoodies.com" },
        { url: "https://www.khaosod.co.th/lifestyle" },
        { url: "https://www.foodie.co.th" }
      ],
      SG: [
        { url: "https://www.redmart.com" },
        { url: "https://www.foodpanda.sg" },
        { url: "https://www.sgfoodonfoot.com" },
        { url: "https://www.thehalalfoodblog.com" },
        { url: "https://www.scoopsg.com" },
        { url: "https://www.snackfirst.com.sg" }
      ]
    },

    souvenirs_local_finds: {
      TH: [
        { url: "https://www.bangkok.com/shopping/souvenirs.htm" },
        { url: "https://www.thaihandicrafts.org" },
        { url: "https://www.thaicraft.com" },
        { url: "https://www.thailandgift.com" },
        { url: "https://www.thailandunique.com" },
        { url: "https://www.bangkokshopping.com" }
      ]
    },

    fashion_accessories: {
      TH: [
        { url: "https://www.zalora.co.th" },
        { url: "https://www.uniqlo.com/th" },
        { url: "https://www.mango.com/th" },
        { url: "https://www.nike.com/th" },
        { url: "https://www.thaihandmade.com" },
        { url: "https://www.bangkokpost.com/life/fashion" }
      ]
    }
  };

  return (seedMap[cat] && seedMap[cat][cc]) || [];
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
  discoveryGuidance,
  socialPromptGuidance
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
    social_prompt_guidance: socialPromptGuidance,
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

  const languageProfile = getCountryLanguageProfile(normalizedCountry);

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
      source_ref: m.discovered_from || "social",
      review_language: m.review_language || "",
      local_evidence: m.local_evidence || "",
      travel_buyable: m.travel_buyable !== false,
      local_confidence: Number(m.local_confidence || 0),
      audience_locale: m.audience_locale || normalizedCountry,
      creator_type: m.creator_type || "local_reviewer"
    }))
  });

  const signalScoreSummary = buildSignalScoreSummary(mentions);

  const discoveryGuidance = buildDiscoveryGuidance({
    country: normalizedCountry,
    category: normalizedCategory,
    mentions
  });

  const socialPromptGuidance = buildLocalSocialPrompt({
    country: normalizedCountry,
    category: normalizedCategory,
    sources,
    languageProfile
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
    discoveryGuidance,
    socialPromptGuidance
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
    discovery_guidance: discoveryGuidance,
    language_profile: languageProfile,
    social_prompt_guidance: socialPromptGuidance
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

  const seedSources = getDiscoverySeedSources({
    country: normalizedCountry,
    category: normalizedCategory
  });

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
    candidates: discoveryResult.candidates || [],
    seed_sources_used: seedSources.map((x) => x.url)
  };
}

module.exports = {
  runSocialScan,
  runDiscoveryBoost
};