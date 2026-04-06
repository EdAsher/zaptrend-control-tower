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

  const batch = db.batch();

  for (const source of sources) {
    const extracted = mockExtractSignalsFromSource(source);

    totalSignals = totalSignals.concat(extracted);

    // 🔥 MEMORY UPDATE
    const signalCount = extracted.length;

    const successCount = Number(source.memory_success_count || 0);
    const failCount = Number(source.memory_fail_count || 0);
    const prevSignalCount = Number(source.memory_signal_count || 0);

    const isUseful = signalCount > 0;

    const newSuccess = isUseful ? successCount + 1 : successCount;
    const newFail = !isUseful ? failCount + 1 : failCount;

    const adaptiveWeight = Math.max(
      0,
      Math.min(
        100,
        (newSuccess * 5) - (newFail * 5) + prevSignalCount
      )
    );

    const ref = db.collection("ai_sources").doc(source.id);

    batch.set(
      ref,
      {
        memory_success_count: newSuccess,
        memory_fail_count: newFail,
        memory_signal_count: prevSignalCount + signalCount,
        memory_last_signal_at: new Date().toISOString(),
        adaptive_weight: adaptiveWeight,
        updated_at: new Date().toISOString()
      },
      { merge: true }
    );
  }

  await batch.commit();

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