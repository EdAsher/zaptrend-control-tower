function extractDomain(url) {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return null;
  }
}

function toISO(ts) {
  if (!ts) return null;

  if (typeof ts === "string") return ts;

  if (ts.seconds) {
    return new Date(ts.seconds * 1000).toISOString();
  }

  if (ts instanceof Date) {
    return ts.toISOString();
  }

  return null;
}

function normalizeSourceDoc(doc) {
  if (!doc) return null;

  const id = doc.id || doc.source_id || doc.candidate_id;

  return {
    id,

    source_id: doc.source_id || doc.candidate_id || id,
    source_kind: doc.source_kind || "AI_SOURCE",

    country: doc.country || doc.country_code || "UNKNOWN",
    category: doc.category || doc.category_id || "general",

    domain: doc.domain || extractDomain(doc.url) || "unknown",
    url: doc.url || "",

    status: doc.status || (doc.trial_status ? "candidate" : "active"),

    quality_score: doc.quality_score ?? doc.trial_score ?? 0,

    source_reputation_score:
      doc.source_reputation_score ?? doc.reputation_score ?? 0,

    trial_status: doc.trial_status || doc.status || "UNKNOWN",

    updated_at_iso:
      doc.updated_at_iso ||
      toISO(doc.updated_at) ||
      toISO(doc.created_at),

    created_at_iso:
      doc.created_at_iso ||
      toISO(doc.created_at),
  };
}

module.exports = { normalizeSourceDoc };