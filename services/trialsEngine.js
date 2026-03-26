const { db, FieldValue } = require("../config/firestore");
const { COLLECTIONS, STATUSES, DEFAULTS } = require("../config/constants");
const { env } = require("../config/env");

function buildRunId(prefix = "trialrun") {
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

function isDomainSuspicious(domain = "") {
  const d = String(domain || "").toLowerCase();

  const badKeywords = [
    "marry",
    "wedding",
    "clinic",
    "hospital",
    "crypto",
    "bet",
    "loan",
    "finance",
    "adult"
  ];

  return badKeywords.some((k) => d.includes(k));
}

function evaluateCandidate(candidate, index) {
  const candidateId = candidate.candidate_id || candidate.id;
  const domain = candidate.domain || null;

  const qualityScore = Number(candidate.quality_score || 0);
  const localityScore = Number(candidate.locality_score || 0);
  const categoryFitScore = Number(candidate.category_fit_score || 0);
  const reputationScore = Number(candidate.reputation_score || 0);
  const healthStatus = String(candidate.health_status || "").trim().toLowerCase();

  // Hard fail: unhealthy
  if (healthStatus !== "healthy") {
    return {
      candidate_id: candidateId,
      domain,
      quality_score: qualityScore,
      locality_score: localityScore,
      category_fit_score: categoryFitScore,
      reputation_score: reputationScore,
      decision: STATUSES.TRIAL_REJECTED,
      decision_reason: "health_not_healthy",
      assigned_trial_score: 0
    };
  }

  // Hard fail: suspicious domain
  if (isDomainSuspicious(domain)) {
    return {
      candidate_id: candidateId,
      domain,
      quality_score: qualityScore,
      locality_score: localityScore,
      category_fit_score: categoryFitScore,
      reputation_score: reputationScore,
      decision: STATUSES.TRIAL_REJECTED,
      decision_reason: "suspicious_domain",
      assigned_trial_score: 0
    };
  }

  // Hard fail: low category fit
  if (categoryFitScore < 70) {
    return {
      candidate_id: candidateId,
      domain,
      quality_score: qualityScore,
      locality_score: localityScore,
      category_fit_score: categoryFitScore,
      reputation_score: reputationScore,
      decision: STATUSES.TRIAL_REJECTED,
      decision_reason: "low_category_fit",
      assigned_trial_score: categoryFitScore
    };
  }

  // Hard fail: low quality
  if (qualityScore < 75) {
    return {
      candidate_id: candidateId,
      domain,
      quality_score: qualityScore,
      locality_score: localityScore,
      category_fit_score: categoryFitScore,
      reputation_score: reputationScore,
      decision: STATUSES.TRIAL_REJECTED,
      decision_reason: "low_quality",
      assigned_trial_score: qualityScore
    };
  }

  // Soft but required: locality
  if (localityScore < 60) {
    return {
      candidate_id: candidateId,
      domain,
      quality_score: qualityScore,
      locality_score: localityScore,
      category_fit_score: categoryFitScore,
      reputation_score: reputationScore,
      decision: STATUSES.TRIAL_REJECTED,
      decision_reason: "low_locality",
      assigned_trial_score: localityScore
    };
  }

  const weightedScore = Math.round(
    qualityScore * 0.4 +
      categoryFitScore * 0.3 +
      localityScore * 0.2 +
      reputationScore * 0.1
  );

  // Small tie-break dampening by index, but never below 0
  const finalScore = Math.max(0, Math.min(100, weightedScore - index));

  return {
    candidate_id: candidateId,
    domain,
    quality_score: qualityScore,
    locality_score: localityScore,
    category_fit_score: categoryFitScore,
    reputation_score: reputationScore,
    decision: STATUSES.TRIAL_APPROVED,
    decision_reason: "multi_factor_pass",
    assigned_trial_score: finalScore
  };
}

function pickBestTrialCandidates(candidates, limit) {
  return candidates
    .filter((candidate) => {
      const status = String(candidate.status || "").trim().toUpperCase();
      const trialStatus = String(candidate.trial_status || "").trim().toUpperCase();

      const isCandidate = status === STATUSES.CANDIDATE;
      const notYetEvaluated = !trialStatus;

      return isCandidate && notYetEvaluated;
    })
    .sort((a, b) => {
      const qualityA = Number(a.quality_score || 0);
      const qualityB = Number(b.quality_score || 0);
      if (qualityB !== qualityA) return qualityB - qualityA;

      const categoryFitA = Number(a.category_fit_score || 0);
      const categoryFitB = Number(b.category_fit_score || 0);
      if (categoryFitB !== categoryFitA) return categoryFitB - categoryFitA;

      const localityA = Number(a.locality_score || 0);
      const localityB = Number(b.locality_score || 0);
      if (localityB !== localityA) return localityB - localityA;

      const updatedA = getTimestampMillis(a.updated_at);
      const updatedB = getTimestampMillis(b.updated_at);
      if (updatedB !== updatedA) return updatedB - updatedA;

      const createdA = getTimestampMillis(a.created_at);
      const createdB = getTimestampMillis(b.created_at);
      return createdB - createdA;
    })
    .slice(0, limit);
}

async function runTrialEvaluation({ country, category, limit = 10 }) {
  const normalizedCountry = normalizeCountry(
    country || env.ZAPTREND_DEFAULT_COUNTRY || DEFAULTS.COUNTRY
  );
  const normalizedCategory = normalizeCategory(
    category || env.ZAPTREND_DEFAULT_CATEGORY || DEFAULTS.CATEGORY
  );
  const normalizedLimit = Number(limit || env.ZAPTREND_TRIAL_LIMIT || 10);
  const trialRunId = buildRunId("trialrun");

  const snap = await db
    .collection(COLLECTIONS.SOURCE_DISCOVERY_CANDIDATES)
    .where("country", "==", normalizedCountry)
    .where("category", "==", normalizedCategory)
    .get();

  const allCandidates = snap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data()
  }));

  const candidates = pickBestTrialCandidates(allCandidates, normalizedLimit);

  const evaluations = candidates.map((candidate, index) =>
    evaluateCandidate(candidate, index)
  );

  const approved = evaluations.filter(
    (x) => x.decision === STATUSES.TRIAL_APPROVED
  );
  const rejected = evaluations.filter(
    (x) => x.decision === STATUSES.TRIAL_REJECTED
  );

  const batch = db.batch();

  for (const item of evaluations) {
    const ref = db
      .collection(COLLECTIONS.SOURCE_DISCOVERY_CANDIDATES)
      .doc(item.candidate_id);

    batch.set(
      ref,
      {
        trial_status: item.decision,
        trial_score: item.assigned_trial_score,
        trial_decision_reason: item.decision_reason,
        evaluated_in_trial_run_id: trialRunId,
        updated_at: FieldValue.serverTimestamp()
      },
      { merge: true }
    );
  }

  const trialRunRef = db.collection(COLLECTIONS.TRIAL_RUNS).doc(trialRunId);

  batch.set(trialRunRef, {
    trial_run_id: trialRunId,
    country: normalizedCountry,
    category: normalizedCategory,
    evaluated_count: evaluations.length,
    approved_count: approved.length,
    rejected_count: rejected.length,
    approved_candidate_ids: approved.map((x) => x.candidate_id),
    rejected_candidate_ids: rejected.map((x) => x.candidate_id),
    candidate_pool_size: allCandidates.length,
    selected_candidate_ids: evaluations.map((x) => x.candidate_id),
    status: STATUSES.COMPLETED,
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp()
  });

  await batch.commit();

  return {
    ok: true,
    message: "Trials evaluated (multi-factor)",
    trial_run_id: trialRunId,
    country: normalizedCountry,
    category: normalizedCategory,
    candidate_pool_size: allCandidates.length,
    evaluated_count: evaluations.length,
    approved_count: approved.length,
    rejected_count: rejected.length,
    evaluations
  };
}

module.exports = {
  runTrialEvaluation
};