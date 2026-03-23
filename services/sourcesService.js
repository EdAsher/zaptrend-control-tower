const { db } = require("../config/firestore");
const { COLLECTIONS, STATUSES, DEFAULTS } = require("../config/constants");
const { env } = require("../config/env");

async function getSourcesOverview({
  country = "",
  category = "",
  status = "",
  limit = 100
} = {}) {
  const normalizedCountry = String(
    country || env.ZAPTREND_DEFAULT_COUNTRY || DEFAULTS.COUNTRY
  )
    .trim()
    .toUpperCase();

  const normalizedCategory = String(
    category || env.ZAPTREND_DEFAULT_CATEGORY || DEFAULTS.CATEGORY
  ).trim();

  const normalizedStatus = String(status || "").trim().toUpperCase();
  const normalizedLimit = Number(limit || 100);

  const [aiSnap, candidateSnap] = await Promise.all([
    db.collection(COLLECTIONS.AI_SOURCES).limit(normalizedLimit).get(),
    db.collection(COLLECTIONS.SOURCE_DISCOVERY_CANDIDATES)
      .limit(normalizedLimit)
      .get()
  ]);

  let aiSources = aiSnap.docs.map((doc) => ({
    id: doc.id,
    source_kind: "AI_SOURCE",
    ...doc.data()
  }));

  let candidates = candidateSnap.docs.map((doc) => ({
    id: doc.id,
    source_kind: "CANDIDATE",
    ...doc.data()
  }));

  const applyFilters = (items) =>
    items.filter((item) => {
      const matchCountry =
        !normalizedCountry ||
        String(item.country || "").toUpperCase() === normalizedCountry;

      const matchCategory =
        !normalizedCategory ||
        String(item.category || "") === normalizedCategory;

      const itemStatus = String(
        item.status ||
          item.trial_status ||
          item.promotion_status ||
          ""
      )
        .trim()
        .toUpperCase();

      const matchStatus = !normalizedStatus || itemStatus === normalizedStatus;

      return matchCountry && matchCategory && matchStatus;
    });

  aiSources = applyFilters(aiSources);
  candidates = applyFilters(candidates);

  return {
    ok: true,
    summary: {
      active_ai_sources: aiSources.filter(
        (x) => String(x.status || "").toUpperCase() === STATUSES.ACTIVE
      ).length,
      candidate_sources: candidates.filter(
        (x) => String(x.status || "").toUpperCase() === STATUSES.CANDIDATE
      ).length,
      promoted_candidates: candidates.filter(
        (x) =>
          String(x.promotion_status || "").toUpperCase() === STATUSES.PROMOTED
      ).length,
      trial_approved: candidates.filter(
        (x) =>
          String(x.trial_status || "").toUpperCase() === STATUSES.TRIAL_APPROVED
      ).length,
      trial_rejected: candidates.filter(
        (x) =>
          String(x.trial_status || "").toUpperCase() === STATUSES.TRIAL_REJECTED
      ).length
    },
    ai_sources: aiSources,
    candidates
  };
}

module.exports = {
  getSourcesOverview
};