"use strict";

const { Firestore, FieldValue } = require("@google-cloud/firestore");

const db = new Firestore();

async function run() {

  const nowIso = new Date().toISOString();

  console.log("Seeding ZapTrend Social Signal Engine v1...");


  /*
  --------------------------------------------------
  CONFIG: SOCIAL SIGNAL ENGINE
  --------------------------------------------------
  */

  await db.collection("config").doc("social_signal_engine").set({
    enabled: true,
    engine_version: "v1",

    social_scan_limit: 25,
    mention_score_threshold: 60,

    hashtag_signal_weight: 1.2,
    influencer_signal_weight: 1.5,

    locality_weight: 1.4,
    engagement_weight: 1.1,

    created_at: FieldValue.serverTimestamp(),
    created_at_iso: nowIso,
    updated_at: FieldValue.serverTimestamp(),
    updated_at_iso: nowIso
  }, { merge: true });


  /*
  --------------------------------------------------
  SOCIAL SOURCES (INFLUENCERS / CHANNELS)
  --------------------------------------------------
  */

  await db.collection("social_sources").doc("TH_beauty_skincare_tiktok_pimtha").set({

    source_id: "TH_beauty_skincare_tiktok_pimtha",

    platform: "tiktok",

    country: "TH",
    category: "beauty_skincare",

    name: "Pimtha",
    handle: "@pimtha",
    url: "https://www.tiktok.com/@pimtha",

    language_expected: ["th"],

    follower_count: 4200000,
    engagement_estimate: 0.08,

    signal_weight: 1.2,

    active: true,
    status: "active",

    created_at: FieldValue.serverTimestamp(),
    created_at_iso: nowIso,
    updated_at: FieldValue.serverTimestamp(),
    updated_at_iso: nowIso

  }, { merge: true });


  await db.collection("social_sources").doc("TH_beauty_skincare_youtube_mintchyy").set({

    source_id: "TH_beauty_skincare_youtube_mintchyy",

    platform: "youtube",

    country: "TH",
    category: "beauty_skincare",

    name: "Mintchyy",
    handle: "@mintchyy",
    url: "https://www.youtube.com/@mintchyy",

    language_expected: ["th"],

    follower_count: 950000,
    engagement_estimate: 0.06,

    signal_weight: 1.1,

    active: true,
    status: "active",

    created_at: FieldValue.serverTimestamp(),
    created_at_iso: nowIso,
    updated_at: FieldValue.serverTimestamp(),
    updated_at_iso: nowIso

  }, { merge: true });



  /*
  --------------------------------------------------
  LOCAL HASHTAG WATCHLIST
  --------------------------------------------------
  */

  await db.collection("local_hashtag_watchlists")
    .doc("TH_beauty_skincare_main")
    .set({

      country: "TH",
      category: "beauty_skincare",

      language: "th",

      hashtags: [

        "#รีวิวสกินแคร์",
        "#แบรนด์ไทย",
        "#สกินแคร์ไทย",
        "#ของมันต้องมี",
        "#ของดีบอกต่อ",
        "#ใช้ดีบอกต่อ"

      ],

      active: true,

      created_at: FieldValue.serverTimestamp(),
      created_at_iso: nowIso,
      updated_at: FieldValue.serverTimestamp(),
      updated_at_iso: nowIso

    }, { merge: true });



  /*
  --------------------------------------------------
  SOCIAL SIGNAL RUN SAMPLE
  --------------------------------------------------
  */

  await db.collection("social_signal_runs")
    .doc("TH_beauty_skincare_sample_run")
    .set({

      run_id: "TH_beauty_skincare_sample_run",

      engine: "social_signal",
      engine_version: "v1",

      country: "TH",
      category: "beauty_skincare",

      sources_checked: 0,
      hashtags_checked: 0,

      mentions_found: 0,

      status: "READY",

      created_at: FieldValue.serverTimestamp(),
      created_at_iso: nowIso,
      updated_at: FieldValue.serverTimestamp(),
      updated_at_iso: nowIso

    }, { merge: true });



  /*
  --------------------------------------------------
  SOCIAL MENTION SAMPLE
  --------------------------------------------------
  */

  await db.collection("social_mentions")
    .doc("TH_beauty_skincare_snailwhite_sample")
    .set({

      mention_id: "TH_beauty_skincare_snailwhite_sample",

      country: "TH",
      category: "beauty_skincare",

      platform: "tiktok",
      source_handle: "pimtha",

      post_url: "",
      post_id: "",

      language_detected: "th",

      hashtags: [
        "#รีวิวสกินแคร์",
        "#สกินแคร์ไทย"
      ],

      mentioned_products: [
        "Snail White Serum"
      ],

      mentioned_brands: [
        "Snail White"
      ],

      signal_score: 0,

      engagement_hint: 0,
      locality_score: 0,

      detected_at: FieldValue.serverTimestamp(),
      detected_at_iso: nowIso

    }, { merge: true });



  console.log("✅ Social Signal Engine v1 seeded successfully.");

}

run().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});