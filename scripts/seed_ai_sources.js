"use strict";

/**
 * Seed starter ai_sources for SG / MY / TH
 *
 * Run:
 *   gcloud config set project zaptrend-71814
 *   gcloud auth application-default login
 *   node seed_ai_sources.js
 */

const { Firestore, FieldValue } = require("@google-cloud/firestore");
const db = new Firestore();

const SOURCES = [
  // =========================
  // THAILAND
  // =========================
  {
    country: "TH",
    category: "beauty_skincare",
    name: "EVEANDBOY",
    type: "retail",
    url: "https://www.eveandboy.com/",
    language_expected: ["th", "en"],
    locality_score: 92,
    source_reputation_score: 80,
    status: "active",
    discovered_by: "seed",
    active: true
  },
  {
    country: "TH",
    category: "beauty_skincare",
    name: "Konvy",
    type: "retail",
    url: "https://www.konvy.com/",
    language_expected: ["th"],
    locality_score: 90,
    source_reputation_score: 78,
    status: "active",
    discovered_by: "seed",
    active: true
  },
  {
    country: "TH",
    category: "beauty_skincare",
    name: "Watsons Thailand",
    type: "retail",
    url: "https://www.watsons.co.th/",
    language_expected: ["th", "en"],
    locality_score: 84,
    source_reputation_score: 75,
    status: "active",
    discovered_by: "seed",
    active: true
  },
  {
    country: "TH",
    category: "snacks_drinks",
    name: "Tops Online Thailand",
    type: "retail",
    url: "https://www.tops.co.th/",
    language_expected: ["th", "en"],
    locality_score: 88,
    source_reputation_score: 77,
    status: "active",
    discovered_by: "seed",
    active: true
  },
  {
    country: "TH",
    category: "snacks_drinks",
    name: "Big C Thailand",
    type: "retail",
    url: "https://www.bigc.co.th/",
    language_expected: ["th"],
    locality_score: 90,
    source_reputation_score: 79,
    status: "active",
    discovered_by: "seed",
    active: true
  },
  {
    country: "TH",
    category: "souvenirs_local_finds",
    name: "Amazing Thailand",
    type: "editorial",
    url: "https://www.tourismthailand.org/",
    language_expected: ["th", "en"],
    locality_score: 93,
    source_reputation_score: 82,
    status: "active",
    discovered_by: "seed",
    active: true
  },

  // =========================
  // MALAYSIA
  // =========================
  {
    country: "MY",
    category: "beauty_skincare",
    name: "Watsons Malaysia",
    type: "retail",
    url: "https://www.watsons.com.my/",
    language_expected: ["ms", "en"],
    locality_score: 86,
    source_reputation_score: 76,
    status: "active",
    discovered_by: "seed",
    active: true
  },
  {
    country: "MY",
    category: "beauty_skincare",
    name: "Guardian Malaysia",
    type: "retail",
    url: "https://www.guardian.com.my/",
    language_expected: ["ms", "en"],
    locality_score: 85,
    source_reputation_score: 75,
    status: "active",
    discovered_by: "seed",
    active: true
  },
  {
    country: "MY",
    category: "snacks_drinks",
    name: "Jaya Grocer",
    type: "retail",
    url: "https://jgsgrocery.com/",
    language_expected: ["en", "ms"],
    locality_score: 84,
    source_reputation_score: 74,
    status: "active",
    discovered_by: "seed",
    active: true
  },
  {
    country: "MY",
    category: "snacks_drinks",
    name: "Lazada Malaysia Groceries",
    type: "marketplace",
    url: "https://www.lazada.com.my/",
    language_expected: ["en", "ms"],
    locality_score: 72,
    source_reputation_score: 68,
    status: "active",
    discovered_by: "seed",
    active: true
  },
  {
    country: "MY",
    category: "souvenirs_local_finds",
    name: "Malaysia Truly Asia",
    type: "editorial",
    url: "https://www.malaysia.travel/",
    language_expected: ["en"],
    locality_score: 93,
    source_reputation_score: 81,
    status: "active",
    discovered_by: "seed",
    active: true
  },

  // =========================
  // SINGAPORE
  // =========================
  {
    country: "SG",
    category: "beauty_skincare",
    name: "Guardian Singapore",
    type: "retail",
    url: "https://www.guardian.com.sg/",
    language_expected: ["en"],
    locality_score: 82,
    source_reputation_score: 74,
    status: "active",
    discovered_by: "seed",
    active: true
  },
  {
    country: "SG",
    category: "beauty_skincare",
    name: "Watsons Singapore",
    type: "retail",
    url: "https://www.watsons.com.sg/",
    language_expected: ["en"],
    locality_score: 82,
    source_reputation_score: 74,
    status: "active",
    discovered_by: "seed",
    active: true
  },
  {
    country: "SG",
    category: "snacks_drinks",
    name: "FairPrice Online",
    type: "retail",
    url: "https://www.fairprice.com.sg/",
    language_expected: ["en"],
    locality_score: 85,
    source_reputation_score: 78,
    status: "active",
    discovered_by: "seed",
    active: true
  },
  {
    country: "SG",
    category: "snacks_drinks",
    name: "Cold Storage Singapore",
    type: "retail",
    url: "https://coldstorage.com.sg/",
    language_expected: ["en"],
    locality_score: 80,
    source_reputation_score: 72,
    status: "active",
    discovered_by: "seed",
    active: true
  },
  {
    country: "SG",
    category: "souvenirs_local_finds",
    name: "Visit Singapore",
    type: "editorial",
    url: "https://www.visitsingapore.com/",
    language_expected: ["en", "zh-Hans"],
    locality_score: 94,
    source_reputation_score: 83,
    status: "active",
    discovered_by: "seed",
    active: true
  }
];

function makeId(source) {
  const base = `${source.country}_${source.category}_${source.name}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return base;
}

async function main() {
  let count = 0;

  for (const s of SOURCES) {
    const id = makeId(s);
    await db.collection("ai_sources").doc(id).set(
      {
        source_id: id,
        country: s.country,
        category: s.category,
        name: s.name,
        type: s.type,
        url: s.url,
        language_expected: s.language_expected,
        locality_score: s.locality_score,
        source_reputation_score: s.source_reputation_score,
        quality_score: s.source_reputation_score,
        status: s.status,
        discovered_by: s.discovered_by,
        active: s.active,
        trial_runs_remaining: 0,
        fail_count: 0,
        success_count: 0,
        avg_candidates_per_fetch: 0,
        notes: "",
        tags: [],
        created_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp()
      },
      { merge: true }
    );
    count++;
  }

  console.log(`✅ Seeded/updated ${count} ai_sources docs.`);
}

main().catch((err) => {
  console.error("❌ seed_ai_sources failed:", err);
  process.exit(1);
});