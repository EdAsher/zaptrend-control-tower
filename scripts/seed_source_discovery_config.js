"use strict";

const { Firestore, FieldValue } = require("@google-cloud/firestore");
const db = new Firestore();

async function run() {
  await db.collection("config").doc("source_discovery").set({
    enabled: true,
    countries_enabled: ["SG", "MY", "TH"],
    categories_enabled: [
      "beauty_skincare",
      "snacks_drinks",
      "souvenirs_local_finds"
    ],
    discovery_batch_size: 5,
    candidate_promotion_threshold: 75,
    candidate_min_locality_score: 70,
    candidate_min_relevance_score: 70,
    trial_runs_default: 3,
    use_query_discovery: true,
    use_link_graph_discovery: false,
    use_hashtag_expansion: true,
    updated_at: FieldValue.serverTimestamp(),
    updated_at_iso: new Date().toISOString()
  }, { merge: true });

  console.log("✅ config/source_discovery seeded.");
}

run().catch(err => {
  console.error("❌ Failed:", err);
  process.exit(1);
});