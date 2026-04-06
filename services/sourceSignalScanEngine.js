const { db } = require("../config/firestore");
const { ingestSignals } = require("./signalMemoryEngine");

const MAX_SOURCES_PER_SCAN = 4;
const MAX_SIGNALS_PER_SOURCE = 3;
const MAX_TOTAL_SIGNALS = 12;
const FETCH_TIMEOUT_MS = 2500;
const CONCURRENCY = 2;
const MAX_HTML_CHARS = 120000;
const MAX_BODY_TEXT_CHARS = 2500;

function normalizeCountry(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeCategory(value) {
  return String(value || "").trim();
}

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function stripHtmlTags(value = "") {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&[a-zA-Z0-9#]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsHtmlLikeGarbage(value = "") {
  const text = String(value || "").toLowerCase();
  return (
    text.includes("<span") ||
    text.includes("</span") ||
    text.includes("font-size") ||
    text.includes("style=") ||
    text.includes("<div") ||
    text.includes("</div")
  );
}

function getCountryLanguageProfile(country) {
  const cc = normalizeCountry(country);

  const map = {
    TH: {
      primary_language: "th",
      audience_locale: "th-TH",
      local_confidence: 0.9
    },
    SG: {
      primary_language: "en",
      audience_locale: "en-SG",
      local_confidence: 0.88
    },
    MY: {
      primary_language: "ms",
      audience_locale: "ms-MY",
      local_confidence: 0.86
    },
    JP: {
      primary_language: "ja",
      audience_locale: "ja-JP",
      local_confidence: 0.9
    },
    KR: {
      primary_language: "ko",
      audience_locale: "ko-KR",
      local_confidence: 0.9
    },
    VN: {
      primary_language: "vi",
      audience_locale: "vi-VN",
      local_confidence: 0.88
    }
  };

  return (
    map[cc] || {
      primary_language: "en",
      audience_locale: cc,
      local_confidence: 0.8
    }
  );
}

function decodeHtml(value = "") {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function stripHtml(html = "") {
  return decodeHtml(
    String(html || "")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function extractTagContent(html = "", pattern) {
  const match = String(html || "").match(pattern);
  return match ? decodeHtml(match[1] || "").trim() : "";
}

function extractMetaContent(html = "", key) {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${key}["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+name=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${key}["'][^>]*>`, "i")
  ];

  for (const pattern of patterns) {
    const value = extractTagContent(html, pattern);
    if (value) return value;
  }

  return "";
}

function extractTitle(html = "") {
  return extractTagContent(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
}

function inferLanguageFromHtml(html = "", fallback = "en") {
  const langAttr = extractTagContent(html, /<html[^>]+lang=["']([^"']+)["']/i);
  if (langAttr) return langAttr.toLowerCase().slice(0, 2);

  const text = stripHtml(html).slice(0, 2000);

  if (/[ก-๙]/.test(text)) return "th";
  if (/[ぁ-んァ-ン一-龯]/.test(text)) return "ja";
  if (/[가-힣]/.test(text)) return "ko";
  if (/[À-ỹ]/.test(text)) return "vi";

  return fallback;
}

function safeDomainLabel(domain = "") {
  return String(domain || "")
    .replace(/^www\./i, "")
    .split(".")[0]
    .replace(/[-_]+/g, " ")
    .trim();
}

function cleanPhrase(value = "") {
  return stripHtmlTags(
    String(value || "")
      .replace(/\s+/g, " ")
      .replace(/[|•·]+/g, " ")
      .trim()
  );
}

function inferCreatorType(source) {
  const sourceType = String(source.source_type || "").toLowerCase();

  if (sourceType === "editorial" || sourceType === "local_media") return "local_reviewer";
  if (sourceType === "community") return "community_reviewer";
  if (sourceType === "marketplace" || sourceType === "ecommerce") return "shopping_reviewer";
  return "trend_reviewer";
}

function inferHashtag(product = "", category = "", country = "") {
  const p = String(product || "").toLowerCase();
  const cc = normalizeCountry(country);

  if (category === "snacks_drinks") {
    if (p.includes("tea")) return cc === "SG" ? "#sgdrinkfinds" : "#localdrinks";
    if (p.includes("snack") || p.includes("chips")) return cc === "SG" ? "#sgsnackfinds" : "#localsnacks";
    if (p.includes("laksa") || p.includes("kaya")) return "#localfoodsouvenir";
    return "#localfoodfinds";
  }

  if (category === "souvenirs_local_finds") {
    if (p.includes("craft") || p.includes("handmade")) return "#localcraftfinds";
    if (p.includes("silk")) return "#localsouvenir";
    if (p.includes("ceramic")) return "#heritagefinds";
    if (p.includes("bag")) return "#giftablefinds";
    return "#giftablefinds";
  }

  if (category === "fashion_accessories") {
    if (p.includes("bag") || p.includes("tote") || p.includes("handbag")) return "#localstylefinds";
    if (p.includes("earring") || p.includes("bracelet") || p.includes("necklace")) return "#accessorytrend";
    return "#localfashionfinds";
  }

  return "#localfinds";
}

function isCategoryValid(signal, category) {
  const cat = String(category || "").toLowerCase();
  const text = `${signal.brand || ""} ${signal.product || ""} ${signal.hashtag || ""}`.toLowerCase();

  if (cat === "snacks_drinks") {
    return (
      text.includes("tea") ||
      text.includes("drink") ||
      text.includes("snack") ||
      text.includes("noodle") ||
      text.includes("milk") ||
      text.includes("food") ||
      text.includes("flavor") ||
      text.includes("seaweed") ||
      text.includes("yogurt") ||
      text.includes("laksa") ||
      text.includes("kaya") ||
      text.includes("chips") ||
      text.includes("coffee") ||
      text.includes("juice")
    );
  }

  if (cat === "souvenirs_local_finds") {
    return (
      text.includes("souvenir") ||
      text.includes("craft") ||
      text.includes("gift") ||
      text.includes("silk") ||
      text.includes("ceramic") ||
      text.includes("tableware") ||
      text.includes("bag") ||
      text.includes("local") ||
      text.includes("handmade") ||
      text.includes("scarf") ||
      text.includes("artisan") ||
      text.includes("market")
    );
  }

  if (cat === "fashion_accessories") {
    return (
      text.includes("bag") ||
      text.includes("wallet") ||
      text.includes("earring") ||
      text.includes("fashion") ||
      text.includes("accessories") ||
      text.includes("tote") ||
      text.includes("handbag") ||
      text.includes("style") ||
      text.includes("jewelry") ||
      text.includes("bracelet") ||
      text.includes("necklace")
    );
  }

  return true;
}

function scorePhrase(phrase = "", category = "") {
  const text = phrase.toLowerCase();
  let score = 0;

  if (category === "snacks_drinks") {
    if (/(snack|drink|tea|coffee|milk|juice|seaweed|noodle|flavor|soda|laksa|kaya|chips|candy|yogurt|food)/i.test(text)) score += 3;
    if (/(limited|exclusive|local|popular|best|viral|gift|souvenir)/i.test(text)) score += 1;
  }

  if (category === "souvenirs_local_finds") {
    if (/(souvenir|gift|craft|artisan|handmade|silk|ceramic|tableware|market|local|heritage|culture|scarf|bag)/i.test(text)) score += 3;
    if (/(exclusive|traditional|authentic|local|bangkok|chiang mai|thai)/i.test(text)) score += 1;
  }

  if (category === "fashion_accessories") {
    if (/(bag|wallet|earring|bracelet|necklace|tote|handbag|accessories|fashion|style|jewelry)/i.test(text)) score += 3;
    if (/(trend|viral|local|designer|minimal|edit)/i.test(text)) score += 1;
  }

  return score;
}

async function fetchHtml(url) {
  let controller;
  let timeout;

  try {
    controller = new AbortController();
    timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "Mozilla/5.0 ZapTrendBot/21.0B-bulletproof",
        accept: "text/html,application/xhtml+xml"
      }
    });

    let html = await res.text();
    if (html.length > MAX_HTML_CHARS) {
      html = html.slice(0, MAX_HTML_CHARS);
    }

    return {
      ok: res.ok,
      status: res.status,
      html: html || ""
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      html: "",
      error: String(error?.message || "fetch_failed")
    };
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function extractJsonLdBlocks(html = "") {
  const matches = [...String(html || "").matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const blocks = [];

  for (const match of matches) {
    const raw = (match[1] || "").trim();
    if (!raw || raw.length > 30000) continue;

    try {
      const parsed = JSON.parse(raw);
      blocks.push(parsed);
    } catch {
      // ignore invalid block
    }
  }

  return blocks;
}

function flattenJsonLd(items) {
  const out = [];

  function walk(node) {
    if (!node) return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (typeof node === "object") {
      out.push(node);
      if (Array.isArray(node["@graph"])) node["@graph"].forEach(walk);
    }
  }

  walk(items);
  return out;
}

function buildRealSignal({
  brand,
  product,
  source,
  category,
  context,
  method,
  confidenceBoost = 0.82,
  localEvidence = ""
}) {
  const cleanBrand = stripHtmlTags(normalizeText(brand));
  const cleanProduct = stripHtmlTags(normalizeText(product));

  if (!cleanBrand || !cleanProduct) return null;
  if (containsHtmlLikeGarbage(cleanBrand) || containsHtmlLikeGarbage(cleanProduct)) return null;

  const signal = {
    brand: cleanBrand || safeDomainLabel(source.domain),
    product: cleanProduct,
    hashtag: inferHashtag(cleanProduct, category, context.country),
    source_ref: source.domain || source.source_id || source.id || "",
    source_weight: method === "jsonld_product" ? 1.15 : 1.0,
    engagement: method === "jsonld_product" ? 3 : 2,
    freshness_boost: method === "jsonld_product" ? 1.2 : 1,
    review_language: context.primary_language,
    local_evidence: stripHtmlTags(localEvidence || `Real extraction from ${source.domain || source.url}`),
    travel_buyable: true,
    local_confidence: Math.max(context.local_confidence, confidenceBoost),
    audience_locale: context.audience_locale,
    creator_type: inferCreatorType(source),
    extraction_method: method
  };

  return isCategoryValid(signal, category) ? signal : null;
}

function candidateFromJsonLdObject(obj, source, category, context) {
  const type = String(obj["@type"] || "").toLowerCase();
  if (!type.includes("product")) return null;

  const name = stripHtmlTags(cleanPhrase(obj.name || ""));
  const brand =
    stripHtmlTags(
      cleanPhrase(
        typeof obj.brand === "object" ? obj.brand?.name || "" : obj.brand || ""
      )
    ) || safeDomainLabel(source.domain);

  if (!name || name.length < 3) return null;
  if (containsHtmlLikeGarbage(name) || containsHtmlLikeGarbage(brand)) return null;

  return buildRealSignal({
    brand,
    product: name,
    source,
    category,
    context,
    method: "jsonld_product",
    confidenceBoost: 0.85,
    localEvidence: `Real page extraction via JSON-LD from ${source.domain || source.url}`
  });
}

function extractCandidatePhrases(html = "", category = "") {
  const title = cleanPhrase(extractTitle(html));
  const ogTitle = cleanPhrase(extractMetaContent(html, "og:title"));
  const description = cleanPhrase(extractMetaContent(html, "description"));
  const ogDescription = cleanPhrase(extractMetaContent(html, "og:description"));
  const h1 = cleanPhrase(extractTagContent(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i));
  const h2s = [...String(html || "").matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)]
    .map((m) => cleanPhrase(m[1] || ""))
    .filter(Boolean)
    .slice(0, 5);

  const bodyText = stripHtml(html).slice(0, MAX_BODY_TEXT_CHARS);

  const phrases = [title, ogTitle, description, ogDescription, h1, ...h2s]
    .filter(Boolean)
    .filter((x) => x.length >= 4 && x.length <= 120)
    .filter((x) => !containsHtmlLikeGarbage(x));

  const bodyCandidates = bodyText
    .split(/[.!?•|]/)
    .map((x) => cleanPhrase(x))
    .filter((x) => x.length >= 10 && x.length <= 90)
    .filter((x) => !containsHtmlLikeGarbage(x));

  for (const part of bodyCandidates) {
    if (scorePhrase(part, category) >= 3) {
      phrases.push(part);
    }
    if (phrases.length >= 16) break;
  }

  return [...new Set(phrases)].slice(0, 16);
}

function extractBrandProductFromPhrase(phrase = "", source = {}) {
  const cleaned = cleanPhrase(phrase);
  const domainBrand = safeDomainLabel(source.domain || source.source_id || "Local");

  let brand = domainBrand;
  let product = cleaned;

  const separators = [" | ", " - ", " – ", ": "];

  for (const sep of separators) {
    if (cleaned.includes(sep)) {
      const parts = cleaned.split(sep).map((x) => cleanPhrase(x)).filter(Boolean);
      if (parts.length >= 2) {
        const left = parts[0];
        const right = parts.slice(1).join(" ");

        if (left.length <= 40 && right.length >= 4) {
          brand = left;
          product = right;
          return { brand, product };
        }
      }
    }
  }

  return { brand, product };
}

function buildSignalFromPhrase(phrase, source, category, context) {
  const cleaned = stripHtmlTags(cleanPhrase(phrase));
  if (!cleaned) return null;
  if (containsHtmlLikeGarbage(cleaned)) return null;

  const { brand, product } = extractBrandProductFromPhrase(cleaned, source);

  if (!product || product.length < 4) return null;
  if (product.length > 110) return null;
  if (containsHtmlLikeGarbage(brand) || containsHtmlLikeGarbage(product)) return null;

  return buildRealSignal({
    brand,
    product,
    source,
    category,
    context,
    method: "html_phrase",
    confidenceBoost: 0.76,
    localEvidence: `Real page extraction from title/meta/headings of ${source.domain || source.url}`
  });
}

function dedupeSignals(signals = []) {
  const out = [];
  const seen = new Set();

  for (const item of signals) {
    const key = `${normalizeText(item.brand).toLowerCase()}__${normalizeText(item.product).toLowerCase()}`;
    if (!item.product || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }

  return out;
}

function getFallbackSignals(source, category, country) {
  const cc = normalizeCountry(country);
  const context = {
    ...getCountryLanguageProfile(cc),
    country: cc
  };

  const fallbackMap = {
    snacks_drinks: {
      TH: [
        { brand: "Pocky Thailand", product: "Thai Milk Tea Flavor" },
        { brand: "Tao Kae Noi", product: "Seaweed Snacks" },
        { brand: "Ichitan", product: "Green Tea Drink" }
      ],
      SG: [
        { brand: "Irvins", product: "Salted Egg Snacks" },
        { brand: "TWG", product: "Tea Gift Sets" },
        { brand: "Old Chang Kee", product: "Snack Packs" }
      ]
    },
    souvenirs_local_finds: {
      TH: [
        { brand: "Chatuchak Market", product: "Handmade Crafts" },
        { brand: "Thai Silk", product: "Scarves" },
        { brand: "Benjarong", product: "Ceramic Tableware" }
      ]
    },
    fashion_accessories: {
      TH: [
        { brand: "Gentlewoman", product: "Canvas Tote Bag" },
        { brand: "Naraya", product: "Mini Handbag" },
        { brand: "Chatuchak Fashion", product: "Statement Earrings" }
      ]
    }
  };

  const set =
    (fallbackMap[category] && fallbackMap[category][cc]) ||
    (fallbackMap[category] && fallbackMap[category].TH) ||
    [];

  return set.slice(0, MAX_SIGNALS_PER_SOURCE).map((item) =>
    buildRealSignal({
      brand: item.brand,
      product: item.product,
      source,
      category,
      context,
      method: "fallback",
      confidenceBoost: 0.7,
      localEvidence: `Fallback extraction used for ${source.domain || source.url}`
    })
  ).filter(Boolean);
}

async function extractSignalsFromSource(source, category, country) {
  const cc = normalizeCountry(country);
  const context = {
    ...getCountryLanguageProfile(cc),
    country: cc
  };

  const fetchResult = await fetchHtml(source.url || "");

  if (!fetchResult.ok || !fetchResult.html) {
    return getFallbackSignals(source, category, cc);
  }

  const html = fetchResult.html;
  const detectedLanguage = inferLanguageFromHtml(html, context.primary_language);
  const adjustedContext = {
    ...context,
    primary_language: detectedLanguage || context.primary_language
  };

  const jsonLdSignals = dedupeSignals(
    flattenJsonLd(extractJsonLdBlocks(html))
      .map((obj) => candidateFromJsonLdObject(obj, source, category, adjustedContext))
      .filter(Boolean)
  );

  if (jsonLdSignals.length >= 2) {
    return jsonLdSignals.slice(0, MAX_SIGNALS_PER_SOURCE);
  }

  const phraseSignals = dedupeSignals(
    extractCandidatePhrases(html, category)
      .map((phrase) => buildSignalFromPhrase(phrase, source, category, adjustedContext))
      .filter(Boolean)
  );

  const combined = dedupeSignals([...jsonLdSignals, ...phraseSignals]);

  if (combined.length > 0) {
    return combined.slice(0, MAX_SIGNALS_PER_SOURCE);
  }

  return getFallbackSignals(source, category, cc);
}

async function runWithConcurrency(items, worker, concurrency = 2) {
  const results = [];
  let index = 0;

  async function runner() {
    while (index < items.length) {
      const currentIndex = index++;
      try {
        results[currentIndex] = await worker(items[currentIndex], currentIndex);
      } catch (error) {
        console.warn("[SOURCE_SCAN] worker error:", error?.message || error);
        results[currentIndex] = [];
      }
    }
  }

  const runners = Array.from({ length: Math.max(1, concurrency) }, () => runner());
  await Promise.all(runners);

  return results;
}

async function runSourceSignalScan({ country, category }) {
  const normalizedCountry = normalizeCountry(country);
  const normalizedCategory = normalizeCategory(category);

  const snap = await db
    .collection("ai_sources")
    .where("country", "==", normalizedCountry)
    .where("category", "==", normalizedCategory)
    .where("status", "==", "ACTIVE")
    .limit(MAX_SOURCES_PER_SCAN)
    .get();

  const sources = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const extractedGroups = await runWithConcurrency(
    sources,
    async (source) => {
      const extracted = await extractSignalsFromSource(
        source,
        normalizedCategory,
        normalizedCountry
      );

      return extracted.filter((signal) => isCategoryValid(signal, normalizedCategory));
    },
    CONCURRENCY
  );

  const totalSignals = dedupeSignals(extractedGroups.flat()).slice(0, MAX_TOTAL_SIGNALS);

  const batch = db.batch();

  for (let i = 0; i < sources.length; i++) {
    const source = sources[i];
    const extracted = extractedGroups[i] || [];

    const signalCount = extracted.length;
    const successCount = Number(source.memory_success_count || 0);
    const failCount = Number(source.memory_fail_count || 0);
    const prevSignalCount = Number(source.memory_signal_count || 0);

    const isUseful = signalCount > 0;
    const newSuccess = isUseful ? successCount + 1 : successCount;
    const newFail = !isUseful ? failCount + 1 : failCount;

    const adaptiveWeight = Math.max(
      0,
      Math.min(100, newSuccess * 5 - newFail * 5 + prevSignalCount)
    );

    const ref = db.collection("ai_sources").doc(source.id);

    batch.set(
      ref,
      {
        memory_success_count: newSuccess,
        memory_fail_count: newFail,
        memory_signal_count: prevSignalCount + signalCount,
        memory_last_signal_at: new Date().toISOString(),
        adaptive_weight: adaptiveWeight,
        updated_at: new Date().toISOString()
      },
      { merge: true }
    );
  }

  await batch.commit();

  const result = await ingestSignals({
    country: normalizedCountry,
    category: normalizedCategory,
    sourceType: "source_scan",
    signals: totalSignals
  });

  return {
    ok: true,
    sources_scanned: sources.length,
    signals_extracted: totalSignals.length,
    ingestion_result: result
  };
}

module.exports = {
  runSourceSignalScan
};