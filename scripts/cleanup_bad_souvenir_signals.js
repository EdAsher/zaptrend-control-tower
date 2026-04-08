const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

function isBadSouvenirText(text = "") {
  const t = String(text || "").toLowerCase();

  const blockedTerms = [
    "edible insect",
    "edible insects",
    "insect",
    "insects",
    "cricket",
    "crickets",
    "silkworm",
    "silkworms",
    "worm",
    "worms",
    "grasshopper",
    "grasshoppers",
    "beetle",
    "beetles",
    "larvae",
    "larva",
    "field crickets",
    "why eat edible insects",
    "worldwide shipping",
    "shipping worldwide",
    "us uk japan",
    "international shipping",
    "global delivery"
  ];

  return blockedTerms.some((term) => t.includes(term));
}

async function cleanupCollection(collectionName) {
  const snapshot = await db.collection(collectionName).get();
  let deleted = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data() || {};
    const text = `${data.brand || ""} ${data.product || ""} ${data.hashtag || ""} ${data.memory_key || ""}`;

    const isSouvenir =
      String(data.category || "").trim() === "souvenirs_local_finds";

    if (isSouvenir && isBadSouvenirText(text)) {
      console.log(`Deleting from ${collectionName}: ${doc.id}`);
      await doc.ref.delete();
      deleted++;
    }
  }

  return deleted;
}

async function main() {
  console.log("Starting targeted cleanup for bad souvenir signals...");

  const deletedMemory = await cleanupCollection("signal_memory");
  const deletedEvents = await cleanupCollection("signal_events");
  const deletedTrends = await cleanupCollection("trend_outputs");

  console.log("Cleanup complete.");
  console.log({
    signal_memory_deleted: deletedMemory,
    signal_events_deleted: deletedEvents,
    trend_outputs_deleted: deletedTrends
  });
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Cleanup failed:", err);
    process.exit(1);
  });