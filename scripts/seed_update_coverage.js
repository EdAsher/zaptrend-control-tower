"use strict";

/*
  Seed script to UPDATE config/coverage with rollout control fields.

  Safe merge:
  - Does NOT overwrite existing fields
  - Only adds new rollout control fields

  Run:
  node seed_update_coverage.js
*/

const { Firestore, FieldValue } = require("@google-cloud/firestore");

const db = new Firestore();

async function run() {

  const ref = db.collection("config").doc("coverage");

  const patch = {

    generation_min_sources: 2,

    generation_enabled_countries: [
      "SG",
      "MY",
      "TH"
    ],

    generation_enabled_categories: [
      "beauty_skincare",
      "snacks_drinks",
      "souvenirs_local_finds"
    ],

    updated_at: FieldValue.serverTimestamp(),
    updated_at_iso: new Date().toISOString()

  };

  await ref.set(patch, { merge: true });

  console.log("✅ config/coverage updated successfully.");
}

run().catch(err => {
  console.error("❌ Failed updating coverage config:", err);
});