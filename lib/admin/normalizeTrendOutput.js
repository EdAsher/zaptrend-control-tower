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

function normalizeTrendOutputDoc(doc) {
  if (!doc) return null;

  const id =
    doc.trend_output_id ||
    doc.id ||
    `output_${Date.now()}`;

  return {
    id,

    trend_output_id: id,

    trend_run_id:
      doc.trend_run_id ||
      doc.run_id ||
      null,

    country: doc.country || "UNKNOWN",
    category: doc.category || "general",

    brand: doc.brand || doc.source || "Unknown",
    product: doc.product || doc.title || "Unnamed",

    hashtag: doc.hashtag || "",

    trend_score: doc.trend_score ?? doc.score ?? 0,

    trend_status: doc.trend_status || "active",

    total_mentions: doc.total_mentions ?? 0,
    cumulative_score: doc.cumulative_score ?? 0,
    last_signal_score: doc.last_signal_score ?? 0,

    source_types: doc.source_types || [],

    last_seen_at_iso:
      doc.last_seen_at_iso ||
      toISO(doc.last_seen_at),

    created_at_iso:
      doc.created_at_iso ||
      toISO(doc.created_at),

    updated_at_iso:
      doc.updated_at_iso ||
      toISO(doc.updated_at),
  };
}

module.exports = { normalizeTrendOutputDoc };