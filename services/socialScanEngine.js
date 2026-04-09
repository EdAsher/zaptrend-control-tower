"use strict";

const crypto = require("crypto");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const { getCategoryDictionary } = require("../config/categoryDictionaries");

function getDb() {
  return getFirestore();
}

function nowIso() {
  return new Date().toISOString();
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIsoSafe(days) {
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
  return `social_${safeId(country)}_${safeId(category)}_${Date.now()}`;
}

function normalizeWhitespace(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function normalizeToken(text) {
  return normalizeWhitespace(text)
    .toLowerCase()
    .replace(/[^a-z0-9\u0E00-\u0E7F\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF\s-]/g, "")
    .trim();
}

function decodeHtmlEntities(text = "") {
  return String(text)
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function stripHtml(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<[^>]+>/g, " ")
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

function getBlockedTerms() {
  return new Set([
    "instagram",
    "tiktok",
    "youtube",
    "facebook",
    "lemon8",
    "creator",
    "creators",
    "influencer",
    "review",
    "reviews",
    "video",
    "videos",
    "viral",
    "shopping",
    "shop",
    "official",
    "follow",
    "like",
    "comment",
    "share",
    "homepage",
    "profile",
    "login",
    "sign in",
    "sign up",
    "home",
    "feed",
    "post",
    "posts",
    "explore",
    "reels",
    "shorts",
    "watch",
    "channel"
  ]);
}

function getCategoryKeywordRules(category) {
  const dict = getCategoryDictionary(category);

  return {
    brands: dict.brands || [],
    productHints: dict.productHints || []
  };
}

function hasCategoryHint(text, category) {
  const t = normalizeToken(text);
  const rules = getCategoryKeywordRules(category);

  return rules.productHints.some((hint) =>
    t.includes(normalizeToken(hint))
  );
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

  let sources = snap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((x) => {
      const withinHealthWindow =
        !x.next_health_check_at || String(x.next_health_check_at) > now;

      return (
        !x.auto_disabled &&
        withinHealthWindow &&
        !isRetailLikeUrl(x.url) &&
        (x.health_status === "healthy" || x.health_status === "low_yield")
      );
    });

  sources.sort((a, b) => Number(b.yield_score || 0) - Number(a.yield_score || 0));

  const healthy = sources.filter((x) => x.health_status === "healthy");
  const lowYield = sources.filter((x) => x.health_status === "low_yield");

  const prioritized = [...healthy.slice(0, 8)];

  if (prioritized.length < 3) {
    const fallback = lowYield.slice(0, 2);
    for (const src of fallback) {
      if (!prioritized.find((x) => x.source_id === src.source_id)) {
        prioritized.push(src);
      }
    }
  }

  return prioritized.slice(0, 10);
}

function extractMetaContent(html, attr, value) {
  const patterns = [
    new RegExp(`<meta[^>]+${attr}=["']${value}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+${attr}=["']${value}["'][^>]*>`, "i")
  ];

  for (const regex of patterns) {
    const match = String(html || "").match(regex);
    if (match) return normalizeWhitespace(decodeHtmlEntities(match[1]));
  }

  return "";
}

function extractTitle(html) {
  const match = String(html || "").match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? normalizeWhitespace(decodeHtmlEntities(stripHtml(match[1]))) : "";
}

function extractJsonLdText(html) {
  const matches = Array.from(
    String(html || "").matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
  );

  if (!matches.length) return "";

  const chunks = matches
    .map((m) => decodeHtmlEntities(stripHtml(m[1])))
    .filter(Boolean);

  return normalizeWhitespace(chunks.join(" "));
}

function extractInterestingTextBlocks(html) {
  const clean = String(html || "");

  const blocks = [];

  const regexes = [
    /<h1[^>]*>([\s\S]*?)<\/h1>/gi,
    /<h2[^>]*>([\s\S]*?)<\/h2>/gi,
    /<h3[^>]*>([\s\S]*?)<\/h3>/gi,
    /<p[^>]*>([\s\S]*?)<\/p>/gi
  ];

  for (const regex of regexes) {
    const matches = Array.from(clean.matchAll(regex));
    for (const m of matches) {
      const text = normalizeWhitespace(decodeHtmlEntities(stripHtml(m[1])));
      if (text.length >= 12) blocks.push(text);
    }
  }

  return normalizeWhitespace(blocks.slice(0, 60).join(" "));
}

function extractYouTubeStructuredText(html) {
  const title = extractTitle(html);
  const ogTitle = extractMetaContent(html, "property", "og:title");
  const ogDesc = extractMetaContent(html, "property", "og:description");
  const metaDesc = extractMetaContent(html, "name", "description");
  const keywords = extractMetaContent(html, "name", "keywords");
  const jsonLd = extractJsonLdText(html);

  const text = normalizeWhitespace(
    [title, ogTitle, ogDesc, metaDesc, keywords, jsonLd]
      .filter(Boolean)
      .join(" ")
  );

  return text;
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

  const platform = inferPlatform(url);

  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 ZapTrendLite/4.0",
        Accept: "text/html,application/xhtml+xml"
      }
    });

    const raw = await res.text();

    let mergedText = "";

    if (platform === "youtube") {
      mergedText = extractYouTubeStructuredText(raw);
    } else if (["instagram", "tiktok", "facebook", "lemon8"].includes(platform)) {
      const title = extractTitle(raw);
      const ogTitle = extractMetaContent(raw, "property", "og:title");
      const ogDesc = extractMetaContent(raw, "property", "og:description");
      const metaDesc = extractMetaContent(raw, "name", "description");
      const jsonLd = extractJsonLdText(raw);

      mergedText = normalizeWhitespace(
        [title, ogTitle, ogDesc, metaDesc, jsonLd]
          .filter(Boolean)
          .join(" ")
      );
    } else {
      const title = extractTitle(raw);
      const ogTitle = extractMetaContent(raw, "property", "og:title");
      const ogDesc = extractMetaContent(raw, "property", "og:description");
      const metaDesc = extractMetaContent(raw, "name", "description");
      const jsonLd = extractJsonLdText(raw);
      const interestingBlocks = extractInterestingTextBlocks(raw);
      const bodyText = normalizeWhitespace(decodeHtmlEntities(stripHtml(raw)));

      mergedText = normalizeWhitespace(
        [title, ogTitle, ogDesc, metaDesc, jsonLd, interestingBlocks, bodyText]
          .filter(Boolean)
          .join(" ")
      );
    }

    if (!mergedText || mergedText.length < 40) {
      const fallback = normalizeWhitespace(decodeHtmlEntities(stripHtml(raw))).slice(0, 1200);
      mergedText = fallback;
    }

    return {
      ok: res.ok,
      source_text: mergedText,
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
    "popular in",
    "ของหายาก",
    "เฉพาะ",
    "ของฝาก"
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
    "official store",
    "buy now",
    "checkout"
  ];
  return genericWords.some((x) => t.includes(x)) ? 10 : 0;
}

function candidateBrandProductFromSentence(sentence, hint) {
  const parts = normalizeWhitespace(sentence).split(/\s+/);
  const clean = parts
    .map((w) => w.replace(/[^a-zA-Z0-9\u0E00-\u0E7F\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF-]/g, ""))
    .filter(Boolean);

  const hintIndex = clean.findIndex((x) => x.toLowerCase() === String(hint).toLowerCase());

  if (hintIndex > 0) {
    return {
      brand: clean[hintIndex - 1] || "Local Find",
      product: hint
    };
  }

  return {
    brand: clean[0] || "Local Find",
    product: hint
  };
}

function containsPlatformGarbage(text) {
  const t = normalizeToken(text);
  const blockedPhrases = [
    "youtube channel",
    "watch now",
    "subscribe",
    "follow me",
    "instagram",
    "tiktok",
    "facebook",
    "lemon8"
  ];
  return blockedPhrases.some((x) => t.includes(normalizeToken(x)));
}

function isLowQualityMention(mention, category) {
  const blocked = getBlockedTerms();

  const brand = normalizeToken(mention.brand);
  const product = normalizeToken(mention.product);
  const itemName = normalizeToken(mention.item_name || `${mention.brand} ${mention.product}`);
  const sourceText = normalizeToken(mention.source_text);

  if (!brand || !product) return true;
  if (brand.length < 3 || product.length < 3) return true;

  if (blocked.has(brand) || blocked.has(product)) return true;
  if (itemName && blocked.has(itemName)) return true;

  if (brand === product && blocked.has(brand)) return true;
  if (brand === product && brand.length < 5) return true;

  if (itemName === "instagram instagram" || itemName === "tiktok tiktok") return true;
  if (containsPlatformGarbage(sourceText)) return true;

  if (!hasCategoryHint(sourceText, category)) {
    const rules = getCategoryKeywordRules(category);
    const knownBrandHit = rules.brands.some(
      (b) => normalizeToken(sourceText).includes(normalizeToken(b))
    );
    if (!knownBrandHit) return true;
  }

  return false;
}

function finalizeMention(rawMention, category) {
  const mention = {
    ...rawMention,
    brand: normalizeWhitespace(rawMention.brand),
    product: normalizeWhitespace(rawMention.product),
    item_name: normalizeWhitespace(`${rawMention.brand || ""} ${rawMention.product || ""}`),
    normalized_name: normalizeWhitespace(
      rawMention.normalized_name || `${rawMention.brand || ""} ${rawMention.product || ""}`
    ).toLowerCase()
  };

  if (isLowQualityMention(mention, category)) return null;
  return mention;
}

function extractMentionsFromText({
  text,
  country,
  category,
  source
}) {
  const normalizedText = normalizeWhitespace(text);
  const sentences = splitSentences(normalizedText).slice(0, 250);
  const lang = detectLanguageHeuristic(normalizedText);
  const { brands, productHints } = getCategoryKeywordRules(category);

  const rawMentions = [];
  const seen = new Set();

  // pass 1: known brand + product hints
  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();

    for (const brand of brands) {
      if (!lower.includes(String(brand).toLowerCase())) continue;

      let matchedHint = "";
      for (const hint of productHints) {
        if (lower.includes(String(hint).toLowerCase())) {
          matchedHint = hint;
          break;
        }
      }

      const product = matchedHint || "featured item";
      const normalizedName = normalizeWhitespace(`${brand} ${product}`).toLowerCase();
      if (seen.has(normalizedName)) continue;
      seen.add(normalizedName);

      rawMentions.push({
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

  // pass 2: product-hint fallback
  if (rawMentions.length < 3) {
    for (const sentence of sentences) {
      const lower = sentence.toLowerCase();

      const matchedHint = productHints.find((hint) =>
        lower.includes(String(hint).toLowerCase())
      );

      if (!matchedHint) continue;

      const { brand, product } = candidateBrandProductFromSentence(sentence, matchedHint);
      const normalizedName = normalizeWhitespace(`${brand} ${product}`).toLowerCase();
      if (seen.has(normalizedName)) continue;
      seen.add(normalizedName);

      rawMentions.push({
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
  }

  const finalMentions = rawMentions
    .map((m) => finalizeMention(m, category))
    .filter(Boolean);

  return finalMentions.slice(0, 12);
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

      let validMentions = [];

      if (fetched.ok && fetched.source_text) {
        validMentions = extractMentionsFromText({
          text: fetched.source_text,
          country: normalizedCountry,
          category: normalizedCategory,
          source
        });
      }

      const sourceRef = db.collection("social_sources").doc(source.source_id);
      const sourceSnap = await sourceRef.get();
      const existing = sourceSnap.exists ? sourceSnap.data() : {};

      let lowYieldCount = Number(existing.low_yield_count || 0);

      if (!validMentions.length) {
        lowYieldCount += 1;
        sourcesFailed += 1;

        const decayScore = Math.max(0, Number(existing.yield_score || 0) - 5);

        const updatePayload = {
          low_yield_count: lowYieldCount,
          yield_score: decayScore,
          updated_at_iso: nowIso(),
          next_health_check_at: addDaysIsoSafe(lowYieldCount >= 5 ? 30 : lowYieldCount >= 3 ? 14 : 7)
        };

        if (lowYieldCount >= 3) {
          updatePayload.health_status = "low_yield";
        }

        if (lowYieldCount >= 5) {
          updatePayload.auto_disabled = true;
          updatePayload.status = "disabled";
          updatePayload.auto_disabled_reason = "low_yield";
        }

        await sourceRef.set(updatePayload, { merge: true });
        continue;
      }

      const yieldScore =
        Number(existing.yield_score || 0) + validMentions.length * 10;

      await sourceRef.set(
        {
          low_yield_count: 0,
          last_yield_at: nowIso(),
          yield_score: yieldScore,
          updated_at_iso: nowIso(),
          health_status: "healthy",
          status: "active",
          auto_disabled: false,
          auto_disabled_reason: "",
          next_health_check_at: nowIso()
        },
        { merge: true }
      );

      for (const mention of validMentions) {
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