"use client";

import { useEffect, useMemo, useState } from "react";
import AdminShell from "../../components/admin/AdminShell";
import AdminPageHeader from "../../components/admin/AdminPageHeader";
import AdminSurface from "../../components/admin/AdminSurface";
import AdminActionButton from "../../components/admin/AdminActionButton";
import AdminMetricCard from "../../components/admin/AdminMetricCard";
import AdminSectionTitle from "../../components/admin/AdminSectionTitle";

const API_BASE =
  (process.env.NEXT_PUBLIC_ZAPTREND_API_BASE || "").replace(/\/$/, "");

const COUNTRY_OPTIONS = [
  { value: "TH", label: "TH" },
  { value: "SG", label: "SG" },
  { value: "MY", label: "MY" },
  { value: "VN", label: "VN" },
  { value: "PH", label: "PH" }
];

const CATEGORY_OPTIONS = [
  { value: "beauty_skincare", label: "beauty_skincare" },
  { value: "snacks_drinks", label: "snacks_drinks" },
  { value: "fashion_accessories", label: "fashion_accessories" },
  { value: "souvenirs_local_finds", label: "souvenirs_local_finds" },
  { value: "other", label: "other" }
];

function SelectField({ label, value, onChange, options }) {
  return (
    <label className="block">
      <div className="mb-2 text-xs uppercase tracking-[0.16em] text-zinc-500">
        {label}
      </div>

      <div className="relative">
        <select
          value={value}
          onChange={onChange}
          className="w-full appearance-none rounded-2xl border border-white/10 bg-black/20 px-4 py-3 pr-10 text-sm text-white outline-none transition focus:border-cyan-400/40 focus:bg-black/30"
        >
          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
              className="bg-zinc-900 text-white"
            >
              {option.label}
            </option>
          ))}
        </select>

        <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-zinc-400">
          ▼
        </div>
      </div>
    </label>
  );
}

function NavCard({ href, title, subtitle }) {
  return (
    <a href={href}>
      <AdminSurface hover className="h-full">
        <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">
          Open
        </div>
        <div className="mt-3 text-xl font-semibold text-white">{title}</div>
        <div className="mt-2 text-sm leading-6 text-zinc-400">{subtitle}</div>
      </AdminSurface>
    </a>
  );
}

async function fetchJson(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    ...options
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data?.error || `Request failed: ${res.status}`);
  }

  return data;
}

export default function AdminOverviewPage() {
  const [country, setCountry] = useState("TH");
  const [category, setCategory] = useState("beauty_skincare");

  const [sourcesData, setSourcesData] = useState(null);
  const [trendsData, setTrendsData] = useState(null);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadDashboard() {
    try {
      setError("");

      const [sources, trends] = await Promise.all([
        fetchJson(
          `/admin/lite/sources?country=${encodeURIComponent(country)}&category=${encodeURIComponent(category)}`
        ),
        fetchJson(
          `/admin/lite/trends/latest?country=${encodeURIComponent(country)}&category=${encodeURIComponent(category)}&limit=20`
        )
      ]);

      setSourcesData(sources);
      setTrendsData(trends);
    } catch (err) {
      setError(err.message || String(err));
    }
  }

  useEffect(() => {
    loadDashboard();
  }, [country, category]);

  async function runAction(label, path, body) {
    try {
      setLoading(true);
      setError("");
      setMessage("");

      const result = await fetchJson(path, {
        method: "POST",
        body: JSON.stringify(body)
      });

      setMessage(`${label} completed.`);
      await loadDashboard();
      return result;
    } catch (err) {
      setError(err.message || String(err));
      throw err;
    } finally {
      setLoading(false);
    }
  }

  const summary = useMemo(() => {
    const sources = sourcesData?.results || [];
    const trends = trendsData?.results || [];

    const healthy = sources.filter((x) => x.health_status === "healthy" && !x.auto_disabled).length;
    const unhealthy = sources.filter((x) => x.health_status !== "healthy" || x.auto_disabled).length;
    const active = sources.filter((x) => x.status === "active").length;

    const trending = trends.filter((x) => x.status_band === "trending").length;
    const newRising = trends.filter((x) => x.status_band === "new_rising").length;
    const holding = trends.filter((x) => x.status_band === "holding").length;

    return {
      totalSources: sources.length,
      activeSources: active,
      healthySources: healthy,
      unhealthySources: unhealthy,
      totalTrends: trends.length,
      trendingCount: trending,
      newRisingCount: newRising,
      holdingCount: holding
    };
  }, [sourcesData, trendsData]);

  return (
    <AdminShell>
      <AdminPageHeader
        title="ZapTrend Lite v2.1"
        subtitle="Autonomous source discovery, health checks, healthy-only scans, and momentum-based local trend ranking."
      />

      {error ? (
        <div className="mb-6 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="mb-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
          {message}
        </div>
      ) : null}

      <div className="mb-8 grid gap-4 md:grid-cols-2">
        <SelectField
          label="Country"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          options={COUNTRY_OPTIONS}
        />
        <SelectField
          label="Category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          options={CATEGORY_OPTIONS}
        />
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard
          title="Healthy Sources"
          value={summary.healthySources}
          subtitle={`Active ${summary.activeSources} / Total ${summary.totalSources}`}
          accent="emerald"
        />
        <AdminMetricCard
          title="Unhealthy Sources"
          value={summary.unhealthySources}
          subtitle="Disabled or unavailable sources"
          accent="rose"
        />
        <AdminMetricCard
          title="Trend Items"
          value={summary.totalTrends}
          subtitle={`Trending ${summary.trendingCount} · Rising ${summary.newRisingCount}`}
          accent="cyan"
        />
        <AdminMetricCard
          title="Holding Items"
          value={summary.holdingCount}
          subtitle="Older items still visible"
          accent="orange"
        />
      </div>

      <div className="mb-8 grid gap-4 xl:grid-cols-4">
        <AdminActionButton
          label={loading ? "Running..." : "Run Discovery"}
          tone="cyan"
          disabled={loading}
          onClick={() =>
            runAction("Discovery", "/admin/lite/discovery/run", {
              country,
              category
            })
          }
        />
        <AdminActionButton
          label={loading ? "Running..." : "Run Social Scan"}
          tone="emerald"
          disabled={loading}
          onClick={() =>
            runAction("Social scan", "/admin/lite/social/run", {
              country,
              category
            })
          }
        />
        <AdminActionButton
          label={loading ? "Running..." : "Run Trend Engine"}
          tone="pink"
          disabled={loading}
          onClick={() =>
            runAction("Trend engine", "/admin/lite/trends/run", {
              country,
              category,
              limit: 20
            })
          }
        />
        <AdminActionButton
          label={loading ? "Running..." : "Run Full Daily"}
          tone="orange"
          disabled={loading}
          onClick={() =>
            runAction("Full daily run", "/admin/lite/daily/run", {
              countries: [country],
              categories: [category]
            })
          }
        />
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-2">
        <NavCard
          href={`/admin/sources`}
          title="Sources"
          subtitle="View discovered social reviewers, health state, availability, and active source pool."
        />
        <NavCard
          href={`/admin/trends`}
          title="Trends"
          subtitle="View momentum-ranked local items, rising items, and older holding items."
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <AdminSurface>
          <AdminSectionTitle
            eyebrow="Source Snapshot"
            title="Current source state"
            subtitle="Healthy sources are used for scan runs. Unhealthy sources remain visible for review."
          />

          <div className="mt-5 space-y-3">
            {(sourcesData?.results || []).slice(0, 5).map((source) => (
              <div
                key={source.id || source.source_id}
                className="flex items-start justify-between gap-4 rounded-2xl border border-white/10 bg-black/20 p-4"
              >
                <div>
                  <div className="text-sm font-semibold text-white">
                    {source.display_name || source.source_id}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    {source.platform || "-"} · {source.handle || "-"}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-sm text-white">{source.health_status || "-"}</div>
                  <div className="mt-1 text-xs text-zinc-500">
                    {source.status || "-"}
                  </div>
                </div>
              </div>
            ))}

            {!(sourcesData?.results || []).length ? (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-500">
                No sources found for this country/category yet.
              </div>
            ) : null}
          </div>
        </AdminSurface>

        <AdminSurface>
          <AdminSectionTitle
            eyebrow="Trend Snapshot"
            title="Current top items"
            subtitle="Momentum + decay allows fresh items to rise while older items remain visible."
          />

          <div className="mt-5 space-y-3">
            {(trendsData?.results || []).slice(0, 5).map((item, index) => (
              <div
                key={item.id || item.trend_id || index}
                className="rounded-2xl border border-white/10 bg-black/20 p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-white">
                      #{index + 1} {item.item_name || `${item.brand || ""} ${item.product || ""}`.trim()}
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">
                      {item.status_band || "unclassified"}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-sm font-semibold text-cyan-300">
                      {item.score ?? 0}
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">score</div>
                  </div>
                </div>
              </div>
            ))}

            {!(trendsData?.results || []).length ? (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-500">
                No trend items found for this country/category yet.
              </div>
            ) : null}
          </div>
        </AdminSurface>
      </div>
    </AdminShell>
  );
}