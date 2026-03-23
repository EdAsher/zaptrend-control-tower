"use strict";

const { Firestore } = require("@google-cloud/firestore");

const db = new Firestore();

async function run() {
  const snap = await db.collection("ai_sources").get();

  if (snap.empty) {
    console.log("ai_sources already empty.");
    return;
  }

  const batchSize = 200;
  let deleted = 0;

  while (true) {
    const snapshot = await db.collection("ai_sources").limit(batchSize).get();
    if (snapshot.empty) break;

    const batch = db.batch();

    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
      deleted++;
    });

    await batch.commit();
  }

  console.log(`✅ Deleted ${deleted} ai_sources documents`);
}

run().catch((err) => {
  console.error("❌ Failed deleting ai_sources:", err);
  process.exit(1);
});