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

    if (healthStatus === "dead" || healthStatus === "disabled" || autoDisabled || !isActive) {
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

    if (healthStatus === "dead" || healthStatus === "disabled" || autoDisabled) {
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
  sourceType = "curated_seed",
  qualityScore = 85,
  reputationScore = 10
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

  const normalizedLimit = Number(limit || env.ZAPTREND_DISCOVERY_LIMIT || 5);

  const {
    existingAiDomains,
    existingCandidateDomains,
    blockedDomains
  } = await loadExistingDomainState();

  let aiCandidates = [];

  // 🔥 STEP 1 — CALL AI
  if (openai) {
    try {
      const prompt = `
You are an expert in identifying local ecommerce, beauty, lifestyle, and content websites.

Generate ${normalizedLimit * 2} REAL websites for:
Country: ${normalizedCountry}
Category: ${normalizedCategory}

Rules:
- Must be real websites
- Must be relevant to category
- Prefer local or regional sites
- Include ecommerce, blogs, media, marketplaces

Return JSON ONLY:

[
  {
    "url": "https://example.com",
    "quality_score": 80,
    "reputation_score": 10
  }
]
`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.7,
        messages: [{ role: "user", content: prompt }]
      });

      const raw = response.choices?.[0]?.message?.content || "[]";

      aiCandidates = JSON.parse(raw);
    } catch (err) {
      console.warn("AI discovery failed, fallback to seeds:", err.message);
    }
  }

  // 🔥 STEP 2 — COMBINE AI + SEEDS
  const allSeeds = [
    ...aiCandidates,
    ...candidateSeeds
  ];

  const accepted = [];
  const skipped = [];

  for (const seed of allSeeds) {
    const url = normalizeUrl(seed.url || "");
    const domain = normalizeDomain(seed.domain || extractDomain(url));

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

    accepted.push(
      buildCandidateDoc({
        country: normalizedCountry,
        category: normalizedCategory,
        theme,
        url,
        domain,
        sourceType: "ai_generated",
        qualityScore: Number(seed.quality_score || 80),
        reputationScore: Number(seed.reputation_score || 10)
      })
    );

    if (accepted.length >= normalizedLimit) break;
  }

  // 🔥 STEP 3 — SAVE
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
    candidates_created: accepted.length,
    skipped_count: skipped.length,
    source: "AI_DISCOVERY_ENGINE"
  };
}

module.exports = {
  createDiscoveryCandidates,
  extractDomain,
  isValidHttpUrl
};