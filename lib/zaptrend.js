const API_BASE = (process.env.NEXT_PUBLIC_ZAPTREND_API_BASE || "").replace(/\/$/, "");

async function fetchJson(path, options = {}) {
  const url = `${API_BASE}${path}`;

  if (!API_BASE) {
    throw new Error("NEXT_PUBLIC_ZAPTREND_API_BASE is missing.");
  }

  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    cache: "no-store"
  });

  const rawText = await res.text();
  let data = {};

  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch {
    data = { raw: rawText };
  }

  if (!res.ok) {
    throw new Error(
      data?.error || data?.message || `Request failed: ${res.status} ${res.statusText}`
    );
  }

  return data;
}

export async function runDiscovery(country = "TH", category = "beauty_skincare") {
  return fetchJson("/admin/lite/discovery/run", {
    method: "POST",
    body: JSON.stringify({ country, category })
  });
}

export async function runSocialScan(country = "TH", category = "beauty_skincare") {
  return fetchJson("/admin/lite/social/run", {
    method: "POST",
    body: JSON.stringify({ country, category })
  });
}

export async function runTrendEngine(country = "TH", category = "beauty_skincare", limit = 20) {
  return fetchJson("/admin/lite/trends/run", {
    method: "POST",
    body: JSON.stringify({ country, category, limit })
  });
}

export async function getLiteSources(country = "TH", category = "beauty_skincare") {
  return fetchJson(
    `/admin/lite/sources?country=${encodeURIComponent(country)}&category=${encodeURIComponent(category)}`
  );
}

export async function getLatestTrends(country = "TH", category = "beauty_skincare", limit = 20) {
  return fetchJson(
    `/admin/lite/trends/latest?country=${encodeURIComponent(country)}&category=${encodeURIComponent(category)}&limit=${encodeURIComponent(limit)}`
  );
}

export async function runLiteDaily(countries = ["TH"], categories = ["beauty_skincare"]) {
  return fetchJson("/admin/lite/daily/run", {
    method: "POST",
    body: JSON.stringify({ countries, categories })
  });
}