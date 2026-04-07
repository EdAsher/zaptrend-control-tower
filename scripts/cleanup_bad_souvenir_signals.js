const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

const KEYWORDS = [
  "edible insects",
  "why eat edible insects",
  "foods and drinks",
  "shipping worldwide",
  "us, uk, japan and worldwide"
];

function textOf(v) {
  return String(v || "").toLowerCase();
}

function matchesBadSouvenirSignal(data = {}) {
  const brand = textOf(data.brand);
  const product = textOf(data.product);
  const hashtag = textOf(data.hashtag);
  const sourceRef = textOf(data.source_ref);
  const memoryKey = textOf(data.memory_key);

  const blob = [brand, product, hashtag, sourceRef, memoryKey].join(" ");

  const keywordHit = KEYWORDS.some((k) => blob.includes(k));
  const thailandUniqueHit = blob.includes("thailandunique");

  return thailandUniqueHit && keywordHit;
}

async function deleteMatchingDocs(collectionName) {
  const snap = await db.collection(collectionName).get();
  let deleted = 0;
  const batchSize = 200;
  let batch = db.batch();
  let ops = 0;

  for (const doc of snap.docs) {
    const data = doc.data() || {};
    if (!matchesBadSouvenirSignal(data)) continue;

    batch.delete(doc.ref);
    deleted++;
    ops++;

    if (ops >= batchSize) {
      await batch.commit();
      batch = db.batch();
      ops = 0;
    }
  }

  if (ops > 0) {
    await batch.commit();
  }

  return deleted;
}

async function main() {
  console.log("Starting targeted cleanup...");

  const deletedSignalEvents = await deleteMatchingDocs("signal_events");
  console.log("Deleted signal_events:", deletedSignalEvents);

  const deletedSignalMemory = await deleteMatchingDocs("signal_memory");
  console.log("Deleted signal_memory:", deletedSignalMemory);

  const deletedTrendOutputs = await deleteMatchingDocs("trend_outputs");
  console.log("Deleted trend_outputs:", deletedTrendOutputs);

  console.log("Cleanup complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});