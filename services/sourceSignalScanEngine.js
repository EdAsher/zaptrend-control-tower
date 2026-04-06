const { db } = require("../config/firestore");
const { ingestSignals } = require("./signalMemoryEngine");

function normalizeCountry(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeCategory(value) {
  return String(value || "").trim();
}

function buildSignalItems(source, samples) {
  return samples.map((item) => ({
    ...item,
    source_ref: source.domain || source.source_id || source.id || "",
    source_weight: 1,
    engagement: Math.floor(Math.random() * 5) + 1,
    freshness_boost: 1
  }));
}

function extractSignalsFromSource(source, category) {
  const cat = String(category || "").toLowerCase();

  // --------------------------------------------------
  // TH / Snacks & Drinks
  // --------------------------------------------------
  if (cat === "snacks_drinks") {
    const samples = [
      {
        brand: "Pocky Thailand",
        product: "Thai Milk Tea Flavor",
        hashtag: "#thaiflavors"
      },
      {
        brand: "Tao Kae Noi",
        product: "Seaweed Snacks",
        hashtag: "#thaistreetsnack"
      },
      {
        brand: "Ichitan",
        product: "Green Tea Drink",
        hashtag: "#thaidrinks"
      },
      {
        brand: "Mama",
        product: "Instant Noodles Tom Yum",
        hashtag: "#thaiinstantfood"
      },
      {
        brand: "Dutch Mill",
        product: "Yogurt Drink",
        hashtag: "#thaidairy"
      }
    ];

    return buildSignalItems(source, samples);
  }

  // --------------------------------------------------
  // TH / Souvenirs & Local Finds
  // --------------------------------------------------
  if (cat === "souvenirs_local_finds") {
    const samples = [
      {
        brand: "Chatuchak Market",
        product: "Handmade Crafts",
        hashtag: "#bangkoksouvenir"
      },
      {
        brand: "Thai Silk",
        product: "Scarves",
        hashtag: "#thailandcraft"
      },
      {
        brand: "Elephant Brand",
        product: "Thai Souvenirs",
        hashtag: "#thaigifts"
      },
      {
        brand: "Benjarong",
        product: "Ceramic Tableware",
        hashtag: "#thaiceramics"
      },
      {
        brand: "Naraya",
        product: "Bangkok Fabric Bags",
        hashtag: "#localfinds"
      }
    ];

    return buildSignalItems(source, samples);
  }

  // --------------------------------------------------
  // TH / Fashion Accessories
  // --------------------------------------------------
  if (cat === "fashion_accessories") {
    const samples = [
      {
        brand: "Gentlewoman",
        product: "Canvas Tote Bag",
        hashtag: "#bangkokfashion"
      },
      {
        brand: "Naraya",
        product: "Mini Handbag",
        hashtag: "#thaifashionfinds"
      },
      {
        brand: "Chatuchak Fashion",
        product: "Local Statement Earrings",
        hashtag: "#marketstyle"
      },
      {
        brand: "Pomelo",
        product: "Fashion Accessories Edit",
        hashtag: "#thstyle"
      },
      {
        brand: "Thai Designer",
        product: "Minimalist Wallet",
        hashtag: "#bangkokfinds"
      }
    ];

    return buildSignalItems(source, samples);
  }

  // --------------------------------------------------
  // Safe fallback
  // --------------------------------------------------
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
      text.includes("yogurt")
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
      text.includes("local")
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
    const extracted = extractSignalsFromSource(source, normalizedCategory)
      .filter((signal) => isCategoryValid(signal, normalizedCategory));

    totalSignals = totalSignals.concat(extracted);

    // 🔥 MEMORY UPDATE
    const signalCount = extracted.length;

    const successCount = Number(source.memory_success_count || 0);
    const failCount = Number(source.memory_fail_count || 0);
    const prevSignalCount = Number(source.memory_signal_count || 0);

    const isUseful = signalCount > 0;

    const newSuccess = isUseful ? successCount + 1 : successCount;
    const newFail = !isUseful ? failCount + 1 : failCount;

    const adaptiveWeight = Math.max(
      0,
      Math.min(
        100,
        (newSuccess * 5) - (newFail * 5) + prevSignalCount
      )
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