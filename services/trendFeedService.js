const { db } = require("../config/firestore");
const { env } = require("../config/env");

function normalizeCountry(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeCategory(value) {
  return String(value || "").trim();
}

function toIso(value) {
  try {
    if (!value) return null;
    if (typeof value?.toDate === "function") return value.toDate().toISOString();
    if (typeof value?._seconds === "number") {
      return new Date(value._seconds * 1000).toISOString();
    }
    if (typeof value === "string") return value;
    return null;
  } catch {
    return null;
  }
}

async function getTrendOutputs({
  country = "",
  category = "",
  status = "",
  limit = 50
} = {}) {
  const normalizedCountry = normalizeCountry(
    country || env.ZAPTREND_DEFAULT_COUNTRY || "TH"
  );
  const normalizedCategory = normalizeCategory(
    category || env.ZAPTREND_DEFAULT_CATEGORY || "beauty_skincare"
  );
  const normalizedStatus = String(status || "").trim().toUpperCase();
  const normalizedLimit = Number(limit || 50);

  const snap = await db.collection("trend_outputs").get();

  let rows = snap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data()
  }));

  rows = rows.filter((row) => {
    const matchCountry =
      String(row.country || "").toUpperCase() === normalizedCountry;

    const matchCategory =
      String(row.category || "") === normalizedCategory;

    const matchStatus =
      !normalizedStatus ||
      String(row.trend_status || "").toUpperCase() === normalizedStatus;

    return matchCountry && matchCategory && matchStatus;
  });

  rows.sort((a, b) => Number(b.trend_score || 0) - Number(a.trend_score || 0));
  rows = rows.slice(0, normalizedLimit);

  return {
    ok: true,
    country: normalizedCountry,
    category: normalizedCategory,
    total: rows.length,
    rows: rows.map((row) => ({
      ...row,
      created_at_iso: toIso(row.created_at),
      updated_at_iso: toIso(row.updated_at),
      last_seen_at_iso: toIso(row.last_seen_at)
    }))
  };
}

async function getTrendRuns({
  country = "",
  category = "",
  limit = 20
} = {}) {
  const normalizedCountry = normalizeCountry(
    country || env.ZAPTREND_DEFAULT_COUNTRY || "TH"
  );
  const normalizedCategory = normalizeCategory(
    category || env.ZAPTREND_DEFAULT_CATEGORY || "beauty_skincare"
  );
  const normalizedLimit = Number(limit || 20);

  const snap = await db.collection("trend_runs").get();

  let rows = snap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data()
  }));

  rows = rows.filter((row) => {
    const matchCountry =
      String(row.country || "").toUpperCase() === normalizedCountry;

    const matchCategory =
      String(row.category || "") === normalizedCategory;

    return matchCountry && matchCategory;
  });

  rows.sort((a, b) => {
    const aMs = Date.parse(toIso(a.created_at) || "") || 0;
    const bMs = Date.parse(toIso(b.created_at) || "") || 0;
    return bMs - aMs;
  });

  rows = rows.slice(0, normalizedLimit);

  return {
    ok: true,
    country: normalizedCountry,
    category: normalizedCategory,
    total: rows.length,
    rows: rows.map((row) => ({
      ...row,
      created_at_iso: toIso(row.created_at),
      updated_at_iso: toIso(row.updated_at)
    }))
  };
}

module.exports = {
  getTrendOutputs,
  getTrendRuns
};