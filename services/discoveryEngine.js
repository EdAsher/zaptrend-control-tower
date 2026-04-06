const { db, FieldValue } = require("../config/firestore");
const { COLLECTIONS, STATUSES, DEFAULTS } = require("../config/constants");
const { env } = require("../config/env");
const { openai } = require("../config/openai");

function buildId(prefix = "candidate") {
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

function normalizeDomain(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeUrl(value) {
  return String(value || "").trim();
}

function normalizeLanguage(value) {
  return String(value || "").trim().toLowerCase();
}

function isValidHttpUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function extractDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function stripMarkdownCodeFence(text) {
  const raw = String(text || "").trim();

  if (raw.startsWith("```")) {
    return raw
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/i, "")
      .trim();
  }

  return raw;
}

function safeParseJsonArray(text) {
  try {
    const cleaned = stripMarkdownCodeFence(text);
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function countSkipReasons(items = []) {
  return items.reduce((acc, item) => {
    const key = String(item.reason || "unknown");
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function getCountryLanguageConfig(country) {
  const cc = normalizeCountry(country);

  const map = {
    TH: {
      primary_language: "th",
      secondary_language: "en",
      language_instruction:
        "Generate a mix of Thai-language and English-language sources. Prioritize Thailand-local websites, Thai media, Thai ecommerce, Thai communities, Thai beauty publishers, and Thailand-relevant editorial sources."
    },
    JP: {
      primary_language: "ja",
      secondary_language: "en",
      language_instruction:
        "Generate a mix of Japanese-language and English-language sources. Prioritize Japan-local websites and category-relevant Japanese publishers."
    },
    KR: {
      primary_language: "ko",
      secondary_language: "en",
      language_instruction:
        "Generate a mix of Korean-language and English-language sources. Prioritize Korea-local websites and category-relevant Korean publishers."
    },
    TW: {
      primary_language: "zh-Hant",
      secondary_language: "en",
      language_instruction:
        "Generate a mix of Traditional Chinese and English-language sources. Prioritize Taiwan-local websites and category-relevant publishers."
    },
    HK: {
      primary_language: "zh-Hant",
      secondary_language: "en",
      language_instruction:
        "Generate a mix of Traditional Chinese and English-language sources. Prioritize Hong Kong-local websites and category-relevant publishers."
    },
    VN: {
      primary_language: "vi",
      secondary_language: "en",
      language_instruction:
        "Generate a mix of Vietnamese-language and English-language sources. Prioritize Vietnam-local websites and category-relevant publishers."
    }
  };

  return (
    map[cc] || {
      primary_language: "en",
      secondary_language: "en",
      language_instruction:
        "Generate category-relevant local and regional websites, preferring country-relevant sources."
    }
  );
}

function getCategoryPromptBlock(category) {
  const cat = normalizeCategory(category);

  const map = {
    beauty_skincare: `
Focus on:
- beauty ecommerce
- skincare blogs
- beauty media/editorial
- cosmetics review communities
- women’s lifestyle publishers
- local beauty retailers
Avoid:
- generic unrelated marketplaces
- low-trust coupon pages
- unrelated corporate sites
`,
    snacks_drinks: `
Focus on:
- snack and beverage ecommerce
- food review blogs
- local supermarket / grocery ecommerce
- local food/lifestyle media
- niche local snack communities
Avoid:
- unrelated general shopping pages
- restaurant-only pages without retail/discovery value
`,
    souvenirs_local_finds: `
Focus on:
- local gift shops
- souvenir retailers
- tourism shopping guides
- local artisan / handmade marketplaces
- local lifestyle or travel publishers highlighting unique products
Avoid:
- unrelated travel booking sites
- general news sites without shopping relevance
`,
    fashion_accessories: `
Focus on:
- local fashion ecommerce
- accessories retailers
- fashion/lifestyle editorial
- trend and shopping blogs
- niche local brand discovery sites
Avoid:
- unrelated department store sections with weak category depth
`
  };

  return (
    map[cat] ||
    `
Focus on:
- category-relevant ecommerce
- editorial/media
- community/review sources
- local or regional niche sites
Avoid:
- irrelevant broad domains
- low-trust or off-category pages
`
  );
}

function isSuspiciousDomain(domain = "") {
  const d = normalizeDomain(domain);

  const badKeywords = [
    "marry",
    "wedding",
    "clinic",
    "hospital",
    "crypto",
    "bet",
    "casino",
    "loan",
    "finance",
    "adult",
    "24h",
    "lover",
    "wonderful",
    "fashion-girl",
    "beauty24h",
    "topbeauty"
  ];

  return badKeywords.some((k) => d.includes(k));
}

function getTrustedDomainBoost(domain = "", country = "", category = "") {
  const d = normalizeDomain(domain);
  const cc = normalizeCountry(country);
  const cat = normalizeCategory(category);

  if (cc === "TH" && cat === "beauty_skincare") {
    const trusted = [
      "ellethailand.com",
      "bangkokpost.com",
      "kapook.com",
      "thairath.co.th",
      "sudsapda.com",
      "gqthailand.com",
      "beautybuffet.com",
      "sephora.co.th",
      "eveandboy.com",
      "boots.co.th",
      "watsons.co.th",
      "shopee.co.th",
      "lazada.co.th",
      "konvy.com",
      "looksi.com",
      "beautrium.com",
      "cosmenet.in.th",
      "jeban.com",
      "pantip.com"
    ];

    return trusted.includes(d) ? 10 : 0;
  }

  return 0;
}

function getCountryRelevanceScore(domain = "", country = "", language = "") {
  const d = normalizeDomain(domain);
  const cc = normalizeCountry(country);
  const lang = normalizeLanguage(language);

  let score = 50;

  if (cc === "TH") {
    if (d.endsWith(".co.th") || d.endsWith(".in.th") || d.includes("thai") || d.includes("bangkok")) {
      score += 25;
    }
    if (lang === "th") {
      score += 10;
    }
  }

  return Math.max(0, Math.min(100, score));
}

async function loadExistingDomainState() {
  const [aiSnap, candidateSnap] = await Promise.all([
    db.collection(COLLECTIONS.AI_SOURCES).get(),
    db.collection(COLLECTIONS.SOURCE_DISCOVERY_CANDIDATES).get()
  ]);

  const existingAiDomains = new Set();
  const existingCandidateDomains = new Set();
  const blockedDomains = new Set();

  aiSnap.docs.forEach((doc) => {
    const data = doc.data() || {};
    const domain = normalizeDomain(data.domain || "");
    if (!domain) return;

    existingAiDomains.add(domain);

    const healthStatus = String(data.health_status || "").toLowerCase();
    const autoDisabled = data.auto_disabled === true;
    const isActive = data.is_active !== false;

    if (
      healthStatus === "dead" ||
      healthStatus === "disabled" ||
      autoDisabled ||
      !isActive
    ) {
      blockedDomains.add(domain);
    }
  });

  candidateSnap.docs.forEach((doc) => {
    const data = doc.data() || {};
    const domain = normalizeDomain(data.domain || "");
    if (!domain) return;

    existingCandidateDomains.add(domain);

    const healthStatus = String(data.health_status || "").toLowerCase();
    const autoDisabled = data.auto_disabled === true;

    if (
      healthStatus === "dead" ||
      healthStatus === "disabled" ||
      autoDisabled
    ) {
      blockedDomains.add(domain);
    }
  });

  return {
    existingAiDomains,
    existingCandidateDomains,
    blockedDomains
  };
}

function buildCandidateDoc({
  country,
  category,
  theme,
  url,
  domain,
  sourceType = "ai_generated",
  qualityScore = 80,
  reputationScore = 10,
  localityScore = 70,
  categoryFitScore = 70,
  language = "en",
  reason = ""
}) {
  return {
    candidate_id: buildId("candidate"),
    country,
    category,
    theme,
    url,
    domain,
    source_type: sourceType,
    status: STATUSES.CANDIDATE,

    quality_score: qualityScore,
    reputation_score: reputationScore,
    locality_score: localityScore,
    category_fit_score: categoryFitScore,

    language,
    discovery_reason: reason,

    trial_runs_remaining: 3,
    fail_count: 0,
    success_count: 0,
    health_status: "unknown",
    health_reason: "",
    is_active: true,
    auto_disabled: false,

    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp()
  };
}

async function generateAiCandidates({
  country,
  category,
  theme,
  limit
}) {
  if (!openai) {
    return {
      aiCandidates: [],
      rawAiText: "",
      promptUsed: ""
    };
  }

  const languageConfig = getCountryLanguageConfig(country);
  const categoryBlock = getCategoryPromptBlock(category);

  const prompt = `
You are an expert source discovery engine for local ecommerce, editorial, community, and marketplace websites.

Task:
Generate ${limit * 3} REAL website candidates for:
Country: ${country}
Category: ${category}
Theme: ${theme}

Language strategy:
Primary language: ${languageConfig.primary_language}
Secondary language: ${languageConfig.secondary_language}
${languageConfig.language_instruction}

Category strategy:
${categoryBlock}

Rules:
- Must be REAL websites
- Must be relevant to the category
- Prefer local or country-relevant websites
- Include a healthy mix of:
  - ecommerce
  - editorial/media
  - community/forum/review
  - niche specialty sites
- Return only valid http/https URLs
- Prefer domains/pages with strong local relevance
- Avoid duplicates if possible
- Avoid random unrelated corporate sites
- Avoid obvious junk, parked, or dead sites
- If broad domain, return category-relevant path when possible

Return JSON ONLY in this exact format:
[
  {
    "url": "https://example.com",
    "source_type": "editorial",
    "quality_score": 82,
    "reputation_score": 12,
    "locality_score": 88,
    "category_fit_score": 90,
    "language": "th",
    "reason": "Thai beauty editorial site with strong local skincare coverage"
  }
]

Allowed source_type values:
- ecommerce
- editorial
- community
- marketplace
- niche_blog
- local_media
`;

  let rawAiText = "";
  let aiCandidates = [];

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.4,
      messages: [{ role: "user", content: prompt }]
    });

    rawAiText = response.choices?.[0]?.message?.content || "[]";
    aiCandidates = safeParseJsonArray(rawAiText);
  } catch (err) {
    console.warn("AI discovery failed:", err.message);
  }

  return {
    aiCandidates,
    rawAiText,
    promptUsed: prompt
  };
}

async function verifyBorderlineCandidate({
  country,
  category,
  domain,
  url,
  sourceType,
  language,
  reason
}) {
  if (!openai) {
    return {
      accept: true,
      verifier_score: 50,
      verifier_reason: "openai_unavailable"
    };
  }

  try {
    const prompt = `
You are a strict source quality verifier.

Evaluate whether this website is a GOOD candidate source for:
Country: ${country}
Category: ${category}

Candidate:
- Domain: ${domain}
- URL: ${url}
- Source Type: ${sourceType}
- Language: ${language}
- Claimed Reason: ${reason}

Return JSON ONLY:
{
  "accept": true,
  "verifier_score": 0,
  "verifier_reason": "short reason"
}

Rules:
- Reject generic, suspicious, irrelevant, low-trust, or weakly local domains
- Prefer country-relevant and category-relevant websites
- Be conservative
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [{ role: "user", content: prompt }]
    });

    const raw = response.choices?.[0]?.message?.content || "{}";
    const cleaned = stripMarkdownCodeFence(raw);
    const parsed = JSON.parse(cleaned);

    return {
      accept: Boolean(parsed.accept),
      verifier_score: Number(parsed.verifier_score || 0),
      verifier_reason: String(parsed.verifier_reason || "")
    };
  } catch (err) {
    return {
      accept: false,
      verifier_score: 0,
      verifier_reason: `verifier_failed:${err.message}`
    };
  }
}

async function createDiscoveryCandidates({
  country,
  category,
  theme = DEFAULTS.THEME,
  limit = 5,
  candidateSeeds = []
}) {
  const normalizedCountry = normalizeCountry(
    country || env.ZAPTREND_DEFAULT_COUNTRY || DEFAULTS.COUNTRY
  );

  const normalizedCategory = normalizeCategory(
    category || env.ZAPTREND_DEFAULT_CATEGORY || DEFAULTS.CATEGORY
  );

  const normalizedTheme = String(theme || DEFAULTS.THEME).trim();
  const normalizedLimit = Number(limit || env.ZAPTREND_DISCOVERY_LIMIT || 5);

  const {
    existingAiDomains,
    existingCandidateDomains,
    blockedDomains
  } = await loadExistingDomainState();

  const {
    aiCandidates,
    rawAiText,
    promptUsed
  } = await generateAiCandidates({
    country: normalizedCountry,
    category: normalizedCategory,
    theme: normalizedTheme,
    limit: normalizedLimit
  });

  const allSeeds = [...aiCandidates, ...candidateSeeds];

  const accepted = [];
  const skipped = [];

  for (const seed of allSeeds) {
    const url = normalizeUrl(seed.url || "");
    const domain = normalizeDomain(seed.domain || extractDomain(url));
    const sourceType = String(seed.source_type || "ai_generated").trim();
    const language = normalizeLanguage(seed.language || "en");
    const reason = String(seed.reason || "").trim();

    let qualityScore = Number(seed.quality_score || 80);
    let reputationScore = Number(seed.reputation_score || 10);
    let localityScore = Number(seed.locality_score || 70);
    let categoryFitScore = Number(seed.category_fit_score || 70);

    if (!url || !isValidHttpUrl(url)) {
      skipped.push({ url, domain, reason: "invalid_url" });
      continue;
    }

    if (!domain) {
      skipped.push({ url, domain, reason: "invalid_domain" });
      continue;
    }

    if (blockedDomains.has(domain)) {
      skipped.push({ url, domain, reason: "blocked_domain" });
      continue;
    }

    if (existingAiDomains.has(domain)) {
      skipped.push({ url, domain, reason: "already_in_ai_sources" });
      continue;
    }

    if (existingCandidateDomains.has(domain)) {
      skipped.push({ url, domain, reason: "already_in_candidates" });
      continue;
    }

    if (isSuspiciousDomain(domain)) {
      skipped.push({ url, domain, reason: "suspicious_domain_pattern" });
      continue;
    }

    localityScore = Math.max(
      localityScore,
      getCountryRelevanceScore(domain, normalizedCountry, language)
    );

    qualityScore += getTrustedDomainBoost(domain, normalizedCountry, normalizedCategory);
    qualityScore = Math.min(100, qualityScore);

    const borderline =
      qualityScore < 78 ||
      categoryFitScore < 78 ||
      localityScore < 75;

    if (borderline) {
      const verify = await verifyBorderlineCandidate({
        country: normalizedCountry,
        category: normalizedCategory,
        domain,
        url,
        sourceType,
        language,
        reason
      });

      if (!verify.accept) {
        skipped.push({
          url,
          domain,
          reason: "rejected_by_verifier",
          verifier_reason: verify.verifier_reason
        });
        continue;
      }

      qualityScore = Math.max(qualityScore, verify.verifier_score || qualityScore);
    }

    accepted.push(
      buildCandidateDoc({
        country: normalizedCountry,
        category: normalizedCategory,
        theme: normalizedTheme,
        url,
        domain,
        sourceType,
        qualityScore,
        reputationScore,
        localityScore,
        categoryFitScore,
        language,
        reason
      })
    );

    if (accepted.length >= normalizedLimit) break;
  }

  if (accepted.length > 0) {
    const batch = db.batch();

    for (const candidate of accepted) {
      const ref = db
        .collection(COLLECTIONS.SOURCE_DISCOVERY_CANDIDATES)
        .doc(candidate.candidate_id);

      batch.set(ref, candidate, { merge: true });
    }

    await batch.commit();
  }

  return {
    ok: true,
    country: normalizedCountry,
    category: normalizedCategory,
    theme: normalizedTheme,
    requested_limit: normalizedLimit,
    source: "AI_DISCOVERY_ENGINE_QC",

    ai_candidates_received: aiCandidates.length,
    seed_candidates_received: candidateSeeds.length,

    candidates_created: accepted.length,
    candidates: accepted,
    accepted_domains: accepted.map((x) => x.domain),

    skipped_count: skipped.length,
    skipped,
    skipped_domains: skipped.map((x) => x.domain || x.url || ""),
    skip_reason_counts: countSkipReasons(skipped),

    debug_sample_ai_urls: aiCandidates.slice(0, 10).map((x) => x.url || ""),
    debug_sample_ai_languages: aiCandidates.slice(0, 10).map((x) => x.language || ""),
    debug_raw_ai_preview: String(rawAiText || "").slice(0, 800),
    debug_prompt_preview: String(promptUsed || "").slice(0, 1200)
  };
}

module.exports = {
  createDiscoveryCandidates,
  extractDomain,
  isValidHttpUrl
};