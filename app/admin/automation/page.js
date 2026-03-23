"use client";

import AdminShell from "../../../components/admin/AdminShell";
import AdminPageHeader from "../../../components/admin/AdminPageHeader";
import AdminSurface from "../../../components/admin/AdminSurface";
import AdminMetricCard from "../../../components/admin/AdminMetricCard";
import AdminActionButton from "../../../components/admin/AdminActionButton";

import { useEffect, useMemo, useState } from "react";

const API_BASE =
  (process.env.NEXT_PUBLIC_ZAPTREND_API_BASE || "").replace(/\/$/, "");

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

function safeText(value, fallback = "-") {
  if (value === undefined || value === null || value === "") return fallback;
  return String(value);
}

function Surface({ children, className = "" }) {
  return (
    <div
      className={`rounded-[28px] border border-white/10 bg-white/[0.04] backdrop-blur-xl shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_20px_80px_rgba(0,0,0,0.35)] ${className}`}
    >
      {children}
    </div>
  );
}

function MetricCard({ title, value, subtitle }) {
  return (
    <Surface className="p-5">
      <div className="text-xs uppercase tracking-[0.22em] text-cyan-300/70">
        {title}
      </div>
      <div className="mt-3 text-4xl font-semibold text-white">{value}</div>
      {subtitle ? <div className="mt-2 text-sm text-zinc-400">{subtitle}</div> : null}
    </Surface>
  );
}

function StatusPill({ value }) {
  const text = safeText(value).toUpperCase();

  const tone =
    text === "COMPLETED"
      ? "text-emerald-300 border-emerald-400/20 bg-emerald-400/10"
      : text === "FAILED"
      ? "text-rose-300 border-rose-400/20 bg-rose-400/10"
      : text === "RUNNING"
      ? "text-cyan-300 border-cyan-400/20 bg-cyan-400/10"
      : "text-zinc-300 border-zinc-400/20 bg-zinc-400/10";

  return (
    <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${tone}`}>
      {text}
    </span>
  );
}

function TopTrends({ trends = [] }) {
  if (!trends.length) {
    return <div className="text-sm text-zinc-500">No top trends recorded.</div>;
  }

  return (
    <div className="space-y-3">
      {trends.map((item, index) => (
        <div
          key={`${item.brand}-${item.product}-${index}`}
          className="rounded-2xl border border-white/10 bg-black/20 p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                Rank #{index + 1}
              </div>
              <div className="mt-2 text-base font-semibold text-white">
                {safeText(item.brand)} / {safeText(item.product)}
              </div>
            </div>

            <div className="text-right">
              <div className="text-xs text-zinc-500">Trend Score</div>
              <div className="mt-1 text-xl font-semibold text-cyan-300">
                {safeText(item.trend_score, "0")}
              </div>
            </div>
          </div>

          <div className="mt-2 text-xs text-zinc-400">
            Status: {safeText(item.trend_status)}
          </div>
        </div>
      ))}
    </div>
  );
}

function AutomationRunCard({ item }) {
  return (
    <Surface className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">
            Automation Run
          </div>
          <div className="mt-2 text-lg font-semibold text-white">
            {safeText(item.automation_run_id || item.id)}
          </div>
          <div className="mt-2 text-sm text-zinc-400">
            {safeText(item.country)} · {safeText(item.category)}
          </div>
        </div>

        <StatusPill value={item.status} />
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl bg-black/20 p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">
            Sources Scanned
          </div>
          <div className="mt-2 text-2xl font-semibold text-white">
            {safeText(item.sources_scanned, "0")}
          </div>
        </div>

        <div className="rounded-2xl bg-black/20 p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">
            Signals Extracted
          </div>
          <div className="mt-2 text-2xl font-semibold text-white">
            {safeText(item.signals_extracted, "0")}
          </div>
        </div>

        <div className="rounded-2xl bg-black/20 p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">
            Ingested
          </div>
          <div className="mt-2 text-2xl font-semibold text-white">
            {safeText(item.ingested_count, "0")}
          </div>
        </div>

        <div className="rounded-2xl bg-black/20 p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">
            Scored Trends
          </div>
          <div className="mt-2 text-2xl font-semibold text-white">
            {safeText(item.scored_count, "0")}
          </div>
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-3 text-xs uppercase tracking-[0.18em] text-zinc-500">
          Top Trends
        </div>
        <TopTrends trends={item.top_trends || []} />
      </div>

      <div className="mt-4 text-xs text-zinc-500">
        Started: {safeText(item.started_at_iso)} <br />
        Finished: {safeText(item.finished_at_iso)}
      </div>
    </Surface>
  );
}

function MultiRunCard({ item }) {
  return (
    <Surface className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">
            Multi-Market Run
          </div>
          <div className="mt-2 text-lg font-semibold text-white">
            {safeText(item.multi_run_id || item.id)}
          </div>
        </div>

        <StatusPill value={item.status} />
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl bg-black/20 p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">
            Combinations
          </div>
          <div className="mt-2 text-2xl font-semibold text-white">
            {safeText(item.total_combinations, "0")}
          </div>
        </div>

        <div className="rounded-2xl bg-black/20 p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">
            Success
          </div>
          <div className="mt-2 text-2xl font-semibold text-emerald-300">
            {safeText(item.success_count, "0")}
          </div>
        </div>

        <div className="rounded-2xl bg-black/20 p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">
            Failed
          </div>
          <div className="mt-2 text-2xl font-semibold text-rose-300">
            {safeText(item.failed_count, "0")}
          </div>
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-3 text-xs uppercase tracking-[0.18em] text-zinc-500">
          Results
        </div>

        <div className="space-y-3">
          {(item.results || []).length === 0 ? (
            <div className="text-sm text-zinc-500">No results.</div>
          ) : (
            item.results.map((r, index) => (
              <div
                key={`${r.country}-${r.category}-${index}`}
                className="rounded-2xl border border-white/10 bg-black/20 p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-white">
                      {safeText(r.country)} / {safeText(r.category)}
                    </div>
                    <div className="mt-1 text-xs text-zinc-400">
                      Automation Run: {safeText(r.automation_run_id)}
                    </div>
                    <div className="mt-1 text-xs text-zinc-400">
                      Trend Run: {safeText(r.trend_run_id)}
                    </div>
                  </div>

                  <StatusPill value={r.ok ? "COMPLETED" : "FAILED"} />
                </div>

                <div className="mt-3 text-xs text-zinc-400">
                  Scored: {safeText(r.scored_count, "0")} · Sources: {safeText(r.sources_scanned, "0")}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Surface>
  );
}

export default function AutomationPage() {
  const [automationRuns, setAutomationRuns] = useState([]);
  const [multiRuns, setMultiRuns] = useState([]);
  const [error, setError] = useState("");

  async function load() {
    try {
      setError("");

      const [singleRes, multiRes] = await Promise.all([
        fetchJson("/admin/trends/automation-runs?country=TH&category=beauty_skincare&limit=10"),
        fetchJson("/admin/trends/multi-runs?limit=10")
      ]);

      setAutomationRuns(singleRes.rows || []);
      setMultiRuns(multiRes.rows || []);
    } catch (err) {
      setError(err.message || String(err));
    }
  }

  useEffect(() => {
    load();
  }, []);

  const summary = useMemo(() => {
    const latestSingle = automationRuns[0];
    const latestMulti = multiRuns[0];

    return {
      singleRuns: automationRuns.length,
      multiRuns: multiRuns.length,
      latestSignals: latestSingle?.signals_extracted || 0,
      latestScored: latestSingle?.scored_count || 0,
      latestMultiSuccess: latestMulti?.success_count || 0,
      latestMultiFailed: latestMulti?.failed_count || 0
    };
  }, [automationRuns, multiRuns]);

  return (
  <AdminShell>
<AdminPageHeader
  title="Automation Command Center"
  subtitle="Monitor autonomous trend runs, multi-market orchestrations, signal volume, success rates, and top trend outcomes."
/>

          {error ? (
            <div className="mb-6 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
              {error}
            </div>
          ) : null}

<div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
  <AdminMetricCard title="Single Runs" value={summary.singleRuns} />
  <AdminMetricCard title="Multi Runs" value={summary.multiRuns} />
  <AdminMetricCard title="Signals" value={summary.latestSignals} accent="cyan" />
  <AdminMetricCard title="Scored" value={summary.latestScored} />
  <AdminMetricCard title="Success" value={summary.latestMultiSuccess} accent="emerald" />
  <AdminMetricCard title="Failed" value={summary.latestMultiFailed} accent="rose" />
</div>

<div className="mb-8 grid gap-6 xl:grid-cols-2">
  <div className="space-y-6">
    {automationRuns.map((item) => (
      <AdminSurface key={item.id} hover glow="cyan">
        <AutomationRunCard item={item} />
      </AdminSurface>
    ))}
  </div>

  <div className="space-y-6">
    {multiRuns.map((item) => (
      <AdminSurface key={item.id} hover glow="pink">
        <MultiRunCard item={item} />
      </AdminSurface>
    ))}
  </div>
</div>
    </AdminShell>
  );
}