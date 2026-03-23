"use strict";

/**
 * ZapTrend Firestore Seed Injection
 * - Creates:
 *   config/coverage
 *   config/engine
 *   ref_countries/{CC}
 *   ref_categories/{categoryId}
 *
 * How to run:
 *   1) gcloud config set project zaptrend-71814
 *   2) gcloud auth application-default login
 *   3) node seed_firestore.js
 */

const { Firestore, FieldValue } = require("@google-cloud/firestore");

const db = new Firestore();

const CATEGORIES = [
  "baby_kids",
  "beauty_skincare",
  "deals_duty_free",
  "electronics_gadgets",
  "fashion_accessories",
  "health_pharmacy",
  "home_living",
  "luxury_designer",
  "other",
  "snacks_drinks",
  "souvenirs_local_finds",
  "sports_outdoors",
  "stationery_books",
  "toys_collectibles"
];

const COUNTRIES = [
  { cc: "HK", name: "Hong Kong",    languages: ["zh-Hant", "en"], currency: "HKD" },
  { cc: "TH", name: "Thailand",     languages: ["th", "en"],      currency: "THB" },
  { cc: "SG", name: "Singapore",    languages: ["en", "zh-Hans"], currency: "SGD" },
  { cc: "VN", name: "Vietnam",      languages: ["vi", "en"],      currency: "VND" },
  { cc: "KH", name: "Cambodia",     languages: ["km", "en"],      currency: "KHR" },
  { cc: "CN", name: "China",        languages: ["zh-Hans"],       currency: "CNY" },
  { cc: "TW", name: "Taiwan",       languages: ["zh-Hant"],       currency: "TWD" },
  { cc: "KR", name: "South Korea",  languages: ["ko", "en"],      currency: "KRW" },
  { cc: "JP", name: "Japan",        languages: ["ja", "en"],      currency: "JPY" },
  { cc: "AU", name: "Australia",    languages: ["en"],           currency: "AUD" },
  { cc: "ID", name: "Indonesia",    languages: ["id", "en"],      currency: "IDR" },
  { cc: "IN", name: "India",        languages: ["hi", "en"],      currency: "INR" },
  { cc: "MM", name: "Myanmar",      languages: ["my", "en"],      currency: "MMK" },
  { cc: "MY", name: "Malaysia",     languages: ["ms", "en"],      currency: "MYR" },
  { cc: "PH", name: "Philippines",  languages: ["tl", "en"],      currency: "PHP" }
];

function nowISO() {
  return new Date().toISOString();
}

async function upsertDoc(path, data) {
  await db.doc(path).set(
    {
      ...data,
      updated_at: FieldValue.serverTimestamp(),
      updated_at_iso: nowISO()
    },
    { merge: true }
  );
}

async function createIfMissing(path, data) {
  const ref = db.doc(path);
  const snap = await ref.get();
  if (snap.exists) return false;
  await ref.set({
    ...data,
    created_at: FieldValue.serverTimestamp(),
    created_at_iso: nowISO(),
    updated_at: FieldValue.serverTimestamp(),
    updated_at_iso: nowISO()
  });
  return true;
}

async function main() {
  // ---- config docs ----
  // (You can change these later without redeploy by editing Firestore.)
  const coverage = {
    enabled: true,
    refresh_frequency: "daily",
    countries_enabled: COUNTRIES.map((c) => c.cc),
    categories_enabled: CATEGORIES,
    // optional toggles
    local_first: true,
    allow_source_auto_discovery: true,
    allow_candidate_sources: true
  };

  const engine = {
    engine_version: "v1",
    region: "asia-southeast1",
    items_per_run: 5,
    candidate_window_days: 45,
    trend_active_window_days: 30,
    source_trial_runs: 3,
    // scoring knobs (placeholders; we’ll tune later)
    scoring_weights: {
      freshness: 0.30,
      cross_source_confirm: 0.25,
      source_reputation: 0.20,
      ai_exclusivity: 0.15,
      optional_hashtag_signal: 0.10
    }
  };

  await upsertDoc("config/coverage", coverage);
  await upsertDoc("config/engine", engine);

  // ---- reference collections ----
  // Countries reference
  for (const c of COUNTRIES) {
    await upsertDoc(`ref_countries/${c.cc}`, {
      cc: c.cc,
      name: c.name,
      languages: c.languages,
      currency: c.currency,
      enabled_default: true
    });
  }

  // Categories reference
  for (const cat of CATEGORIES) {
    await upsertDoc(`ref_categories/${cat}`, {
      category_id: cat,
      enabled_default: true,
      // optional future fields
      display_name: cat.replace(/_/g, " "),
      version: 1
    });
  }

  // ---- optional: create empty “stats” doc for your future dashboard ----
  await createIfMissing("stats/overview", {
    engine: "zaptrend",
    engine_version: "v1",
    note: "Auto-created. This doc can be updated by your daily jobs for dashboard stats.",
    total_runs: 0,
    total_items: 0
  });

  console.log("✅ Seed completed.");
  console.log("Created/updated:");
  console.log("- config/coverage");
  console.log("- config/engine");
  console.log(`- ref_countries (${COUNTRIES.length})`);
  console.log(`- ref_categories (${CATEGORIES.length})`);
  console.log("- stats/overview");
}

main().catch((e) => {
  console.error("❌ Seed failed:", e);
  process.exit(1);
});