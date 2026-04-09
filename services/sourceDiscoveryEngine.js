"use strict";

const crypto = require("crypto");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const { getDiscoveryConfig } = require("../config/discoveryMatrix");

function getDb() {
  return getFirestore();
}

function nowIso() {
  return new Date().toISOString();
}

function addDaysIso(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + Number(days || 0));
  return d.toISOString();
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

function normalizeWhitespace(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function guessPlatform(url = "") {
  const u = String(url).toLowerCase();
  if (u.includes("tiktok.com")) return "tiktok";
  if (u.includes("instagram.com")) return "instagram";
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "youtube";
  if (u.includes("facebook.com")) return "facebook";
  if (u.includes("lemon8")) return "lemon8";
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
    "mall",
    "amazon",
    "shopee",
    "lazada",
    "tokopedia",
    "taobao",
    "tmall"
  ];
  return blocked.some((x) => text.includes(x));
}

function isAllowedCreatorUrl(url = "") {
  const u = String(url).toLowerCase();

  const allowed =
    u.includes("instagram.com/") ||
    u.includes("tiktok.com/@") ||
    u.includes("youtube.com/@") ||
    u.includes("youtube.com/c/") ||
    u.includes("youtube.com/channel/") ||
    u.includes("facebook.com/") ||
    u.includes("lemon8-app.com/") ||
    u.includes("lemon8.") ||
    /^https?:\/\/[^/]+/.test(u);

  if (!allowed) return false;

  const blocked = [
    "/p/",
    "/reel/",
    "/reels/",
    "/explore",
    "/video/",
    "/videos/",
    "/shop",
    "/shopping",
    "/product",
    "/products",
    "/search",
    "/hashtag",
    "/tag/",
    "/tags/",
    "amazon.",
    "shopee.",
    "lazada.",
    "tokopedia.",
    "taobao.",
    "tmall.",
    "watsons",
    "guardian",
    "sephora"
  ];

  return !blocked.some((x) => u.includes(x));
}

function decodeHtmlEntities(text = "") {
  return String(text)
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripHtml(html) {
  return normalizeWhitespace(
    String(html || "")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  );
}

function canRetrySource(existing) {
  const now = new Date().toISOString();
  const retryAt = String(existing?.next_health_check_at || "");
  if (!retryAt) return true;
  return retryAt <= now;
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

  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 ZapTrendLite/3.0",
        Accept: "text/html,application/xhtml+xml"
      }
    });

    if (!res.ok) {
      return {
        ok: false,
        health_status: "unavailable",
        health_http_status: res.status,
        reason: `http_${res.status}`
      };
    }

    const html = await res.text();
    const text = stripHtml(html).slice(0, 500);

    if (!text || text.length < 20) {
      return {
        ok: false,
        health_status: "unavailable",
        health_http_status: res.status,
        reason: "empty_page"
      };
    }

    return {
      ok: true,
      health_status: "healthy",
      health_http_status: res.status,
      reason: ""
    };
  } catch (error) {
    return {
      ok: false,
      health_status: "unavailable",
      health_http_status: null,
      reason: error.message || "fetch_failed"
    };
  }
}

function computeNextHealthCheck(existing, healthOk) {
  if (healthOk) return addDaysIso(7);

  const failCount = Number(existing?.health_fail_count || 0) + 1;
  if (failCount >= 2) return addDaysIso(30);
  return addDaysIso(14);
}

async function upsertSource({
  source,
  country,
  category,
  health,
  discoveredBy = "phase3_real_discovery"
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
    next_health_check_at: computeNextHealthCheck(existing, health.ok),
    health_fail_count: failCount,
    auto_disabled: autoDisabled,
    auto_disabled_reason: autoDisabled ? health.reason || "health_check_failed" : "",

    last_checked: nowIso(),
    last_success_at: health.ok ? nowIso() : existing.last_success_at || null,
    last_fail_at: health.ok ? existing.last_fail_at || null : nowIso(),

    discovery_queries: source.discovery_queries || [],
    yield_score: Number(existing.yield_score || 0),
    low_yield_count: Number(existing.low_yield_count || 0),
    updated_at_iso: nowIso(),
    created_at_iso: existing.created_at_iso || nowIso(),
    created_at: existing.created_at || Timestamp.now()
  };

  await ref.set(payload, { merge: true });
  return payload;
}

async function runScheduledHealthRecheck(country, category) {
  const db = getDb();
  const now = new Date().toISOString();

  const snap = await db
    .collection("social_sources")
    .where("country", "==", String(country || "").toUpperCase())
    .where("category", "==", String(category || "").toLowerCase())
    .get();

  let healthyCount = 0;
  let unhealthyCount = 0;
  let checkedCount = 0;

  for (const doc of snap.docs) {
    const source = { id: doc.id, ...doc.data() };
    const due = !source.next_health_check_at || String(source.next_health_check_at) <= now;

    if (!due) continue;

    checkedCount += 1;
    const health = await checkSourceHealth(source);
    await upsertSource({
      source,
      country,
      category,
      health,
      discoveredBy: source.discovered_by || "phase3_real_discovery"
    });

    if (health.ok) healthyCount += 1;
    else unhealthyCount += 1;
  }

  return {
    checked_count: checkedCount,
    rehealthy_count: healthyCount,
    reunhealthy_count: unhealthyCount
  };
}

async function fetchSearchResults(query) {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 ZapTrendLite/3.0",
        Accept: "text/html,application/xhtml+xml"
      }
    });

    if (!res.ok) return [];

    const html = await res.text();
    return extractSearchCandidatesFromHtml(html);
  } catch {
    return [];
  }
}

function normalizeDiscoveredUrl(rawUrl = "") {
  const url = decodeHtmlEntities(rawUrl).trim();

  if (!url) return "";
  if (!/^https?:\/\//i.test(url)) return "";

  try {
    const u = new URL(url);
    u.hash = "";
    return u.toString();
  } catch {
    return "";
  }
}

function extractSearchCandidatesFromHtml(html = "") {
  const results = [];
  const seen = new Set();

  const anchorRegex = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = anchorRegex.exec(html)) !== null) {
    const href = normalizeDiscoveredUrl(match[1]);
    const label = stripHtml(match[2]);

    if (!href) continue;
    if (!isAllowedCreatorUrl(href)) continue;
    if (seen.has(href)) continue;
    seen.add(href);

    results.push({
      url: href,
      label
    });
  }

  return results.slice(0, 20);
}

function deriveHandleFromUrl(url = "", platform = "web") {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);

    if (platform === "tiktok") {
      const handle = parts.find((p) => p.startsWith("@"));
      return handle || "";
    }

    if (platform === "instagram") {
      return parts[0] ? `@${parts[0].replace(/^@/, "")}` : "";
    }

    if (platform === "youtube") {
      if (parts[0] === "@" && parts[1]) return `@${parts[1]}`;
      if (parts[0] && parts[0].startsWith("@")) return parts[0];
      return parts[parts.length - 1] || "";
    }

    if (platform === "facebook" || platform === "lemon8" || platform === "web") {
      return parts[parts.length - 1] || "";
    }

    return parts[parts.length - 1] || "";
  } catch {
    return "";
  }
}

function deriveDisplayName(candidate) {
  const label = normalizeWhitespace(candidate.label || "");
  if (label && label.length >= 3) return label.slice(0, 120);

  const platform = guessPlatform(candidate.url);
  const handle = deriveHandleFromUrl(candidate.url, platform);
  return handle || candidate.url;
}

function buildCandidateSource(candidate, country, category, discoveryQueries) {
  const platform = guessPlatform(candidate.url);
  const handle = deriveHandleFromUrl(candidate.url, platform);
  const display_name = deriveDisplayName(candidate);

  const sourceKey = hashId(`${country}|${category}|${candidate.url}`);

  return {
    source_id: `${safeId(country)}_${safeId(category)}_${sourceKey}`,
    display_name,
    handle,
    url: candidate.url,
    platform,
    discovery_queries: discoveryQueries || []
  };
}

async function discoverRealCandidates(country, category) {
  const config = getDiscoveryConfig(country, category);
  const queries = config.discovery_queries || [];

  const collected = [];
  const seen = new Set();

  for (const query of queries.slice(0, 8)) {
    const candidates = await fetchSearchResults(query);

    for (const candidate of candidates) {
      if (!candidate.url) continue;
      if (seen.has(candidate.url)) continue;
      seen.add(candidate.url);

      collected.push(
        buildCandidateSource(candidate, country, category, queries)
      );
    }
  }

  return collected.slice(0, 20);
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
    skipped_count: 0,
    checked_count: 0
  });

  try {
    let candidates = await discoverRealCandidates(normalizedCountry, normalizedCategory);

    // fallback to config seed sources only if real discovery found nothing
    if (!candidates.length) {
      const config = getDiscoveryConfig(normalizedCountry, normalizedCategory);
      candidates = (config.seed_sources || []).map((seed) => ({
        ...seed,
        discovery_queries: config.discovery_queries || []
      }));
    }

    let discoveredCount = 0;
    let healthyCount = 0;
    let unhealthyCount = 0;
    let skippedCount = 0;

    for (const candidate of candidates) {
      const existingSnap = await db.collection("social_sources").doc(candidate.source_id).get();

      if (existingSnap.exists) {
        const existing = existingSnap.data() || {};

        if (existing.auto_disabled && !canRetrySource(existing)) {
          skippedCount += 1;
          continue;
        }

        if (
          existing.health_status === "low_yield" &&
          Number(existing.low_yield_count || 0) >= 3 &&
          !canRetrySource(existing)
        ) {
          skippedCount += 1;
          continue;
        }
      }

      if (isRetailBrandCandidate(candidate)) {
        skippedCount += 1;
        continue;
      }

      const health = await checkSourceHealth(candidate);

      await upsertSource({
        source: candidate,
        country: normalizedCountry,
        category: normalizedCategory,
        health
      });

      discoveredCount += 1;
      if (health.ok) healthyCount += 1;
      else unhealthyCount += 1;
    }

    const recheck = await runScheduledHealthRecheck(normalizedCountry, normalizedCategory);

    await runRef.set(
      {
        status: "COMPLETED",
        completed_at_iso: nowIso(),
        discovered_count: discoveredCount,
        healthy_count: healthyCount,
        unhealthy_count: unhealthyCount,
        skipped_count: skippedCount,
        checked_count: recheck.checked_count,
        rehealthy_count: recheck.rehealthy_count,
        reunhealthy_count: recheck.reunhealthy_count
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
      skipped_count: skippedCount,
      checked_count: recheck.checked_count
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