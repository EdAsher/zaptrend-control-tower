const { db, FieldValue } = require("../config/firestore");
const { COLLECTIONS, STATUSES, DEFAULTS } = require("../config/constants");
const { env } = require("../config/env");

function buildRunId(prefix = "reputationrun") {
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

function calculateReputation(candidate) {
  const qualityScore = Number(candidate.quality_score || 0);
  const trialScore = Number(candidate.trial_score || 0);
  const successCount = Number(candidate.success_count || 0);
  const failCount = Number(candidate.fail_count || 0);

  const reputation =
    qualityScore * 0.4 +
    trialScore * 0.4 +
    successCount * 8 -
    failCount * 6;

  return Math.max(0, Math.min(100, Math.round(reputation)));
}

function pickBestReputationCandidates(candidates, limit) {
  return candidates
    .filter((candidate) => {
      const trialStatus = String(candidate.trial_status || "").trim().toUpperCase();
      return trialStatus === STATUSES.TRIAL_APPROVED;
    })
    .sort((a, b) => {
      const trialA = Number(a.trial_score || 0);
      const trialB = Number(b.trial_score || 0);
      if (trialB !== trialA) return trialB - trialA;

      const qualityA = Number(a.quality_score || 0);
      const qualityB = Number(b.quality_score || 0);
      if (qualityB !== qualityA) return qualityB - qualityA;

      const updatedA = getTimestampMillis(a.updated_at);
      const updatedB = getTimestampMillis(b.updated_at);
      if (updatedB !== updatedA) return updatedB - updatedA;

      const createdA = getTimestampMillis(a.created_at);
      const createdB = getTimestampMillis(b.created_at);
      return createdB - createdA;
    })
    .slice(0, limit);
}

async function runReputationRecalculation({ country, category, limit = 20 }) {
  const normalizedCountry = normalizeCountry(
    country || env.ZAPTREND_DEFAULT_COUNTRY || DEFAULTS.COUNTRY
  );
  const normalizedCategory = normalizeCategory(
    category || env.ZAPTREND_DEFAULT_CATEGORY || DEFAULTS.CATEGORY
  );
  const normalizedLimit = Number(limit || env.ZAPTREND_REPUTATION_LIMIT || 20);
  const reputationRunId = buildRunId("reputationrun");

  const snap = await db
    .collection(COLLECTIONS.SOURCE_DISCOVERY_CANDIDATES)
    .where("country", "==", normalizedCountry)
    .where("category", "==", normalizedCategory)
    .get();

  const allCandidates = snap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data()
  }));

  const candidates = pickBestReputationCandidates(allCandidates, normalizedLimit);

  const recalculated = candidates.map((candidate) => {
    const reputationScore = calculateReputation(candidate);

    return {
      candidate_id: candidate.candidate_id || candidate.id,
      domain: candidate.domain || null,
      previous_reputation_score: Number(candidate.reputation_score || 0),
      new_reputation_score: reputationScore,
      trial_status: candidate.trial_status || null,
      quality_score: Number(candidate.quality_score || 0),
      trial_score: Number(candidate.trial_score || 0)
    };
  });

  const batch = db.batch();

  for (const item of recalculated) {
    const ref = db
      .collection(COLLECTIONS.SOURCE_DISCOVERY_CANDIDATES)
      .doc(item.candidate_id);

    batch.set(
      ref,
      {
        reputation_score: item.new_reputation_score,
        last_reputation_run_id: reputationRunId,
        updated_at: FieldValue.serverTimestamp()
      },
      { merge: true }
    );
  }

  const runRef = db.collection(COLLECTIONS.REPUTATION_RUNS).doc(reputationRunId);

  batch.set(runRef, {
    reputation_run_id: reputationRunId,
    country: normalizedCountry,
    category: normalizedCategory,
    candidate_pool_size: allCandidates.length,
    recalculated_count: recalculated.length,
    recalculated_candidate_ids: recalculated.map((x) => x.candidate_id),
    status: STATUSES.COMPLETED,
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp()
  });

  await batch.commit();

  return {
    ok: true,
    message: "Reputation recalculated",
    reputation_run_id: reputationRunId,
    country: normalizedCountry,
    category: normalizedCategory,
    candidate_pool_size: allCandidates.length,
    recalculated_count: recalculated.length,
    recalculated
  };
}

module.exports = {
  runReputationRecalculation
};