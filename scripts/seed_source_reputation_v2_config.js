"use strict";

const { Firestore, FieldValue } = require("@google-cloud/firestore");

const db = new Firestore();

async function run() {
  await db.collection("config").doc("source_reputation").set(
    {
      enabled: true,
      success_weight: 6,
      fail_weight: 10,
      locality_bonus_factor: 0.1,
      inactivity_penalty_per_day: 1,
      inactivity_grace_days: 7,
      active_threshold: 80,
      trial_threshold: 70,
      disable_threshold: 55,
      max_inactivity_penalty: 30,
      batch_limit: 50,
      updated_at: FieldValue.serverTimestamp(),
      updated_at_iso: new Date().toISOString()
    },
    { merge: true }
  );

  console.log("✅ config/source_reputation seeded.");
}

run().catch((err) => {
  console.error("❌ Failed seeding source_reputation config:", err);
  process.exit(1);
});