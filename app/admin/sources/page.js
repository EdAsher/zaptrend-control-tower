"use client";

import AdminShell from "../../../components/admin/AdminShell";
import AdminPageHeader from "../../../components/admin/AdminPageHeader";
import AdminSurface from "../../../components/admin/AdminSurface";
import AdminMetricCard from "../../../components/admin/AdminMetricCard";
import AdminActionButton from "../../../components/admin/AdminActionButton";

import { useEffect, useMemo, useState } from "react";

const API_BASE =
  (process.env.NEXT_PUBLIC_ZAPTREND_API_BASE || "").replace(/\/$/, "");

async function fetchSources(params = {}) {
  const qs = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      qs.set(key, String(value));
    }
  });

  const url = `${API_BASE}/admin/sources${qs.toString() ? `?${qs}` : ""}`;

  const res = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store"
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data?.error || `Request failed: ${res.status}`);
  }

  return data;
}

async function postAction(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok || data?.ok === false) {
    throw new Error(data?.error || `Request failed: ${res.status}`);
  }

  return data;
}

function safeText(value, fallback = "-") {
  if (value === undefined || value === null || value === "") return fallback;
  return String(value);
}

function formatDateLike(value) {
  if (!value) return "-";

  if (typeof value === "string") return value;

  if (value?._seconds) {
    try {
      return new Date(value._seconds * 1000).toISOString();
    } catch {
      return "-";
    }
  }

  return "-";
}

function Pill({ children }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-zinc-200">
      {children}
    </span>
  );
}

function HealthPill({ status }) {
  const normalized = String(status || "unknown").toLowerCase();

  const styles =
    normalized === "healthy"
      ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300"
      : normalized === "warning"
      ? "border-amber-400/30 bg-amber-500/10 text-amber-300"
      : normalized === "dead"
      ? "border-rose-400/30 bg-rose-500/10 text-rose-300"
      : normalized === "disabled"
      ? "border-zinc-400/20 bg-zinc-500/10 text-zinc-300"
      : "border-cyan-400/20 bg-cyan-500/10 text-cyan-300";

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${styles}`}
    >
      {safeText(normalized)}
    </span>
  );
}

function SourcesTable({ title, rows, type, onRecheck, onDisable, onEnable }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-5 backdrop-blur">
      <div className="mb-4 flex items-center justify-between">
        <div className="text-base font-semibold text-white">{title}</div>
        <Pill>{rows.length} rows</Pill>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-zinc-400">
            <tr className="border-b border-white/10">
              <th className="px-3 py-3 font-medium">Source</th>
              <th className="px-3 py-3 font-medium">Country</th>
              <th className="px-3 py-3 font-medium">Category</th>
              <th className="px-3 py-3 font-medium">Domain</th>
              <th className="px-3 py-3 font-medium">Status</th>
              <th className="px-3 py-3 font-medium">Health</th>
              <th className="px-3 py-3 font-medium">Quality</th>
              <th className="px-3 py-3 font-medium">Reputation</th>
              <th className="px-3 py-3 font-medium">Trial</th>
              <th className="px-3 py-3 font-medium">Updated</th>
              <th className="px-3 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-3 py-6 text-center text-zinc-500">
                  No records found.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const status =
                  row.status ||
                  row.promotion_status ||
                  row.trial_status ||
                  "-";

                const sourceId = row.source_id || row.candidate_id || row.id;

                return (
                  <tr
                    key={`${type}-${sourceId}`}
                    className="border-b border-white/5 align-top"
                  >
                    <td className="px-3 py-3 text-white">
                      <div className="font-medium">{safeText(sourceId)}</div>
                      <div className="mt-1 text-xs text-zinc-500">
                        {safeText(row.source_kind)}
                      </div>
                    </td>

                    <td className="px-3 py-3 text-zinc-200">
                      {safeText(row.country)}
                    </td>

                    <td className="px-3 py-3 text-zinc-200">
                      {safeText(row.category)}
                    </td>

                    <td className="px-3 py-3 text-zinc-200">
                      <div>{safeText(row.domain)}</div>
                      {row.url ? (
                        <a
                          href={row.url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 inline-block text-xs text-orange-300 hover:underline"
                        >
                          Open
                        </a>
                      ) : null}
                    </td>

                    <td className="px-3 py-3 text-zinc-200">
                      {safeText(status)}
                    </td>

                    <td className="px-3 py-3 text-zinc-200">
                      <div className="flex flex-col gap-1">
                        <HealthPill status={row.health_status} />

                        {row.health_http_status ? (
                          <span className="text-[10px] text-zinc-500">
                            HTTP {row.health_http_status}
                          </span>
                        ) : null}

                        {Number(row.health_fail_count || 0) > 0 ? (
                          <span className="text-[10px] text-rose-300">
                            fails: {row.health_fail_count}
                          </span>
                        ) : null}

                        {row.auto_disabled ? (
                          <span className="text-[10px] text-amber-300">
                            auto-disabled
                          </span>
                        ) : null}
                      </div>
                    </td>

                    <td className="px-3 py-3 text-zinc-200">
                      {safeText(row.quality_score, "0")}
                    </td>

                    <td className="px-3 py-3 text-zinc-200">
                      {safeText(
                        row.reputation_score ?? row.source_reputation_score,
                        "0"
                      )}
                    </td>

                    <td className="px-3 py-3 text-zinc-200">
                      {safeText(row.trial_status ?? row.last_trial_decision)}
                    </td>

                    <td className="px-3 py-3 text-zinc-400">
                      {formatDateLike(row.updated_at || row.updated_at_iso)}
                    </td>

                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        <AdminActionButton
                          label="Recheck"
                          tone="cyan"
                          onClick={() => onRecheck(sourceId)}
                        />
                        <AdminActionButton
                          label="Disable"
                          tone="pink"
                          onClick={() => onDisable(sourceId)}
                        />
                        <AdminActionButton
                          label="Enable"
                          tone="emerald"
                          onClick={() => onEnable(sourceId)}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function SourcesPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loadingAction, setLoadingAction] = useState(false);
  const [filters, setFilters] = useState({
    country: "TH",
    category: "beauty_skincare",
    status: "",
    limit: 100
  });

  async function load(activeFilters = filters) {
    try {
      setError("");
      const result = await fetchSources(activeFilters);
      setData(result);
    } catch (err) {
      setError(err.message || String(err));
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleRecheck(sourceId) {
    try {
      setLoadingAction(true);
      setError("");
      await postAction("/admin/sources/recheck", {
        source_id: sourceId
      });
      await load();
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoadingAction(false);
    }
  }

  async function handleDisable(sourceId) {
    try {
      setLoadingAction(true);
      setError("");
      await postAction("/admin/sources/disable", {
        source_id: sourceId
      });
      await load();
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoadingAction(false);
    }
  }

  async function handleEnable(sourceId) {
    try {
      setLoadingAction(true);
      setError("");
      await postAction("/admin/sources/enable", {
        source_id: sourceId
      });
      await load();
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoadingAction(false);
    }
  }

  const summary = data?.summary || {};

  const aiSources = useMemo(() => data?.ai_sources || [], [data]);
  const candidates = useMemo(() => data?.candidates || [], [data]);

  return (
    <AdminShell>
      <AdminPageHeader
        title="Sources Intelligence"
        subtitle="Monitor AI discovery sources, candidate pipelines, trial outcomes, reputation, promotion status, health, and manual controls."
      />

      {error ? (
        <div className="mb-6 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <AdminMetricCard title="Active Sources" value={summary.active_ai_sources} accent="emerald" />
        <AdminMetricCard title="Candidates" value={summary.candidate_sources} />
        <AdminMetricCard title="Promoted" value={summary.promoted_candidates} accent="cyan" />
        <AdminMetricCard title="Approved" value={summary.trial_approved} accent="emerald" />
        <AdminMetricCard title="Rejected" value={summary.trial_rejected} accent="rose" />
      </div>

      <AdminSurface className="mb-8">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-xs uppercase text-zinc-500">Filters</div>
          {loadingAction ? (
            <div className="text-xs text-cyan-300">Updating source...</div>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <input className="input" placeholder="Country" />
          <input className="input" placeholder="Category" />
          <input className="input" placeholder="Status" />
          <input className="input" placeholder="Limit" />
        </div>

        <div className="mt-4 flex gap-3">
          <AdminActionButton label="Refresh" tone="orange" onClick={() => load()} />
          <AdminActionButton label="Reset" />
        </div>
      </AdminSurface>

      <div className="mb-8 space-y-6">
        <AdminSurface>
          <SourcesTable
            title="AI Sources"
            rows={aiSources}
            type="ai"
            onRecheck={handleRecheck}
            onDisable={handleDisable}
            onEnable={handleEnable}
          />
        </AdminSurface>

        <AdminSurface>
          <SourcesTable
            title="Candidates"
            rows={candidates}
            type="candidate"
            onRecheck={handleRecheck}
            onDisable={handleDisable}
            onEnable={handleEnable}
          />
        </AdminSurface>
      </div>
    </AdminShell>
  );
}