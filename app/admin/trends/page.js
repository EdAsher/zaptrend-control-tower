"use client";

import { useEffect, useMemo, useState } from "react";
import AdminShell from "../../../components/admin/AdminShell";
import AdminPageHeader from "../../../components/admin/AdminPageHeader";
import AdminSurface from "../../../components/admin/AdminSurface";
import AdminMetricCard from "../../../components/admin/AdminMetricCard";

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

function BandPill({ value }) {
  const tone =
    value === "trending"
      ? "border-pink-400/30 bg-pink-500/10 text-pink-300"
      : value === "new_rising"
      ? "border-cyan-400/30 bg-cyan-500/10 text-cyan-300"
      : value === "holding"
      ? "border-amber-400/30 bg-amber-500/10 text-amber-300"
      : "border-zinc-400/20 bg-zinc-500/10 text-zinc-300";

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${tone}`}>
      {value || "unclassified"}
    </span>
  );
}

function formatDateLike(value) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("en-SG", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return String(value);
  }
}

async function fetchJson(path) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    cache: "no-store"
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data?.error || `Request failed: ${res.status}`);
  }

  return data;
}

export default function TrendsPage() {
  const [country, setCountry] = useState("TH");
  const [category, setCategory] = useState("beauty_skincare");
  const [data, setData] = useState([]);
  const [error, setError] = useState("");

  async function load() {
    try {
      setError("");
      const json = await fetchJson(
        `/admin/lite/trends/latest?country=${encodeURIComponent(country)}&category=${encodeURIComponent(category)}&limit=20`
      );
      setData(json.results || []);
    } catch (err) {
      setError(err.message || String(err));
    }
  }

  useEffect(() => {
    load();
  }, [country, category]);

  const summary = useMemo(() => {
    return {
      total: data.length,
      trending: data.filter((x) => x.status_band === "trending").length,
      newRising: data.filter((x) => x.status_band === "new_rising").length,
      holding: data.filter((x) => x.status_band === "holding").length
    };
  }, [data]);

  return (
    <AdminShell>
      <AdminPageHeader
        title="Trend Items"
        subtitle="Momentum-based ranking with decay so new items rise while older items remain visible."
      />

      {error ? (
        <div className="mb-6 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
          {error}
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
          title="Total Trends"
          value={summary.total}
          subtitle="All ranked items"
          accent="cyan"
        />
        <AdminMetricCard
          title="Trending"
          value={summary.trending}
          subtitle="Strong and active now"
          accent="pink"
        />
        <AdminMetricCard
          title="New Rising"
          value={summary.newRising}
          subtitle="Fresh items climbing"
          accent="emerald"
        />
        <AdminMetricCard
          title="Holding"
          value={summary.holding}
          subtitle="Older items still visible"
          accent="orange"
        />
      </div>

      <div className="grid gap-4">
        {data.length === 0 ? (
          <AdminSurface>
            <div className="text-sm text-zinc-500">
              No trend items found for this country/category yet.
            </div>
          </AdminSurface>
        ) : (
          data.map((item, i) => (
            <AdminSurface key={item.id || item.trend_id || i}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                    Rank #{i + 1}
                  </div>
                  <div className="mt-2 text-xl font-semibold text-white">
                    {item.item_name || `${item.brand || ""} ${item.product || ""}`.trim()}
                  </div>
                  <div className="mt-2 text-sm text-zinc-400">
                    {item.country} · {item.category}
                  </div>
                </div>

                <BandPill value={item.status_band} />
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-4">
                <div className="rounded-2xl bg-black/20 p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                    Score
                  </div>
                  <div className="mt-2 text-3xl font-semibold text-white">
                    {item.score ?? 0}
                  </div>
                </div>

                <div className="rounded-2xl bg-black/20 p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                    Daily Signal
                  </div>
                  <div className="mt-2 text-3xl font-semibold text-white">
                    {item.daily_signal ?? 0}
                  </div>
                </div>

                <div className="rounded-2xl bg-black/20 p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                    Today Mentions
                  </div>
                  <div className="mt-2 text-3xl font-semibold text-white">
                    {item.today_mentions ?? 0}
                  </div>
                </div>

                <div className="rounded-2xl bg-black/20 p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                    Today Sources
                  </div>
                  <div className="mt-2 text-3xl font-semibold text-white">
                    {item.today_unique_sources ?? 0}
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-3 text-sm text-zinc-400 md:grid-cols-3">
                <div>
                  <span className="text-zinc-500">7d mentions:</span>{" "}
                  <span className="text-white">{item.mention_count_7d ?? 0}</span>
                </div>
                <div>
                  <span className="text-zinc-500">7d sources:</span>{" "}
                  <span className="text-white">{item.unique_sources_7d ?? 0}</span>
                </div>
                <div>
                  <span className="text-zinc-500">Last seen:</span>{" "}
                  <span className="text-white">{formatDateLike(item.last_seen_at_iso)}</span>
                </div>
              </div>
            </AdminSurface>
          ))
        )}
      </div>
    </AdminShell>
  );
}