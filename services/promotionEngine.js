const { db, FieldValue } = require("../config/firestore");
const { COLLECTIONS, STATUSES, DEFAULTS } = require("../config/constants");
const { env } = require("../config/env");

function buildRunId(prefix = "promotionrun") {
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

function getTimestampMillis(value) {
  try {
    if (!value) return 0;
    if (typeof value?.toMillis === "function") return value.toMillis();
    if (typeof value === "string") {
      const ms = Date.parse(value);
      return Number.isNaN(ms) ? 0 : ms;
    }
    return 0;
  } catch {
    return 0;
  }
}

function isEligibleForPromotion(candidate, existingSourcesMap) {
  const qualityScore = Number(candidate.quality_score || 0);
  const reputationScore = Number(candidate.reputation_score || 0);
  const trialStatus = String(candidate.trial_status || "").trim().toUpperCase();
  const promotionStatus = String(candidate.promotion_status || "").trim().toUpperCase();

  const healthStatus = String(candidate.health_status || "").trim().toLowerCase();
  const isActive = candidate.is_active !== false;
  const autoDisabled = candidate.auto_disabled === true;

  const domain = normalizeDomain(candidate.domain || "");

  if (!domain) return false;

  // Already promoted before
  if (promotionStatus === STATUSES.PROMOTED) return false;

  // Must be trial approved
  if (trialStatus !== STATUSES.TRIAL_APPROVED) return false;

  // Quality and reputation gates
  if (qualityScore < 70) return false;
  if (reputationScore < 0) return false;

  // Health gate
  if (healthStatus !== "healthy") return false;

  // Active gate
  if (!isActive || autoDisabled) return false;

  // Duplicate / previously known domain
  if (existingSourcesMap.has(domain)) return false;

  return true;
}

function rankPromotionCandidates(candidates) {
  return [...candidates].sort((a, b) => {
    const repA = Number(a.reputation_score || 0);
    const repB = Number(b.reputation_score || 0);
    if (repB !== repA) return repB - repA;

    const qualityA = Number(a.quality_score || 0);
    const qualityB = Number(b.quality_score || 0);
    if (qualityB !== qualityA) return qualityB - qualityA;

    const trialA = Number(a.trial_score || 0);
    const trialB = Number(b.trial_score || 0);
    if (trialB !== trialA) return trialB - trialA;

    const updatedA = getTimestampMillis(a.updated_at);
    const updatedB = getTimestampMillis(b.updated_at);
    if (updatedB !== updatedA) return updatedB - updatedA;

    const createdA = getTimestampMillis(a.created_at);
    const createdB = getTimestampMillis(b.created_at);
    return createdB - createdA;
  });
}

async function runPromotion({ country, category, limit = 10 }) {
  const normalizedCountry = normalizeCountry(
    country || env.ZAPTREND_DEFAULT_COUNTRY || DEFAULTS.COUNTRY
  );
  const normalizedCategory = normalizeCategory(
    category || env.ZAPTREND_DEFAULT_CATEGORY || DEFAULTS.CATEGORY
  );
  const normalizedLimit = Number(limit || env.ZAPTREND_PROMOTION_LIMIT || 10);
  const promotionRunId = buildRunId("promotionrun");

  const [candidateSnap, aiSnap] = await Promise.all([
    db.collection(COLLECTIONS.SOURCE_DISCOVERY_CANDIDATES)
      .where("country", "==", normalizedCountry)
      .where("category", "==", normalizedCategory)
      .get(),
    db.collection(COLLECTIONS.AI_SOURCES).get()
  ]);

  const allCandidates = candidateSnap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data()
  }));

  const existingSourcesMap = new Map();

  aiSnap.docs.forEach((doc) => {
    const data = doc.data();
    const domain = normalizeDomain(data.domain || "");
    if (domain) {
      existingSourcesMap.set(domain, {
        id: doc.id,
        health_status: String(data.health_status || "").toLowerCase(),
        is_active: data.is_active !== false,
        auto_disabled: data.auto_disabled === true
      });
    }
  });

  const eligibleCandidates = allCandidates.filter((candidate) =>
    isEligibleForPromotion(candidate, existingSourcesMap)
  );

  const candidates = rankPromotionCandidates(eligibleCandidates).slice(
    0,
    normalizedLimit
  );

  const batch = db.batch();

  for (const candidate of candidates) {
    const domain = normalizeDomain(candidate.domain || "");
    const aiSourceId =
      candidate.candidate_id ||
      `${normalizedCountry}_${normalizedCategory}_${domain || buildRunId("aisource")}`;

    const aiSourceRef = db.collection(COLLECTIONS.AI_SOURCES).doc(aiSourceId);

    batch.set(
      aiSourceRef,
      {
        source_id: aiSourceId,
        country: normalizedCountry,
        category: normalizedCategory,
        domain: candidate.domain || null,
        url: candidate.url || null,
        source_type: candidate.source_type || "promoted_candidate",
        status: STATUSES.ACTIVE,

        quality_score: Number(candidate.quality_score || 0),
        reputation_score: Number(candidate.reputation_score || 0),
        trial_score: Number(candidate.trial_score || 0),
        trial_status: candidate.trial_status || null,

        health_status: candidate.health_status || "unknown",
        health_reason: candidate.health_reason || "",
        health_http_status: candidate.health_http_status ?? null,
        health_fail_count: Number(candidate.health_fail_count || 0),
        health_consecutive_fail_count: Number(
          candidate.health_consecutive_fail_count || 0
        ),
        is_active: true,
        auto_disabled: false,
        auto_disabled_reason: "",

        promoted_from_candidate_id: candidate.candidate_id || candidate.id,
        promoted_in_run_id: promotionRunId,
        promotion_reason: "Passed quality + reputation + health filters",

        created_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp()
      },
      { merge: true }
    );

    const candidateRef = db
      .collection(COLLECTIONS.SOURCE_DISCOVERY_CANDIDATES)
      .doc(candidate.candidate_id || candidate.id);

    batch.set(
      candidateRef,
      {
        promotion_status: STATUSES.PROMOTED,
        promoted_to_ai_source_id: aiSourceId,
        promoted_in_run_id: promotionRunId,
        promotion_reason: "Passed quality + reputation + health filters",
        updated_at: FieldValue.serverTimestamp()
      },
      { merge: true }
    );
  }

  const runRef = db.collection(COLLECTIONS.PROMOTION_RUNS).doc(promotionRunId);

  batch.set(runRef, {
    promotion_run_id: promotionRunId,
    country: normalizedCountry,
    category: normalizedCategory,
    candidate_pool_size: allCandidates.length,
    eligible_count: eligibleCandidates.length,
    evaluated_count: candidates.length,
    promoted_count: candidates.length,
    promoted_candidate_ids: candidates.map((x) => x.candidate_id || x.id),
    status: STATUSES.COMPLETED,
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp()
  });

  await batch.commit();

  return {
    ok: true,
    message: "Promotion completed",
    promotion_run_id: promotionRunId,
    country: normalizedCountry,
    category: normalizedCategory,
    candidate_pool_size: allCandidates.length,
    eligible_count: eligibleCandidates.length,
    evaluated_count: candidates.length,
    promoted_count: candidates.length,
    promoted_candidates: candidates.map((candidate) => ({
      candidate_id: candidate.candidate_id || candidate.id,
      domain: candidate.domain || null,
      quality_score: Number(candidate.quality_score || 0),
      reputation_score: Number(candidate.reputation_score || 0),
      trial_score: Number(candidate.trial_score || 0),
      trial_status: candidate.trial_status || null,
      health_status: candidate.health_status || "unknown"
    }))
  };
}

module.exports = {
  runPromotion
};