const { db, FieldValue } = require("../config/firestore");
const { env } = require("../config/env");

function buildId(prefix = "sig") {
  const stamp = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${stamp}_${rand}`;
}

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function stripHtmlTags(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeDocKeyPart(value) {
  return stripHtmlTags(value)
    .toLowerCase()
    .replace(/[\/\\]/g, " ")
    .replace(/[#?%*:|"<>]/g, " ")
    .replace(/[^\p{L}\p{N}\s._-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function normalizeCountry(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeCategory(value) {
  return String(value || "").trim();
}

function makeMemoryKey({ country, category, brand, product, hashtag }) {
  return [
    normalizeCountry(country),
    normalizeCategory(category),
    sanitizeDocKeyPart(brand),
    sanitizeDocKeyPart(product),
    sanitizeDocKeyPart(hashtag)
  ].join("__");
}

function scoreSignal({ sourceWeight = 1, engagement = 1, freshnessBoost = 1 }) {
  return Math.round(sourceWeight * engagement * freshnessBoost * 10);
}

function isCategoryValidSignal({ brand, product, hashtag }, category) {
  const cat = normalizeCategory(category).toLowerCase();
  const text = `${brand} ${product} ${hashtag}`.toLowerCase();

  if (cat === "snacks_drinks") {
    return (
      text.includes("tea") ||
      text.includes("drink") ||
      text.includes("snack") ||
      text.includes("noodle") ||
      text.includes("milk") ||
      text.includes("food") ||
      text.includes("flavor") ||
      text.includes("seaweed") ||
      text.includes("yogurt") ||
      text.includes("juice") ||
      text.includes("coffee") ||
      text.includes("soda") ||
      text.includes("dessert") ||
      text.includes("ice cream") ||
      text.includes("chips") ||
      text.includes("candy") ||
      text.includes("laksa") ||
      text.includes("kaya")
    );
  }

  if (cat === "souvenirs_local_finds") {
    return (
      text.includes("souvenir") ||
      text.includes("craft") ||
      text.includes("gift") ||
      text.includes("silk") ||
      text.includes("ceramic") ||
      text.includes("tableware") ||
      text.includes("bag") ||
      text.includes("local") ||
      text.includes("market") ||
      text.includes("handmade") ||
      text.includes("scarf")
    );
  }

  if (cat === "fashion_accessories") {
    return (
      text.includes("bag") ||
      text.includes("wallet") ||
      text.includes("earring") ||
      text.includes("fashion") ||
      text.includes("accessories") ||
      text.includes("tote") ||
      text.includes("handbag") ||
      text.includes("style") ||
      text.includes("jewelry") ||
      text.includes("bracelet") ||
      text.includes("necklace")
    );
  }

  return true;
}

function uniqStrings(values = []) {
  return [...new Set(values.map((x) => normalizeText(x)).filter(Boolean))];
}

async function upsertMemoryDoc({
  memoryKey,
  normalizedCountry,
  normalizedCategory,
  brand,
  product,
  hashtag,
  signalScore,
  sourceType,
  reviewLanguage,
  localEvidence,
  travelBuyable,
  localConfidence,
  audienceLocale,
  creatorType
}) {
  const memoryRef = db.collection("signal_memory").doc(memoryKey);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(memoryRef);
    const existing = snap.exists ? snap.data() || {} : {};

    const existingReviewLanguages = Array.isArray(existing.review_languages)
      ? existing.review_languages
      : [];
    const existingEvidence = Array.isArray(existing.local_evidence_samples)
      ? existing.local_evidence_samples
      : [];
    const existingCreatorTypes = Array.isArray(existing.creator_types)
      ? existing.creator_types
      : [];
    const existingSourceTypes = Array.isArray(existing.source_types)
      ? existing.source_types
      : [];

    const nextReviewLanguages = uniqStrings([
      ...existingReviewLanguages,
      reviewLanguage
    ]);

    const nextEvidence = uniqStrings([
      ...existingEvidence,
      localEvidence
    ]);

    const nextCreatorTypes = uniqStrings([
      ...existingCreatorTypes,
      creatorType
    ]);

    const nextSourceTypes = uniqStrings([
      ...existingSourceTypes,
      sourceType
    ]);

    const existingMentions = Number(existing.total_mentions || 0);
    const existingCumulative = Number(existing.cumulative_score || 0);
    const existingMaxLocalConfidence = Number(existing.max_local_confidence || 0);

    const nextMaxLocalConfidence = Math.max(
      existingMaxLocalConfidence,
      Number(localConfidence || 0)
    );

    const nextTravelBuyable =
      existing.travel_buyable === true || travelBuyable === true;

    const nextLatestReviewLanguage =
      reviewLanguage || existing.latest_review_language || null;

    const nextLatestAudienceLocale =
      audienceLocale || existing.latest_audience_locale || null;

    tx.set(
      memoryRef,
      {
        memory_key: memoryKey,
        country: normalizedCountry,
        category: normalizedCategory,
        brand,
        product,
        hashtag,

        total_mentions: existingMentions + 1,
        cumulative_score: existingCumulative + signalScore,
        last_signal_score: signalScore,

        source_types: nextSourceTypes,
        review_languages: nextReviewLanguages,
        local_evidence_samples: nextEvidence,
        creator_types: nextCreatorTypes,

        latest_review_language: nextLatestReviewLanguage,
        latest_audience_locale: nextLatestAudienceLocale,
        travel_buyable: nextTravelBuyable,
        max_local_confidence: nextMaxLocalConfidence,

        last_seen_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp()
      },
      { merge: true }
    );
  });
}

async function ingestSignals({
  country,
  category,
  sourceType = "manual_seed",
  signals = []
}) {
  const normalizedCountry = normalizeCountry(
    country || env.ZAPTREND_DEFAULT_COUNTRY || "TH"
  );
  const normalizedCategory = normalizeCategory(
    category || env.ZAPTREND_DEFAULT_CATEGORY || "beauty_skincare"
  );

  const batch = db.batch();
  const results = [];
  let skipped_count = 0;
  const skipped = [];

  const memoryOps = [];

  for (const raw of signals) {
    const brand = stripHtmlTags(normalizeText(raw.brand));
    const product = stripHtmlTags(normalizeText(raw.product));
    const hashtag = stripHtmlTags(normalizeText(raw.hashtag));

    if (!isCategoryValidSignal({ brand, product, hashtag }, normalizedCategory)) {
      skipped_count++;
      skipped.push({
        brand,
        product,
        hashtag,
        reason: "off_category_signal"
      });
      continue;
    }

    const sourceWeight = Number(raw.source_weight || 1);
    const engagement = Number(raw.engagement || 1);
    const freshnessBoost = Number(raw.freshness_boost || 1);

    const reviewLanguage = normalizeText(raw.review_language || "");
    const localEvidence = stripHtmlTags(normalizeText(raw.local_evidence || ""));
    const travelBuyable = raw.travel_buyable !== false;
    const localConfidence = Number(raw.local_confidence || 0);
    const audienceLocale = normalizeText(raw.audience_locale || "");
    const creatorType = normalizeText(raw.creator_type || "");

    const signalScore = scoreSignal({
      sourceWeight,
      engagement,
      freshnessBoost
    });

    const eventId = buildId("signalevt");
    const memoryKey = makeMemoryKey({
      country: normalizedCountry,
      category: normalizedCategory,
      brand,
      product,
      hashtag
    });

    const eventRef = db.collection("signal_events").doc(eventId);
    batch.set(eventRef, {
      signal_event_id: eventId,
      memory_key: memoryKey,
      country: normalizedCountry,
      category: normalizedCategory,
      brand,
      product,
      hashtag,
      source_type: sourceType,
      source_ref: raw.source_ref || null,
      engagement,
      source_weight: sourceWeight,
      freshness_boost: freshnessBoost,
      signal_score: signalScore,
      review_language: reviewLanguage || null,
      local_evidence: localEvidence || null,
      travel_buyable: travelBuyable,
      local_confidence: localConfidence || 0,
      audience_locale: audienceLocale || null,
      creator_type: creatorType || null,
      created_at: FieldValue.serverTimestamp()
    });

    memoryOps.push(
      upsertMemoryDoc({
        memoryKey,
        normalizedCountry,
        normalizedCategory,
        brand,
        product,
        hashtag,
        signalScore,
        sourceType,
        reviewLanguage,
        localEvidence,
        travelBuyable,
        localConfidence,
        audienceLocale,
        creatorType
      })
    );

    results.push({
      event_id: eventId,
      memory_key: memoryKey,
      brand,
      product,
      hashtag,
      signal_score: signalScore,
      review_language: reviewLanguage || null,
      travel_buyable: travelBuyable,
      local_confidence: localConfidence || 0
    });
  }

  await batch.commit();
  await Promise.all(memoryOps);

  return {
    ok: true,
    message: "Signals ingested",
    country: normalizedCountry,
    category: normalizedCategory,
    ingested_count: results.length,
    skipped_count,
    skipped: skipped.slice(0, 20),
    results
  };
}

async function getSignalMemory({
  country,
  category,
  limit = 20
}) {
  const normalizedCountry = normalizeCountry(
    country || env.ZAPTREND_DEFAULT_COUNTRY || "TH"
  );
  const normalizedCategory = normalizeCategory(
    category || env.ZAPTREND_DEFAULT_CATEGORY || "beauty_skincare"
  );
  const normalizedLimit = Number(limit || 20);

  const snap = await db
    .collection("signal_memory")
    .where("country", "==", normalizedCountry)
    .where("category", "==", normalizedCategory)
    .limit(normalizedLimit)
    .get();

  const rows = snap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data()
  }));

  rows.sort(
    (a, b) => Number(b.cumulative_score || 0) - Number(a.cumulative_score || 0)
  );

  return {
    ok: true,
    country: normalizedCountry,
    category: normalizedCategory,
    total: rows.length,
    rows
  };
}

module.exports = {
  ingestSignals,
  getSignalMemory
};