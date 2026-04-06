const { db } = require("../config/firestore");
const { ingestSignals } = require("./signalMemoryEngine");

function normalizeCountry(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeCategory(value) {
  return String(value || "").trim();
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

function buildSignalItems(source, samples, context) {
  const sourceType = String(source.source_type || "").toLowerCase();
  const inferredCreatorType =
    sourceType === "editorial" || sourceType === "local_media"
      ? "local_reviewer"
      : sourceType === "community"
      ? "community_reviewer"
      : sourceType === "marketplace" || sourceType === "ecommerce"
      ? "shopping_reviewer"
      : "trend_reviewer";

  return samples.map((item) => ({
    ...item,
    source_ref: source.domain || source.source_id || source.id || "",
    source_weight: 1,
    engagement: Math.floor(Math.random() * 5) + 1,
    freshness_boost: 1,
    review_language: context.primary_language,
    local_evidence:
      item.local_evidence ||
      `Country-local source scan signal from ${context.country} for ${context.category}`,
    travel_buyable: item.travel_buyable !== false,
    local_confidence: Number(source.adaptive_weight)
      ? Math.max(0.75, Math.min(0.98, Number(source.adaptive_weight) / 100))
      : context.local_confidence,
    audience_locale: context.audience_locale,
    creator_type: inferredCreatorType
  }));
}

function extractSignalsFromSource(source, category, country) {
  const cat = String(category || "").toLowerCase();
  const cc = normalizeCountry(country);
  const context = {
    ...getCountryLanguageProfile(cc),
    country: cc,
    category: cat
  };

  if (cat === "snacks_drinks") {
    const samplesByCountry = {
      TH: [
        {
          brand: "Pocky Thailand",
          product: "Thai Milk Tea Flavor",
          hashtag: "#thaiflavors",
          local_evidence: "Thai local source mentions limited local flavor snack demand",
          travel_buyable: true
        },
        {
          brand: "Tao Kae Noi",
          product: "Seaweed Snacks",
          hashtag: "#thaistreetsnack",
          local_evidence: "Thai local source mentions giftable snack demand",
          travel_buyable: true
        },
        {
          brand: "Ichitan",
          product: "Green Tea Drink",
          hashtag: "#thaidrinks",
          local_evidence: "Thai beverage trend visible in local source coverage",
          travel_buyable: true
        },
        {
          brand: "Mama",
          product: "Instant Noodles Tom Yum",
          hashtag: "#thaiinstantfood",
          local_evidence: "Thai local source references recognizable take-home food item",
          travel_buyable: true
        },
        {
          brand: "Dutch Mill",
          product: "Yogurt Drink",
          hashtag: "#thaidairy",
          local_evidence: "Thai local source highlights familiar ready-to-buy drink",
          travel_buyable: true
        }
      ],
      SG: [
        {
          brand: "Irvins",
          product: "Salted Egg Snacks",
          hashtag: "#sgsnackfinds",
          local_evidence: "Singapore local source highlights iconic salted egg snack demand",
          travel_buyable: true
        },
        {
          brand: "TWG",
          product: "Tea Gift Sets",
          hashtag: "#sggiftablefood",
          local_evidence: "Singapore local source highlights premium tea as a bring-back gift",
          travel_buyable: true
        },
        {
          brand: "Old Chang Kee",
          product: "Snack Packs",
          hashtag: "#sgbites",
          local_evidence: "Singapore local source highlights recognizable snack packs",
          travel_buyable: true
        },
        {
          brand: "Ya Kun",
          product: "Kaya Toast Gift Set",
          hashtag: "#sglocaltastes",
          local_evidence: "Singapore local source references giftable local breakfast flavors",
          travel_buyable: true
        },
        {
          brand: "Prima Taste",
          product: "Laksa Pack",
          hashtag: "#sgfoodsouvenir",
          local_evidence: "Singapore local source points to packable local food souvenir demand",
          travel_buyable: true
        }
      ]
    };

    return buildSignalItems(source, samplesByCountry[cc] || samplesByCountry.TH, context);
  }

  if (cat === "souvenirs_local_finds") {
    const samples = [
      {
        brand: "Chatuchak Market",
        product: "Handmade Crafts",
        hashtag: "#bangkoksouvenir",
        local_evidence: "Local source highlights handmade market finds popular with shoppers",
        travel_buyable: true
      },
      {
        brand: "Thai Silk",
        product: "Scarves",
        hashtag: "#thailandcraft",
        local_evidence: "Local source highlights silk as a recognizable Thai gift item",
        travel_buyable: true
      },
      {
        brand: "Elephant Brand",
        product: "Thai Souvenirs",
        hashtag: "#thaigifts",
        local_evidence: "Local source highlights mainstream souvenir demand",
        travel_buyable: true
      },
      {
        brand: "Benjarong",
        product: "Ceramic Tableware",
        hashtag: "#thaiceramics",
        local_evidence: "Local source highlights culturally distinctive craft items",
        travel_buyable: true
      },
      {
        brand: "Naraya",
        product: "Bangkok Fabric Bags",
        hashtag: "#localfinds",
        local_evidence: "Local source highlights practical, giftable Bangkok finds",
        travel_buyable: true
      }
    ];

    return buildSignalItems(source, samples, context);
  }

  if (cat === "fashion_accessories") {
    const samples = [
      {
        brand: "Gentlewoman",
        product: "Canvas Tote Bag",
        hashtag: "#bangkokfashion",
        local_evidence: "Local source highlights a highly visible Thai accessory trend",
        travel_buyable: true
      },
      {
        brand: "Naraya",
        product: "Mini Handbag",
        hashtag: "#thaifashionfinds",
        local_evidence: "Local source highlights a giftable Thai fashion item",
        travel_buyable: true
      },
      {
        brand: "Chatuchak Fashion",
        product: "Local Statement Earrings",
        hashtag: "#marketstyle",
        local_evidence: "Local source highlights local-designer accessory appeal",
        travel_buyable: true
      },
      {
        brand: "Pomelo",
        product: "Fashion Accessories Edit",
        hashtag: "#thstyle",
        local_evidence: "Local source highlights Thailand fashion-accessory demand",
        travel_buyable: true
      },
      {
        brand: "Thai Designer",
        product: "Minimalist Wallet",
        hashtag: "#bangkokfinds",
        local_evidence: "Local source highlights portable and giftable design items",
        travel_buyable: true
      }
    ];

    return buildSignalItems(source, samples, context);
  }

  return [];
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
      text.includes("kaya")
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
      text.includes("scarf")
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
      text.includes("style")
    );
  }

  return true;
}

async function runSourceSignalScan({ country, category }) {
  const normalizedCountry = normalizeCountry(country);
  const normalizedCategory = normalizeCategory(category);

  const snap = await db
    .collection("ai_sources")
    .where("country", "==", normalizedCountry)
    .where("category", "==", normalizedCategory)
    .where("status", "==", "ACTIVE")
    .limit(10)
    .get();

  const sources = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  let totalSignals = [];
  const batch = db.batch();

  for (const source of sources) {
    const extracted = extractSignalsFromSource(source, normalizedCategory, normalizedCountry)
      .filter((signal) => isCategoryValid(signal, normalizedCategory));

    totalSignals = totalSignals.concat(extracted);

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