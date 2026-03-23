"use strict";

const { Firestore, FieldValue } = require("@google-cloud/firestore");

const db = new Firestore();

async function run() {
  await db.collection("config").doc("discovery_v3").set(
    {
      enabled: true,
      engine_version: "v3_phase1",

      max_candidates_per_run: 20,
      discovery_batch_size: 8,

      candidate_min_locality_score: 70,
      candidate_min_relevance_score: 70,
      candidate_min_confidence_score: 50,

      accept_candidate_threshold: 72,
      promotion_threshold: 82,
      trial_threshold: 72,
      reject_below_threshold: 60,

      dedupe_by_domain: true,
      dedupe_by_source_id: true,
      auto_promote: true,
      trial_runs_default: 3,
      promotion_limit_per_run: 10,

      default_theme: "general",

      blocklist_domains: [
        "facebook.com",
        "instagram.com",
        "tiktok.com",
        "x.com",
        "twitter.com",
        "youtube.com",
        "pinterest.com",
        "reddit.com"
      ],

      allowed_source_types: [
        "retail",
        "marketplace",
        "editorial",
        "tourism",
        "review",
        "blog",
        "community"
      ],

      updated_at: FieldValue.serverTimestamp(),
      updated_at_iso: new Date().toISOString()
    },
    { merge: true }
  );

  // backward-compatible existing config doc
  await db.collection("config").doc("source_discovery").set(
    {
      enabled: true,
      discovery_batch_size: 8,
      candidate_min_locality_score: 70,
      candidate_min_relevance_score: 70,
      promotion_threshold: 82,
      trial_threshold: 72,
      reject_below_threshold: 60,
      promotion_limit_per_run: 10,
      dedupe_by_domain: true,
      trial_runs_default: 3,
      updated_at: FieldValue.serverTimestamp(),
      updated_at_iso: new Date().toISOString()
    },
    { merge: true }
  );

  console.log("✅ config/discovery_v3 seeded.");
  console.log("✅ config/source_discovery synced for backward compatibility.");
}

run().catch((err) => {
  console.error("❌ Failed seeding discovery_v3 config:", err);
  process.exit(1);
});