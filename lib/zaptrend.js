const API_BASE = (process.env.NEXT_PUBLIC_ZAPTREND_API_BASE || "").replace(/\/$/, "");

console.log("[ZapTrend API_BASE]", API_BASE);

async function fetchJson(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const method = options?.method || "GET";

  if (!API_BASE) {
    const msg =
      "NEXT_PUBLIC_ZAPTREND_API_BASE is missing. Check your .env.local and restart npm run dev.";
    console.error("[ZapTrend fetch config error]", { path, method, msg });
    throw new Error(msg);
  }

  console.log("[ZapTrend fetch:start]", { method, url });

  try {
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
      const message =
        data?.error ||
        data?.message ||
        data?.details ||
        `Request failed: ${res.status} ${res.statusText}`;

      console.error("[ZapTrend fetch:http_error]", {
        method,
        url,
        status: res.status,
        statusText: res.statusText,
        response: data
      });

      throw new Error(message);
    }

    console.log("[ZapTrend fetch:success]", {
      method,
      url,
      status: res.status
    });

    return data;
  } catch (err) {
    console.error("[ZapTrend fetch:network_error]", {
      method,
      url,
      message: err?.message || String(err)
    });

    throw err;
  }
}

export async function getDashboardOverview() {
  return fetchJson("/admin/dashboard/overview");
}

export async function getDashboardActivity(limit = 20) {
  return fetchJson(`/admin/dashboard/activity?limit=${limit}`);
}

export async function getGenerationStatus() {
  return fetchJson("/admin/generation/status");
}

export async function runSocialScan(country = "TH", category = "beauty_skincare") {
  return fetchJson("/admin/social/run", {
    method: "POST",
    body: JSON.stringify({ country, category })
  });
}

export async function runGuidedDiscovery(
  country = "TH",
  category = "beauty_skincare",
  theme = "local_exclusive",
  limit = 5,
  dryRun = false
) {
  return fetchJson("/admin/social/discovery-boost", {
    method: "POST",
    body: JSON.stringify({
      country,
      category,
      theme,
      limit,
      dry_run: dryRun
    })
  });
}

export async function evaluateTrials(
  country = "TH",
  category = "beauty_skincare",
  limit = 10
) {
  return fetchJson("/admin/trials/evaluate", {
    method: "POST",
    body: JSON.stringify({ country, category, limit })
  });
}

export async function recalculateReputation(
  country = "TH",
  category = "beauty_skincare",
  limit = 20
) {
  return fetchJson("/admin/reputation/recalculate", {
    method: "POST",
    body: JSON.stringify({ country, category, limit })
  });
}

export async function runDailyGeneration({
  dateUtc = "",
  dryRun = false,
  countries = [],
  categories = []
} = {}) {
  return fetchJson("/admin/runDaily", {
    method: "POST",
    body: JSON.stringify({
      ...(dateUtc ? { date_utc: dateUtc } : {}),
      dry_run: dryRun,
      ...(countries.length ? { countries } : {}),
      ...(categories.length ? { categories } : {})
    })
  });
}

export async function processQueue(limit = 10, dateUtc = "") {
  return fetchJson("/admin/processQueued", {
    method: "POST",
    body: JSON.stringify({
      limit,
      ...(dateUtc ? { date_utc: dateUtc } : {})
    })
  });
}