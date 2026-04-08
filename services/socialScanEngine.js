"use strict";

const crypto = require("crypto");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");

function getDb() {
  return getFirestore();
}

function nowIso() {
  return new Date().toISOString();
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
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
  return `social_${safeId(country)}_${safeId(category)}_${Date.now()}`;
}

function normalizeWhitespace(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function stripHtml(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function splitSentences(text) {
  return normalizeWhitespace(text)
    .split(/[\n\r]+|[.!?。！？]+/g)
    .map((x) => normalizeWhitespace(x))
    .filter(Boolean);
}

function detectLanguageHeuristic(text) {
  const t = String(text || "");
  if (/[\u0E00-\u0E7F]/.test(t)) return "th";
  if (/[\u4E00-\u9FFF]/.test(t)) return "zh";
  if (/[\u3040-\u30FF]/.test(t)) return "jp";
  if (/[\uAC00-\uD7AF]/.test(t)) return "kr";
  return "en";
}

function inferPlatform(url = "") {
  const u = String(url).toLowerCase();
  if (u.includes("tiktok.com")) return "tiktok";
  if (u.includes("instagram.com")) return "instagram";
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "youtube";
  if (u.includes("facebook.com")) return "facebook";
  if (u.includes("lemon8")) return "lemon8";
  return "web";
}

function isRetailLikeUrl(url = "") {
  const u = String(url).toLowerCase();
  const blocked = [
    "shopee",
    "lazada",
    "amazon",
    "watsons",
    "sephora",
    "guardian",
    "boots",
    "tokopedia",
    "taobao",
    "tmall"
  ];
  return blocked.some((x) => u.includes(x));
}

async function getHealthySources(country, category) {
  const db = getDb();
  const now = new Date().toISOString();

  const snap = await db
    .collection("social_sources")
    .where("country", "==", String(country || "").toUpperCase())
    .where("category", "==", String(category || "").toLowerCase())
    .where("status", "==", "active")
    .get();

  return snap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((x) => {
      const withinHealthWindow =
        !x.next_health_check_at || String(x.next_health_check_at) > now;

      return (
        x.health_status === "healthy" &&
        !x.auto_disabled &&
        withinHealthWindow &&
        !isRetailLikeUrl(x.url)
      );
    });
}

async function fetchPublicSourceContent(source) {
  const url = String(source.url || "").trim();
  if (!url) {
    return {
      ok: false,
      source_text: "",
      fetch_status: null,
      error: "missing_url"
    };
  }

  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 ZapTrendLite/2.2",
        Accept: "text/html,application/xhtml+xml"
      }
    });

    const raw = await res.text();
    const cleaned = stripHtml(raw);

    return {
      ok: res.ok,
      source_text: cleaned,
      fetch_status: res.status,
      error: res.ok ? "" : `http_${res.status}`
    };
  } catch (error) {
    return {
      ok: false,
      source_text: "",
      fetch_status: null,
      error: error.message || "fetch_failed"
    };
  }
}

function getCategoryKeywordRules(category) {
  const c = String(category || "").toLowerCase();

  const commonStop = new Set([
    "review",
    "reviews",
    "favorite",
    "favourite",
    "today",
    "viral",
    "new",
    "best",
    "shopping",
    "haul",
    "creator",
    "influencer",
    "video",
    "content",
    "instagram",
    "tiktok",
    "youtube"
  ]);

  const rules = {
    beauty_skincare: {
      brands: [
        "Srichand",
        "Mizumi",
        "Cathy Doll",
        "Suu Balm",
        "Allies of Skin"
      ],
      productHints: [
        "serum",
        "sunscreen",
        "powder",
        "lip tint",
        "moisturizer",
        "cream",
        "cleanser",
        "toner"
      ]
    },
    snacks_drinks: {
      brands: ["Bento", "Mama", "Tasto", "Irvins", "TWG", "Ya Kun"],
      productHints: [
        "chips",
        "cookies",
        "tea",
        "kaya",
        "noodles",
        "roll",
        "snack",
        "drink"
      ]
    }
  };

  return {
    brands: rules[c]?.brands || [],
    productHints: rules[c]?.productHints || [],
    commonStop
  };
}

function extractMentionsFromText({
  text,
  country,
  category,
  source
}) {
  const normalizedText = normalizeWhitespace(text);
  const sentences = splitSentences(normalizedText).slice(0, 120);
  const lang = detectLanguageHeuristic(normalizedText);
  const { brands, productHints, commonStop } = getCategoryKeywordRules(category);

  const mentions = [];
  const seen = new Set();

  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();

    for (const brand of brands) {
      if (!lower.includes(brand.toLowerCase())) continue;

      let matchedHint = "";
      for (const hint of productHints) {
        if (lower.includes(hint.toLowerCase())) {
          matchedHint = hint;
          break;
        }
      }

      const product = matchedHint
        ? sentence
            .split(/[,|/()-]/)
            .map((x) => normalizeWhitespace(x))
            .find((x) => x.toLowerCase().includes(matchedHint.toLowerCase())) || matchedHint
        : "Unknown Product";

      const normalizedName = normalizeWhitespace(`${brand} ${product}`).toLowerCase();
      if (seen.has(normalizedName)) continue;
      seen.add(normalizedName);

      mentions.push({
        brand,
        product,
        normalized_name: normalizedName,
        source_text: sentence,
        detected_lang: lang,
        hashtag: "",
        local_bonus: ["th", "zh", "jp", "kr"].includes(lang) ? 10 : 6,
        exclusivity_bonus: inferExclusivityBonus(sentence, country),
        generic_penalty: inferGenericPenalty(sentence),
        platform: source.platform || inferPlatform(source.url)
      });
    }
  }

  if (mentions.length > 0) return mentions.slice(0, 8);

  // fallback lightweight extraction if no known brand matched
  const fallback = extractGenericMentions(sentences, category, source, country, lang);
  return fallback.slice(0, 6);
}

function inferExclusivityBonus(text, country) {
  const t = String(text || "").toLowerCase();
  const c = String(country || "").toLowerCase();

  const exclusivityWords = [
    "exclusive",
    "limited",
    "only in",
    "rare",
    "local find",
    "must buy",
    "travel buy",
    "popular in"
  ];

  let bonus = 0;
  if (exclusivityWords.some((x) => t.includes(x))) bonus += 8;
  if (t.includes(c)) bonus += 4;

  return bonus;
}

function inferGenericPenalty(text) {
  const t = String(text || "").toLowerCase();
  const genericWords = [
    "amazon",
    "global brand",
    "worldwide",
    "everywhere",
    "official store"
  ];
  return genericWords.some((x) => t.includes(x)) ? 10 : 0;
}

function extractGenericMentions(sentences, category, source, country, lang) {
  const hints = getCategoryKeywordRules(category).productHints;
  const mentions = [];
  const seen = new Set();

  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();

    const hint = hints.find((h) => lower.includes(h.toLowerCase()));
    if (!hint) continue;

    const words = sentence.split(/\s+/).filter(Boolean);
    const candidates = words.filter((w) => {
      const cleaned = w.replace(/[^a-zA-Z0-9\u0E00-\u0E7F\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF-]/g, "");
      if (!cleaned) return false;
      if (cleaned.length < 3) return false;
      if (/^\d+$/.test(cleaned)) return false;
      return true;
    });

    const brand = candidates[0] || "Local Find";
    const product = hint;
    const normalizedName = normalizeWhitespace(`${brand} ${product}`).toLowerCase();
    if (seen.has(normalizedName)) continue;
    seen.add(normalizedName);

    mentions.push({
      brand,
      product,
      normalized_name: normalizedName,
      source_text: sentence,
      detected_lang: lang,
      hashtag: "",
      local_bonus: ["th", "zh", "jp", "kr"].includes(lang) ? 8 : 4,
      exclusivity_bonus: inferExclusivityBonus(sentence, country),
      generic_penalty: inferGenericPenalty(sentence),
      platform: source.platform || inferPlatform(source.url)
    });
  }

  return mentions;
}

async function savePost(runId, source, country, category, mention) {
  const db = getDb();

  const normalized_name =
    mention.normalized_name ||
    `${String(mention.brand || "").trim()} ${String(mention.product || "").trim()}`
      .trim()
      .toLowerCase();

  const dedupeId = hashId(
    `${todayKey()}|${source.source_id}|${country}|${category}|${normalized_name}`
  );

  const postId = `post_${dedupeId}`;

  const payload = {
    post_id: postId,
    run_id: runId,
    source_id: source.source_id,
    platform: mention.platform || source.platform || inferPlatform(source.url),
    country: String(country || "").toUpperCase(),
    category: String(category || "").toLowerCase(),
    brand: mention.brand || "",
    product: mention.product || "",
    item_name: `${mention.brand || ""} ${mention.product || ""}`.trim(),
    normalized_name,
    hashtag: mention.hashtag || "",
    detected_lang: mention.detected_lang || "unknown",
    source_text: mention.source_text || "",
    local_bonus: Number(mention.local_bonus || 0),
    exclusivity_bonus: Number(mention.exclusivity_bonus || 0),
    generic_penalty: Number(mention.generic_penalty || 0),
    captured_day: todayKey(),
    captured_at_iso: nowIso(),
    created_at: Timestamp.now(),
    updated_at_iso: nowIso()
  };

  await db.collection("social_posts").doc(postId).set(payload, { merge: true });
  return payload;
}

async function refreshSourcePostCounts(country, category, sourceIds) {
  const db = getDb();
  const batch = db.batch();

  for (const sourceId of sourceIds) {
    const snap = await db
      .collection("social_posts")
      .where("source_id", "==", sourceId)
      .where("country", "==", String(country || "").toUpperCase())
      .where("category", "==", String(category || "").toLowerCase())
      .get();

    const ref = db.collection("social_sources").doc(sourceId);
    batch.set(
      ref,
      {
        post_count: snap.size,
        updated_at_iso: nowIso(),
        last_success_at: nowIso()
      },
      { merge: true }
    );
  }

  await batch.commit();
}

async function runSocialScan({ country, category }) {
  const db = getDb();

  const normalizedCountry = String(country || "TH").toUpperCase();
  const normalizedCategory = String(category || "beauty_skincare").toLowerCase();
  const runId = buildRunId(normalizedCountry, normalizedCategory);

  const runRef = db.collection("social_scan_runs").doc(runId);

  await runRef.set({
    run_id: runId,
    country: normalizedCountry,
    category: normalizedCategory,
    status: "RUNNING",
    started_at_iso: nowIso(),
    created_at_iso: nowIso(),
    sources_scanned: 0,
    posts_saved: 0,
    sources_failed: 0
  });

  try {
    const sources = await getHealthySources(normalizedCountry, normalizedCategory);

    let postsSaved = 0;
    let sourcesFailed = 0;
    const sourceIds = [];

    for (const source of sources) {
      sourceIds.push(source.source_id);

      const fetched = await fetchPublicSourceContent(source);
      if (!fetched.ok || !fetched.source_text) {
        sourcesFailed += 1;
        continue;
      }

      const mentions = extractMentionsFromText({
        text: fetched.source_text,
        country: normalizedCountry,
        category: normalizedCategory,
        source
      });

      for (const mention of mentions) {
        await savePost(runId, source, normalizedCountry, normalizedCategory, mention);
        postsSaved += 1;
      }
    }

    await refreshSourcePostCounts(normalizedCountry, normalizedCategory, sourceIds);

    await runRef.set(
      {
        status: "COMPLETED",
        completed_at_iso: nowIso(),
        sources_scanned: sources.length,
        posts_saved: postsSaved,
        sources_failed: sourcesFailed
      },
      { merge: true }
    );

    return {
      ok: true,
      run_id: runId,
      country: normalizedCountry,
      category: normalizedCategory,
      sources_scanned: sources.length,
      posts_saved: postsSaved,
      sources_failed: sourcesFailed
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
  runSocialScan
};