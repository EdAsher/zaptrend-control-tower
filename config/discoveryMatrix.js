"use strict";

const ALL_COUNTRIES = [
  "HK",
  "TH",
  "SG",
  "VN",
  "KH",
  "CN",
  "TW",
  "KR",
  "JP",
  "AU",
  "ID",
  "IN",
  "MM",
  "MY",
  "PH"
];

const ALL_CATEGORIES = [
  "baby_kids",
  "beauty_skincare",
  "deals_duty_free",
  "electronics_gadgets",
  "fashion_accessories",
  "health_pharmacy",
  "home_living",
  "luxury_designer",
  "other",
  "snacks_drinks",
  "souvenirs_local_finds",
  "sports_outdoors",
  "stationery_books",
  "toys_collectibles"
];

const CATEGORY_QUERY_MAP = {
  baby_kids: ["baby finds", "kids products", "mum review", "parenting picks"],
  beauty_skincare: ["beauty review", "skincare review", "makeup review", "cosmetics review"],
  deals_duty_free: ["duty free finds", "airport shopping", "travel deals", "deal finds"],
  electronics_gadgets: ["gadget review", "tech review", "electronics picks", "must buy gadgets"],
  fashion_accessories: ["fashion review", "bag review", "accessories review", "style picks"],
  health_pharmacy: ["pharmacy finds", "supplement review", "health products", "must buy health"],
  home_living: ["home finds", "living products", "kitchen review", "household picks"],
  luxury_designer: ["luxury review", "designer picks", "boutique finds", "premium fashion"],
  other: ["local finds", "must buy", "viral finds", "review"],
  snacks_drinks: ["snack review", "drink review", "must buy snacks", "food finds"],
  souvenirs_local_finds: ["souvenir review", "local finds", "must buy local", "gift finds"],
  sports_outdoors: ["sports gear review", "outdoor gear", "fitness finds", "sports products"],
  stationery_books: ["stationery review", "book finds", "planner review", "desk finds"],
  toys_collectibles: ["toy review", "collectible review", "figure review", "kids toy finds"]
};

const COUNTRY_LANGUAGE_HINTS = {
  HK: ["zh", "en"],
  TH: ["th", "en"],
  SG: ["en", "zh", "ms"],
  VN: ["vi"],
  KH: ["km"],
  CN: ["zh"],
  TW: ["zh"],
  KR: ["kr"],
  JP: ["jp"],
  AU: ["en"],
  ID: ["id"],
  IN: ["en", "hi", "ta"],
  MM: ["my"],
  MY: ["ms", "en", "zh", "ta"],
  PH: ["en", "tl"],
};

const COUNTRY_LOCAL_TERMS = {
  HK: ["hong kong", "hk", "香港"],
  TH: ["thailand", "thai", "th", "ไทย"],
  SG: ["singapore", "sg"],
  VN: ["vietnam", "vn", "việt"],
  KH: ["cambodia", "kh", "khmer"],
  CN: ["china", "cn", "中国"],
  TW: ["taiwan", "tw", "台灣", "台湾"],
  KR: ["korea", "kr", "한국"],
  JP: ["japan", "jp", "日本"],
  AU: ["australia", "au"],
  ID: ["indonesia", "id"],
  IN: ["india", "in", "भारत"],
  MM: ["myanmar", "mm", "burma"],
  MY: ["malaysia", "my"],
  PH: ["philippines", "ph", "pinoy", "filipino"]
};

const DEFAULT_PLATFORM_PRIORITY = [
  "instagram",
  "tiktok",
  "youtube",
  "facebook",
  "lemon8",
  "blog"
];

const PLATFORM_PRIORITY_BY_COUNTRY = {
  TH: ["instagram", "tiktok", "facebook", "youtube", "lemon8", "blog"],
  SG: ["instagram", "tiktok", "youtube", "facebook", "lemon8", "blog"],
  JP: ["instagram", "youtube", "tiktok", "blog", "facebook", "lemon8"],
  KR: ["instagram", "youtube", "tiktok", "blog", "facebook", "lemon8"],
  PH: ["facebook", "instagram", "tiktok", "youtube", "blog", "lemon8"],
};

function safeId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function buildDiscoveryQueries(country, category) {
  const c = String(country || "").toUpperCase();
  const k = String(category || "").toLowerCase();

  const categoryQueries = CATEGORY_QUERY_MAP[k] || CATEGORY_QUERY_MAP.other;
  const localTerms = COUNTRY_LOCAL_TERMS[c] || [c.toLowerCase()];

  const queries = [];
  for (const localTerm of localTerms.slice(0, 3)) {
    for (const base of categoryQueries.slice(0, 4)) {
      queries.push(`${localTerm} ${base}`);
    }
  }

  return Array.from(new Set(queries)).slice(0, 12);
}

function buildSeedSources(country, category) {
  const c = String(country || "").toUpperCase();
  const k = String(category || "").toLowerCase();

  const platforms = PLATFORM_PRIORITY_BY_COUNTRY[c] || DEFAULT_PLATFORM_PRIORITY;
  const localTerms = COUNTRY_LOCAL_TERMS[c] || [c.toLowerCase()];

  const seeds = platforms.slice(0, 4).map((platform, idx) => {
    const localWord = safeId(localTerms[0] || c);
    const handle = `${localWord}_${safeId(k)}_${platform}_${idx + 1}`;

    return {
      source_id: `${safeId(c)}_${safeId(k)}_${platform}_${idx + 1}`,
      display_name: `${c} ${k} ${platform} reviewer ${idx + 1}`,
      handle: platform === "blog" ? handle : `@${handle}`,
      platform,
      url:
        platform === "instagram"
          ? `https://www.instagram.com/${handle}`
          : platform === "tiktok"
          ? `https://www.tiktok.com/@${handle}`
          : platform === "youtube"
          ? `https://www.youtube.com/@${handle}`
          : platform === "facebook"
          ? `https://www.facebook.com/${handle}`
          : platform === "lemon8"
          ? `https://www.lemon8-app.com/${handle}`
          : `https://example.com/${handle}`
    };
  });

  return seeds;
}

function getDiscoveryConfig(country, category) {
  const c = String(country || "").toUpperCase();
  const k = String(category || "").toLowerCase();

  return {
    country: c,
    category: k,
    language_hints: COUNTRY_LANGUAGE_HINTS[c] || ["en"],
    local_terms: COUNTRY_LOCAL_TERMS[c] || [c.toLowerCase()],
    platform_priority: PLATFORM_PRIORITY_BY_COUNTRY[c] || DEFAULT_PLATFORM_PRIORITY,
    discovery_queries: buildDiscoveryQueries(c, k),
    seed_sources: buildSeedSources(c, k)
  };
}

module.exports = {
  ALL_COUNTRIES,
  ALL_CATEGORIES,
  CATEGORY_QUERY_MAP,
  COUNTRY_LANGUAGE_HINTS,
  COUNTRY_LOCAL_TERMS,
  DEFAULT_PLATFORM_PRIORITY,
  PLATFORM_PRIORITY_BY_COUNTRY,
  buildDiscoveryQueries,
  buildSeedSources,
  getDiscoveryConfig
};