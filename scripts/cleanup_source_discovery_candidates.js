"use strict";

const { Firestore } = require("@google-cloud/firestore");

const db = new Firestore();

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeHealth(value) {
  return String(value || "").trim().toLowerCase();
}

function shouldDeleteCandidate(data) {
  const url = normalizeText(data.url);
  const healthStatus = normalizeHealth(data.health_status);

  const missingUrl = !url;
  const deadHealth =
    healthStatus === "dead" || healthStatus === "disabled";

  return missingUrl || deadHealth;
}

async function run({ dryRun = true, batchSize = 200 } = {}) {
  const collectionName = "source_discovery_candidates";

  console.log(
    `Starting cleanup for ${collectionName} | dryRun=${dryRun} | batchSize=${batchSize}`
  );

  const snap = await db.collection(collectionName).get();

  if (snap.empty) {
    console.log("No candidate documents found.");
    return;
  }

  const docs = snap.docs.map((doc) => ({
    id: doc.id,
    ref: doc.ref,
    data: doc.data() || {}
  }));

  const toDelete = docs.filter((item) => shouldDeleteCandidate(item.data));

  console.log(`Total candidates found: ${docs.length}`);
  console.log(`Candidates marked for deletion: ${toDelete.length}`);

  if (toDelete.length === 0) {
    console.log("Nothing to delete. Funnel is already clean.");
    return;
  }

  console.log("\nSample candidates marked for deletion:");
  toDelete.slice(0, 20).forEach((item, index) => {
    console.log(
      `${index + 1}. ${item.id} | url="${normalizeText(item.data.url)}" | health_status="${normalizeHealth(item.data.health_status)}"`
    );
  });

  if (dryRun) {
    console.log("\nDry run complete. No documents were deleted.");
    return;
  }

  let deleted = 0;

  for (let i = 0; i < toDelete.length; i += batchSize) {
    const chunk = toDelete.slice(i, i + batchSize);
    const batch = db.batch();

    chunk.forEach((item) => {
      batch.delete(item.ref);
    });

    await batch.commit();
    deleted += chunk.length;

    console.log(`Deleted ${deleted}/${toDelete.length} candidates...`);
  }

  console.log(`\n✅ Cleanup complete. Deleted ${deleted} candidates.`);
}

const args = process.argv.slice(2);
const dryRun = !args.includes("--apply");

run({ dryRun }).catch((err) => {
  console.error("❌ Candidate cleanup failed:", err);
  process.exit(1);
});