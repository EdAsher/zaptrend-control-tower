"use strict";

const { Firestore, FieldValue } = require("@google-cloud/firestore");

const db = new Firestore();

async function run() {
  await db.collection("config").doc("source_trials").set(
    {
      enabled: true,
      batch_limit: 20,
      promote_if_success_count_gte: 2,
      promote_if_quality_score_gte: 80,
      disable_if_fail_count_gte: 2,
      disable_if_quality_score_lt: 60,
      success_score_delta: 5,
      fail_score_delta: 8,
      default_trial_runs: 3,
      updated_at: FieldValue.serverTimestamp(),
      updated_at_iso: new Date().toISOString()
    },
    { merge: true }
  );

  console.log("✅ config/source_trials seeded.");
}

run().catch((err) => {
  console.error("❌ Failed seeding source_trials config:", err);
  process.exit(1);
});