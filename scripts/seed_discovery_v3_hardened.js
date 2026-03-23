"use strict";

const { Firestore, FieldValue } = require("@google-cloud/firestore");

const db = new Firestore();

async function run() {
  await db.collection("config").doc("discovery_v3").set(
    {
      enabled: true,
      engine_version: "v3_phase1_hardened",

      max_candidates_per_run: 12,
      discovery_batch_size: 6,

      candidate_min_locality_score: 75,
      candidate_min_relevance_score: 75,
      candidate_min_confidence_score: 60,

      accept_candidate_threshold: 78,
      promotion_threshold: 999, // effectively disables direct-to-active from discovery
      trial_threshold: 80,
      reject_below_threshold: 68,

      dedupe_by_domain: true,
      dedupe_by_source_id: true,
      auto_promote: true,
      trial_runs_default: 3,
      promotion_limit_per_run: 6,

      default_theme: "general",

      blocklist_domains: [
        "pantip.com",
        "central.co.th",
        "thairath.co.th",
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
        "editorial",
        "review",
        "blog"
      ],

      // optional theme policy
      theme_policies: {
        local_exclusive: {
          allowed_source_types: ["retail", "editorial", "review", "blog"],
          blocked_domains: ["pantip.com", "central.co.th", "thairath.co.th"],
          require_signal_keywords: [
            "local",
            "exclusive",
            "limited edition",
            "thailand only",
            "thai brand",
            "locally made",
            "ขายเฉพาะในไทย",
            "แบรนด์ไทย"
          ],
          min_locality_score: 80,
          min_relevance_score: 78,
          min_confidence_score: 60,
          accept_candidate_threshold: 82,
          trial_threshold: 84
        }
      },

      updated_at: FieldValue.serverTimestamp(),
      updated_at_iso: new Date().toISOString()
    },
    { merge: true }
  );

  await db.collection("config").doc("source_discovery").set(
    {
      enabled: true,
      discovery_batch_size: 6,
      candidate_min_locality_score: 75,
      candidate_min_relevance_score: 75,
      promotion_threshold: 999,
      trial_threshold: 80,
      reject_below_threshold: 68,
      promotion_limit_per_run: 6,
      dedupe_by_domain: true,
      trial_runs_default: 3,
      updated_at: FieldValue.serverTimestamp(),
      updated_at_iso: new Date().toISOString()
    },
    { merge: true }
  );

  console.log("✅ config/discovery_v3 hardened.");
  console.log("✅ config/source_discovery synced.");
}

run().catch((err) => {
  console.error("❌ Failed seeding hardened discovery_v3 config:", err);
  process.exit(1);
});