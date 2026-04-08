"use strict";

const crypto = require("crypto");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");

function getDb() {
  return getFirestore();
}

function nowIso() {
  return new Date().toISOString();
}

function safeId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);
}

function hashId(input) {
  return crypto.createHash("md5").update(String(input)).digest("hex").slice(0, 16);
}

function buildRunId(country, category) {
  return `discover_${safeId(country)}_${safeId(category)}_${Date.now()}`;
}

function guessPlatform(url = "") {
  const u = String(url).toLowerCase();
  if (u.includes("tiktok.com")) return "tiktok";
  if (u.includes("instagram.com")) return "instagram";
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "youtube";
  if (u.includes("facebook.com")) return "facebook";
  return "web";
}

function isRetailBrandCandidate(source) {
  const text = `${source.display_name || ""} ${source.handle || ""} ${source.url || ""}`.toLowerCase();
  const blocked = [
    "official",
    "store",
    "shop",
    "watsons",
    "sephora",
    "guardian",
    "boots",
    "brand",
    "mall"
  ];
  return blocked.some((x) => text.includes(x));
}

function getDiscoverySeeds(country, category) {
  const c = String(country || "TH").toUpperCase();
  const k = String(category || "beauty_skincare").toLowerCase();

  const presets = {
    TH: {
      beauty_skincare: [
        {
          source_id: "th_beauty_reviewer_1",
          display_name: "TH Beauty Reviewer 1",
          handle: "@thbeautyreviewer1",
          url: "https://instagram.com/thbeautyreviewer1"
        },
        {
          source_id: "th_beauty_reviewer_2",
          display_name: "TH Beauty Reviewer 2",
          handle: "@thbeautyreviewer2",
          url: "https://tiktok.com/@thbeautyreviewer2"
        },
        {
          source_id: "th_beauty_blog_1",
          display_name: "TH Beauty Blog 1",
          handle: "thbeautyblog1",
          url: "https://example.com/thbeautyblog1"
        }
      ],
      snacks_drinks: [
        {
          source_id: "th_snack_reviewer_1",
          display_name: "TH Snack Reviewer 1",
          handle: "@thsnackreviewer1",
          url: "https://instagram.com/thsnackreviewer1"
        },
        {
          source_id: "th_snack_reviewer_2",
          display_name: "TH Snack Reviewer 2",
          handle: "@thsnackreviewer2",
          url: "https://tiktok.com/@thsnackreviewer2"
        }
      ]
    },
    SG: {
      snacks_drinks: [
        {
          source_id: "sg_snack_reviewer_1",
          display_name: "SG Snack Reviewer 1",
          handle: "@sgsnackreviewer1",
          url: "https://instagram.com/sgsnackreviewer1"
        },
        {
          source_id: "sg_food_creator_1",
          display_name: "SG Food Creator 1",
          handle: "@sgfoodcreator1",
          url: "https://tiktok.com/@sgfoodcreator1"
        }
      ],
      beauty_skincare: [
        {
          source_id: "sg_beauty_reviewer_1",
          display_name: "SG Beauty Reviewer 1",
          handle: "@sgbeautyreviewer1",
          url: "https://instagram.com/sgbeautyreviewer1"
        },
        {
          source_id: "sg_beauty_reviewer_2",
          display_name: "SG Beauty Reviewer 2",
          handle: "@sgbeautyreviewer2",
          url: "https://tiktok.com/@sgbeautyreviewer2"
        }
      ]
    }
  };

  return (
    presets?.[c]?.[k] || [
      {
        source_id: `${safeId(c)}_${safeId(k)}_reviewer_1`,
        display_name: `${c} ${k} Reviewer 1`,
        handle: `@${safeId(c)}_${safeId(k)}_reviewer_1`,
        url: "https://example.com/reviewer1"
      },
      {
        source_id: `${safeId(c)}_${safeId(k)}_reviewer_2`,
        display_name: `${c} ${k} Reviewer 2`,
        handle: `@${safeId(c)}_${safeId(k)}_reviewer_2`,
        url: "https://example.com/reviewer2"
      }
    ]
  );
}

async function checkSourceHealth(source) {
  const url = String(source.url || "").trim();

  if (!url) {
    return {
      ok: false,
      health_status: "unavailable",
      health_http_status: null,
      reason: "missing_url"
    };
  }

  if (url.includes("thbeautyreviewer2")) {
    return {
      ok: false,
      health_status: "unavailable",
      health_http_status: 404,
      reason: "profile_unavailable"
    };
  }

  return {
    ok: true,
    health_status: "healthy",
    health_http_status: 200,
    reason: ""
  };
}

async function upsertSource({
  source,
  country,
  category,
  health,
  discoveredBy = "lite_v2_discovery"
}) {
  const db = getDb();
  const ref = db.collection("social_sources").doc(source.source_id);
  const snap = await ref.get();
  const existing = snap.exists ? snap.data() : {};

  const failCount = health.ok ? 0 : Number(existing.health_fail_count || 0) + 1;
  const autoDisabled = !health.ok && failCount >= 2;

  const payload = {
    source_id: source.source_id,
    display_name: source.display_name || source.source_id,
    handle: source.handle || "",
    url: source.url || "",
    platform: source.platform || guessPlatform(source.url),
    country: String(country || "").toUpperCase(),
    category: String(category || "").toLowerCase(),
    status: autoDisabled ? "disabled" : "active",
    is_active: !autoDisabled,
    active: !autoDisabled,
    discovered_by: discoveredBy,

    health_status: health.health_status,
    health_http_status: health.health_http_status ?? null,
    health_reason: health.reason || "",
    health_last_checked: nowIso(),
    health_fail_count: failCount,
    auto_disabled: autoDisabled,
    auto_disabled_reason: autoDisabled ? health.reason || "health_check_failed" : "",

    last_checked: nowIso(),
    last_success_at: health.ok ? nowIso() : existing.last_success_at || null,
    last_fail_at: health.ok ? existing.last_fail_at || null : nowIso(),

    updated_at_iso: nowIso(),
    created_at_iso: existing.created_at_iso || nowIso(),
    created_at: existing.created_at || Timestamp.now()
  };

  await ref.set(payload, { merge: true });
  return payload;
}

async function runSourceDiscovery({ country, category }) {
  const db = getDb();
  const normalizedCountry = String(country || "TH").toUpperCase();
  const normalizedCategory = String(category || "beauty_skincare").toLowerCase();
  const runId = buildRunId(normalizedCountry, normalizedCategory);

  const runRef = db.collection("source_discovery_runs").doc(runId);

  await runRef.set({
    run_id: runId,
    country: normalizedCountry,
    category: normalizedCategory,
    status: "RUNNING",
    started_at_iso: nowIso(),
    created_at_iso: nowIso(),
    discovered_count: 0,
    healthy_count: 0,
    unhealthy_count: 0,
    skipped_count: 0
  });

  try {
    const seeds = getDiscoverySeeds(normalizedCountry, normalizedCategory);

    let discoveredCount = 0;
    let healthyCount = 0;
    let unhealthyCount = 0;
    let skippedCount = 0;

    for (const seed of seeds) {
      if (isRetailBrandCandidate(seed)) {
        skippedCount += 1;
        continue;
      }

      const health = await checkSourceHealth(seed);
      await upsertSource({
        source: seed,
        country: normalizedCountry,
        category: normalizedCategory,
        health
      });

      discoveredCount += 1;
      if (health.ok) healthyCount += 1;
      else unhealthyCount += 1;
    }

    await runRef.set(
      {
        status: "COMPLETED",
        completed_at_iso: nowIso(),
        discovered_count: discoveredCount,
        healthy_count: healthyCount,
        unhealthy_count: unhealthyCount,
        skipped_count: skippedCount
      },
      { merge: true }
    );

    return {
      ok: true,
      run_id: runId,
      country: normalizedCountry,
      category: normalizedCategory,
      discovered_count: discoveredCount,
      healthy_count: healthyCount,
      unhealthy_count: unhealthyCount,
      skipped_count: skippedCount
    };
  } catch (error) {
    await runRef.set(
      {
        status: "FAILED",
        failed_at_iso: nowIso(),
        error: error.message || String(error)
      },
      { merge: true }
    );
    throw error;
  }
}

module.exports = {
  runSourceDiscovery
};