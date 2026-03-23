"use strict";

const { Firestore, FieldValue } = require("@google-cloud/firestore");

const db = new Firestore();

async function run() {
  await db.collection("config").doc("source_discovery").set(
    {
      promotion_threshold: 82,
      trial_threshold: 72,
      reject_below_threshold: 60,
      promotion_limit_per_run: 10,
      dedupe_by_domain: true,
      updated_at: FieldValue.serverTimestamp(),
      updated_at_iso: new Date().toISOString()
    },
    { merge: true }
  );

  console.log("✅ config/source_discovery promotion fields updated.");
}

run().catch((err) => {
  console.error("❌ Failed updating source_discovery config:", err);
  process.exit(1);
});