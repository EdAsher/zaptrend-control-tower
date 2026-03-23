const { db } = require("../config/firestore");
const { ingestSignals } = require("./signalMemoryEngine");

function normalizeCountry(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeCategory(value) {
  return String(value || "").trim();
}

function mockExtractSignalsFromSource(source) {
  const brandSamples = [
    { brand: "Srichand", product: "Translucent Powder", hashtag: "#thaibeauty" },
    { brand: "Mistine", product: "Eyeliner", hashtag: "#bangkokfinds" },
    { brand: "Yanhee", product: "Acne Gel", hashtag: "#thai skincare" }
  ];

  return brandSamples.map((item) => ({
    ...item,
    source_ref: source.domain || source.source_id,
    source_weight: 1,
    engagement: Math.floor(Math.random() * 5) + 1,
    freshness_boost: 1
  }));
}

async function runSourceSignalScan({ country, category }) {
  const normalizedCountry = normalizeCountry(country);
  const normalizedCategory = normalizeCategory(category);

  const snap = await db
    .collection("ai_sources")
    .where("country", "==", normalizedCountry)
    .where("category", "==", normalizedCategory)
    .where("status", "==", "ACTIVE")
    .limit(10)
    .get();

  const sources = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  let totalSignals = [];

  for (const source of sources) {
    const extracted = mockExtractSignalsFromSource(source);
    totalSignals = totalSignals.concat(extracted);
  }

  const result = await ingestSignals({
    country: normalizedCountry,
    category: normalizedCategory,
    sourceType: "source_scan",
    signals: totalSignals
  });

  return {
    ok: true,
    sources_scanned: sources.length,
    signals_extracted: totalSignals.length,
    ingestion_result: result
  };
}

module.exports = {
  runSourceSignalScan
};