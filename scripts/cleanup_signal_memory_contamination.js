"use strict";

const { Firestore } = require("@google-cloud/firestore");

const db = new Firestore();

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeCountry(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeCategory(value) {
  return String(value || "").trim();
}

function getArgValue(flag, fallback = "") {
  const args = process.argv.slice(2);
  const index = args.indexOf(flag);
  if (index === -1) return fallback;
  return args[index + 1] || fallback;
}

function hasFlag(flag) {
  return process.argv.slice(2).includes(flag);
}

function buildJoinedText(data = {}) {
  return [
    data.memory_key,
    data.brand,
    data.product,
    data.hashtag,
    data.category,
    data.country
  ]
    .map((x) => normalizeText(x))
    .join(" ");
}

function isOffCategoryForSnacks(data = {}) {
  const text = buildJoinedText(data);

  const beautyKeywords = [
    "powder",
    "eyeliner",
    "lipstick",
    "mascara",
    "foundation",
    "concealer",
    "blush",
    "skincare",
    "skin care",
    "acne",
    "serum",
    "cleanser",
    "toner",
    "moisturizer",
    "sunscreen",
    "beauty",
    "cosmetic",
    "cosmetics",
    "makeup",
    "make-up",
    "mistine",
    "srichand",
    "yanhee"
  ];

  return beautyKeywords.some((keyword) => text.includes(keyword));
}

function isTargetDoc(data = {}, country, category) {
  return (
    normalizeCountry(data.country) === normalizeCountry(country) &&
    normalizeCategory(data.category) === normalizeCategory(category)
  );
}

function shouldDeleteSignalEvent(data, { country, category }) {
  if (!isTargetDoc(data, country, category)) return false;

  if (category === "snacks_drinks") {
    return isOffCategoryForSnacks(data);
  }

  return false;
}

function shouldDeleteSignalMemory(data, { country, category }) {
  if (!isTargetDoc(data, country, category)) return false;

  if (category === "snacks_drinks") {
    return isOffCategoryForSnacks(data);
  }

  return false;
}

function shouldDeleteTrendOutput(data, { country, category }) {
  if (!isTargetDoc(data, country, category)) return false;

  if (category === "snacks_drinks") {
    return isOffCategoryForSnacks(data);
  }

  return false;
}

async function collectDocs(collectionName) {
  const snap = await db.collection(collectionName).get();

  return snap.docs.map((doc) => ({
    id: doc.id,
    ref: doc.ref,
    data: doc.data() || {}
  }));
}

function printSample(title, docs) {
  console.log(`\n${title}`);
  if (!docs.length) {
    console.log("None.");
    return;
  }

  docs.slice(0, 20).forEach((item, index) => {
    const data = item.data || {};
    console.log(
      `${index + 1}. ${item.id} | brand="${data.brand || ""}" | product="${data.product || ""}" | hashtag="${data.hashtag || ""}" | memory_key="${data.memory_key || ""}"`
    );
  });
}

async function deleteInBatches(items, batchSize, label) {
  let deleted = 0;

  for (let i = 0; i < items.length; i += batchSize) {
    const chunk = items.slice(i, i + batchSize);
    const batch = db.batch();

    chunk.forEach((item) => batch.delete(item.ref));

    await batch.commit();
    deleted += chunk.length;

    console.log(`Deleted ${deleted}/${items.length} from ${label}...`);
  }

  return deleted;
}

async function run({
  dryRun = true,
  batchSize = 200,
  country = "TH",
  category = "snacks_drinks"
} = {}) {
  console.log(
    `Starting contamination cleanup | country=${country} | category=${category} | dryRun=${dryRun} | batchSize=${batchSize}`
  );

  const [signalEvents, signalMemory, trendOutputs] = await Promise.all([
    collectDocs("signal_events"),
    collectDocs("signal_memory"),
    collectDocs("trend_outputs")
  ]);

  const signalEventsToDelete = signalEvents.filter((item) =>
    shouldDeleteSignalEvent(item.data, { country, category })
  );

  const signalMemoryToDelete = signalMemory.filter((item) =>
    shouldDeleteSignalMemory(item.data, { country, category })
  );

  const trendOutputsToDelete = trendOutputs.filter((item) =>
    shouldDeleteTrendOutput(item.data, { country, category })
  );

  console.log(`\nTotal signal_events found: ${signalEvents.length}`);
  console.log(`Signal events marked for deletion: ${signalEventsToDelete.length}`);

  console.log(`\nTotal signal_memory found: ${signalMemory.length}`);
  console.log(`Signal memory docs marked for deletion: ${signalMemoryToDelete.length}`);

  console.log(`\nTotal trend_outputs found: ${trendOutputs.length}`);
  console.log(`Trend outputs marked for deletion: ${trendOutputsToDelete.length}`);

  printSample("Sample contaminated signal_events:", signalEventsToDelete);
  printSample("Sample contaminated signal_memory:", signalMemoryToDelete);
  printSample("Sample contaminated trend_outputs:", trendOutputsToDelete);

  if (dryRun) {
    console.log("\nDry run complete. No documents were deleted.");
    return;
  }

  const deletedSignalEvents = await deleteInBatches(
    signalEventsToDelete,
    batchSize,
    "signal_events"
  );

  const deletedSignalMemory = await deleteInBatches(
    signalMemoryToDelete,
    batchSize,
    "signal_memory"
  );

  const deletedTrendOutputs = await deleteInBatches(
    trendOutputsToDelete,
    batchSize,
    "trend_outputs"
  );

  console.log("\n✅ Cleanup complete.");
  console.log(`Deleted from signal_events: ${deletedSignalEvents}`);
  console.log(`Deleted from signal_memory: ${deletedSignalMemory}`);
  console.log(`Deleted from trend_outputs: ${deletedTrendOutputs}`);
}

const dryRun = !hasFlag("--apply");
const batchSize = Number(getArgValue("--batchSize", "200")) || 200;
const country = getArgValue("--country", "TH");
const category = getArgValue("--category", "snacks_drinks");

run({
  dryRun,
  batchSize,
  country,
  category
}).catch((err) => {
  console.error("❌ Contamination cleanup failed:", err);
  process.exit(1);
});