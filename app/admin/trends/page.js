"use client";

import AdminShell from "../../../components/admin/AdminShell";
import AdminPageHeader from "../../../components/admin/AdminPageHeader";
import AdminSurface from "../../../components/admin/AdminSurface";
import AdminMetricCard from "../../../components/admin/AdminMetricCard";
import AdminActionButton from "../../../components/admin/AdminActionButton";
import { useCallback, useEffect, useMemo, useState } from "react";

const API_BASE =
  (process.env.NEXT_PUBLIC_ZAPTREND_API_BASE || "").replace(/\/$/, "");

const COUNTRY_OPTIONS = [
  { value: "SG", label: "SG" },
  { value: "TH", label: "TH" },
  { value: "MY", label: "MY" },
  { value: "IN", label: "IN" },
  { value: "VN", label: "VN" },
  { value: "PH", label: "PH" },
  { value: "HK", label: "HK" },
  { value: "TW", label: "TW" },
  { value: "KR", label: "KR" },
  { value: "AU", label: "AU" },
  { value: "JP", label: "JP" },
  { value: "ID", label: "ID" }
];

const CATEGORY_OPTIONS = [
  { value: "baby_kids", label: "baby_kids" },
  { value: "beauty_skincare", label: "beauty_skincare" },
  { value: "deals_duty_free", label: "deals_duty_free" },
  { value: "electronics_gadgets", label: "electronics_gadgets" },
  { value: "fashion_accessories", label: "fashion_accessories" },
  { value: "health_pharmacy", label: "health_pharmacy" },
  { value: "home_living", label: "home_living" },
  { value: "luxury_designer", label: "luxury_designer" },
  { value: "other", label: "other" },
  { value: "snacks_drinks", label: "snacks_drinks" },
  { value: "souvenirs_local_finds", label: "souvenirs_local_finds" },
  { value: "sports_outdoors", label: "sports_outdoors" },
  { value: "stationery_books", label: "stationery_books" },
  { value: "toys_collectibles", label: "toys_collectibles" }
];

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "HOT", label: "HOT" },
  { value: "TRENDING", label: "TRENDING" },
  { value: "WATCHLIST", label: "WATCHLIST" }
];

const DEFAULT_FILTERS = {
  country: "TH",
  category: "beauty_skincare",
  status: "",
  sourceMix: "all",
  limit: 20
};

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

function safeText(value, fallback = "-") {
  if (value === undefined || value === null || value === "") return fallback;
  return String(value);
}

function formatDateTime(value) {
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

function getSourceTypeSet(sourceTypes = []) {
  return new Set((sourceTypes || []).map((x) => String(x || "").trim().toLowerCase()));
}

function getSignalMix(item) {
  const set = getSourceTypeSet(item.source_types || []);
  const hasStable = set.has("source_scan");
  const hasSocial = set.has("social_signal");

  if (hasStable && hasSocial) return "dual";
  if (hasStable) return "stable";
  if (hasSocial) return "social";
  return "unknown";
}

function getSignalMixLabel(item) {
  const mix = getSignalMix(item);
  if (mix === "dual") return "Dual Confirmed";
  if (mix === "stable") return "Stable Only";
  if (mix === "social") return "Social Only";
  return "Unknown Mix";
}

function getConfidenceLabel(item) {
  const mix = getSignalMix(item);
  const mentions = Number(item.total_mentions || 0);
  const cumulative = Number(item.cumulative_score || 0);

  if (mix === "dual" && mentions >= 20 && cumulative >= 500) return "High Confidence";
  if (mix === "social" && mentions < 10) return "Early Signal";
  return "Validated";
}

function matchesSourceMix(item, sourceMix) {
  if (!sourceMix || sourceMix === "all") return true;
  return getSignalMix(item) === sourceMix;
}

function TrendStatusPill({ value }) {
  const text = safeText(value, "UNKNOWN").toUpperCase();
  const styles =
    text === "HOT"
      ? "bg-pink-500/20 text-pink-200 border-pink-400/30"
      : text === "TRENDING"
      ? "bg-cyan-500/20 text-cyan-200 border-cyan-400/30"
      : text === "WATCHLIST"
      ? "bg-amber-500/20 text-amber-200 border-amber-400/30"
      : "bg-zinc-500/20 text-zinc-200 border-zinc-400/20";

  return (
    <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${styles}`}>
      {text}
    </span>
  );
}

function RunStatusPill({ value }) {
  const text = safeText(value, "UNKNOWN").toUpperCase();
  const styles =
    text === "COMPLETED"
      ? "bg-emerald-500/20 text-emerald-200 border-emerald-400/30"
      : text === "RUNNING"
      ? "bg-cyan-500/20 text-cyan-200 border-cyan-400/30"
      : text === "FAILED"
      ? "bg-rose-500/20 text-rose-200 border-rose-400/30"
      : "bg-zinc-500/20 text-zinc-200 border-zinc-400/20";

  return (
    <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${styles}`}>
      {text}
    </span>
  );
}

function SignalMixPill({ item }) {
  const mix = getSignalMix(item);

  const styles =
    mix === "dual"
      ? "bg-emerald-500/20 text-emerald-200 border-emerald-400/30"
      : mix === "stable"
      ? "bg-cyan-500/20 text-cyan-200 border-cyan-400/30"
      : mix === "social"
      ? "bg-fuchsia-500/20 text-fuchsia-200 border-fuchsia-400/30"
      : "bg-zinc-500/20 text-zinc-200 border-zinc-400/20";

  return (
    <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${styles}`}>
      {getSignalMixLabel(item)}
    </span>
  );
}

function ConfidencePill({ item }) {
  const label = getConfidenceLabel(item);

  const styles =
    label === "High Confidence"
      ? "bg-emerald-500/20 text-emerald-200 border-emerald-400/30"
      : label === "Early Signal"
      ? "bg-amber-500/20 text-amber-200 border-amber-400/30"
      : "bg-cyan-500/20 text-cyan-200 border-cyan-400/30";

  return (
    <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${styles}`}>
      {label}
    </span>
  );
}

function FieldInput({ label, value, onChange, placeholder, type = "text" }) {
  return (
    <label className="block">
      <div className="mb-2 text-xs uppercase tracking-[0.16em] text-zinc-500">
        {label}
      </div>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={onChange}
        className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-cyan-400/40 focus:bg-black/30"
      />
    </label>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <label className="block">
      <div className="mb-2 text-xs uppercase tracking-[0.16em] text-zinc-500">
        {label}
      </div>
      <select
        value={value}
        onChange={onChange}
        className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/40 focus:bg-black/30"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} className="bg-zinc-900">
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function TrendCard({ item, rank }) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl shadow-[0_20px_80px_rgba(0,0,0,0.3)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.22em] text-zinc-500">
            Rank #{rank}
          </div>
          <h3 className="mt-2 text-2xl font-semibold text-white">
            {safeText(item.brand)} <span className="text-cyan-300">/</span>{" "}
            {safeText(item.product)}
          </h3>
          <div className="mt-2 text-sm text-zinc-400">
            {safeText(item.country)} · {safeText(item.category)} · {safeText(item.hashtag)}
          </div>
        </div>
        <TrendStatusPill value={item.trend_status} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <SignalMixPill item={item} />
        <ConfidencePill item={item} />
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl bg-black/20 p-4">
          <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">
            Trend Score
          </div>
          <div className="mt-2 text-3xl font-semibold text-white">
            {safeText(item.trend_score, "0")}
          </div>
        </div>

        <div className="rounded-2xl bg-black/20 p-4">
          <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">
            Mentions
          </div>
          <div className="mt-2 text-3xl font-semibold text-white">
            {safeText(item.total_mentions, "0")}
          </div>
        </div>

        <div className="rounded-2xl bg-black/20 p-4">
          <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">
            Cumulative Score
          </div>
          <div className="mt-2 text-3xl font-semibold text-white">
            {safeText(item.cumulative_score, "0")}
          </div>
        </div>

        <div className="rounded-2xl bg-black/20 p-4">
          <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">
            Last Signal
          </div>
          <div className="mt-2 text-3xl font-semibold text-white">
            {safeText(item.last_signal_score, "0")}
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {(item.source_types || []).map((s) => (
          <span
            key={s}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-200"
          >
            {s}
          </span>
        ))}
      </div>

      <div className="mt-5 grid gap-3 text-sm text-zinc-400 md:grid-cols-2">
        <div>
          <span className="text-zinc-500">Run ID:</span>{" "}
          <span className="text-white">{safeText(item.trend_run_id)}</span>
        </div>
        <div>
          <span className="text-zinc-500">Updated:</span>{" "}
          <span className="text-white">{formatDateTime(item.updated_at_iso)}</span>
        </div>
      </div>
    </div>
  );
}

function RunCard({ run }) {
  const generatedCount =
    run.generated_count ??
    (Array.isArray(run.trend_output_ids) ? run.trend_output_ids.length : 0);

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-white">
            {safeText(run.trend_run_id)}
          </div>
          <div className="mt-1 text-xs text-zinc-500">
            {safeText(run.country)} · {safeText(run.category)}
          </div>
        </div>
        <RunStatusPill value={run.status} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-white/5 p-3">
          <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">
            Scored
          </div>
          <div className="mt-1 text-lg font-semibold text-white">
            {safeText(run.scored_count, "0")}
          </div>
        </div>

        <div className="rounded-xl bg-white/5 p-3">
          <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">
            Generated
          </div>
          <div className="mt-1 text-lg font-semibold text-white">
            {safeText(generatedCount, "0")}
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-1 text-xs text-zinc-400">
        <div>
          <span className="text-zinc-500">Created:</span>{" "}
          <span className="text-white">{formatDateTime(run.created_at_iso)}</span>
        </div>
        <div>
          <span className="text-zinc-500">Updated:</span>{" "}
          <span className="text-white">{formatDateTime(run.updated_at_iso)}</span>
        </div>
        <div>
          <span className="text-zinc-500">Engine:</span>{" "}
          <span className="text-white">{safeText(run.engine_version, "v1")}</span>
        </div>
      </div>

      {run.error_message ? (
        <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">
          {run.error_message}
        </div>
      ) : null}
    </div>
  );
}

export default function TrendsPage() {
  const [outputs, setOutputs] = useState([]);
  const [runs, setRuns] = useState([]);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [loading, setLoading] = useState(false);
  const [runningAutomation, setRunningAutomation] = useState(false);
  const [automationMessage, setAutomationMessage] = useState("");

  const load = useCallback(async (activeFilters = filters) => {
    try {
      setLoading(true);
      setError("");

      const qs = new URLSearchParams();
      qs.set("country", activeFilters.country);
      qs.set("category", activeFilters.category);
      if (activeFilters.status) qs.set("status", activeFilters.status);
      qs.set("limit", String(activeFilters.limit));

      const [outputsRes, runsRes] = await Promise.all([
        fetchJson(`/admin/trends/outputs?${qs.toString()}`),
        fetchJson(
          `/admin/trends/runs?country=${activeFilters.country}&category=${activeFilters.category}&limit=10`
        )
      ]);

      setOutputs(outputsRes.rows || []);
      setRuns(runsRes.rows || []);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load(DEFAULT_FILTERS);
  }, [load]);

  const filteredOutputs = useMemo(() => {
    return outputs.filter((item) => matchesSourceMix(item, filters.sourceMix));
  }, [outputs, filters.sourceMix]);

  const summary = useMemo(() => {
    return {
      total: filteredOutputs.length,
      hot: filteredOutputs.filter((x) => String(x.trend_status).toUpperCase() === "HOT").length,
      trending: filteredOutputs.filter((x) => String(x.trend_status).toUpperCase() === "TRENDING").length,
      watchlist: filteredOutputs.filter((x) => String(x.trend_status).toUpperCase() === "WATCHLIST").length,
      runs: runs.length
    };
  }, [filteredOutputs, runs]);

  function updateFilter(key, value) {
    setFilters((prev) => ({
      ...prev,
      [key]: key === "limit" ? Number(value || 0) : value
    }));
  }

  function handleRefresh() {
    load(filters);
  }

  function handleReset() {
    setFilters(DEFAULT_FILTERS);
    load(DEFAULT_FILTERS);
  }

  async function handleRunAutomation() {
    try {
      setRunningAutomation(true);
      setAutomationMessage("");
      setError("");

      const payload = {
        country: filters.country,
        category: filters.category,
        scoreLimit: Number(filters.limit) || 20
      };

      const result = await fetchJson("/admin/trends/run-full-cycle", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      if (result?.ok === false) {
        throw new Error(result.error || "Automation failed");
      }

      setAutomationMessage(
        "Trend generation completed successfully. Refreshing data..."
      );

      await load(filters);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setRunningAutomation(false);
    }
  }

  return (
    <AdminShell>
      <AdminPageHeader
        title="Trend Intelligence"
        subtitle="Ranked trend outputs generated from signal memory, source scans, social signals, and cumulative scoring."
      />

      {error ? (
        <div className="mb-6 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-200">
          {error}
        </div>
      ) : null}

      {automationMessage ? (
        <div className="mb-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-200">
          {automationMessage}
        </div>
      ) : null}

      <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <AdminMetricCard title="Total Trends" value={summary.total} />
        <AdminMetricCard title="HOT" value={summary.hot} accent="pink" />
        <AdminMetricCard title="TRENDING" value={summary.trending} accent="cyan" />
        <AdminMetricCard title="WATCHLIST" value={summary.watchlist} accent="orange" />
        <AdminMetricCard title="Recent Runs" value={summary.runs} accent="emerald" />
      </div>

      <AdminSurface className="mb-8">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">
            Filters & Controls
          </div>
          {loading ? (
            <div className="text-xs uppercase tracking-[0.16em] text-cyan-300/70">
              Loading...
            </div>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-5">
          <SelectField
            label="Country"
            value={filters.country}
            onChange={(e) => updateFilter("country", e.target.value)}
            options={COUNTRY_OPTIONS}
          />

          <SelectField
            label="Category"
            value={filters.category}
            onChange={(e) => updateFilter("category", e.target.value)}
            options={CATEGORY_OPTIONS}
          />

          <SelectField
            label="Status"
            value={filters.status}
            onChange={(e) => updateFilter("status", e.target.value)}
            options={STATUS_OPTIONS}
          />

          <SelectField
            label="Source Mix"
            value={filters.sourceMix}
            onChange={(e) => updateFilter("sourceMix", e.target.value)}
            options={[
              { value: "all", label: "All Mixes" },
              { value: "stable", label: "Stable Only" },
              { value: "social", label: "Social Only" },
              { value: "dual", label: "Dual Confirmed" }
            ]}
          />

          <FieldInput
            label="Limit"
            type="number"
            value={filters.limit}
            placeholder="20"
            onChange={(e) => updateFilter("limit", e.target.value)}
          />
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <AdminActionButton
            label={loading ? "Refreshing..." : "Refresh"}
            tone="cyan"
            onClick={handleRefresh}
          />
          <AdminActionButton
            label="Reset"
            onClick={handleReset}
          />
          <AdminActionButton
            label={runningAutomation ? "Running Automation..." : "Run Automation"}
            tone="orange"
            onClick={handleRunAutomation}
          />
        </div>
      </AdminSurface>

      <div className="mb-8 grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        <div className="space-y-6">
          {loading && filteredOutputs.length === 0 ? (
            <AdminSurface>Loading trend outputs...</AdminSurface>
          ) : filteredOutputs.length === 0 ? (
            <AdminSurface>No trend outputs found.</AdminSurface>
          ) : (
            filteredOutputs.map((item, i) => (
              <AdminSurface key={item.id || `${item.brand}-${item.product}-${i}`} hover glow="cyan">
                <TrendCard item={item} rank={i + 1} />
              </AdminSurface>
            ))
          )}
        </div>

        <AdminSurface>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">
              Recent Runs
            </div>
            <div className="text-xs text-zinc-500">
              Top 10
            </div>
          </div>

          <div className="space-y-3">
            {runs.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-400">
                No recent runs found.
              </div>
            ) : (
              runs.map((run) => (
                <RunCard
                  key={run.id || run.trend_run_id}
                  run={run}
                />
              ))
            )}
          </div>
        </AdminSurface>
      </div>
    </AdminShell>
  );
}