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

function normalizeTrendRunDoc(doc) {
  if (!doc) return null;

  const id =
    doc.trend_run_id ||
    doc.run_id ||
    doc.id ||
    `legacy_${Date.now()}`;

  return {
    id,

    trend_run_id: id,

    run_type: doc.run_type || "trend_score",

    engine_version: doc.engine_version || "v1",

    country: doc.country || doc.country_code || "UNKNOWN",

    category: doc.category || doc.category_id || "general",

    status:
      doc.status ||
      (doc.error_message ? "failed" : "completed"),

    scored_count:
      doc.scored_count ??
      doc.generated_count ??
      0,

    generated_count:
      doc.generated_count ??
      doc.items_per_run ??
      0,

    error_message: doc.error_message || null,

    created_at_iso:
      doc.created_at_iso ||
      toISO(doc.created_at),

    updated_at_iso:
      doc.updated_at_iso ||
      toISO(doc.updated_at),
  };
}

module.exports = { normalizeTrendRunDoc };