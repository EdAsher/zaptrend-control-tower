"use client";

import AdminShell from "../../../components/admin/AdminShell";
import AdminPageHeader from "../../../components/admin/AdminPageHeader";
import AdminSurface from "../../../components/admin/AdminSurface";
import AdminMetricCard from "../../../components/admin/AdminMetricCard";
import AdminActionButton from "../../../components/admin/AdminActionButton";

import { useEffect, useMemo, useState } from "react";

const API_BASE =
  (process.env.NEXT_PUBLIC_ZAPTREND_API_BASE || "").replace(/\/$/, "");

// ================= API =================
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

// ================= HELPERS =================
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

// ================= TABLE =================
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
              <th className="px-3 py-3">Source</th>
              <th className="px-3 py-3">Country</th>
              <th className="px-3 py-3">Category</th>
              <th className="px-3 py-3">Domain</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Health</th>
              <th className="px-3 py-3">Quality</th>
              <th className="px-3 py-3">Reputation</th>
              <th className="px-3 py-3">Trial</th>
              <th className="px-3 py-3">Updated</th>
              <th className="px-3 py-3">Actions</th>
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
                const sourceId = row.source_id || row.candidate_id || row.id;

                return (
                  <tr key={`${type}-${sourceId}`} className="border-b border-white/5">
                    <td className="px-3 py-3 text-white">
                      <div className="font-medium">{safeText(sourceId)}</div>
                      <div className="text-xs text-zinc-500">
                        {safeText(row.source_kind)}
                      </div>
                    </td>

                    <td className="px-3 py-3">{safeText(row.country)}</td>
                    <td className="px-3 py-3">{safeText(row.category)}</td>

                    <td className="px-3 py-3">
                      <div>{safeText(row.domain)}</div>
                      {row.url && (
                        <a
                          href={row.url}
                          target="_blank"
                          className="text-xs text-orange-300 hover:underline"
                        >
                          Open
                        </a>
                      )}
                    </td>

                    <td className="px-3 py-3">{safeText(row.status)}</td>

                    <td className="px-3 py-3">
                      <HealthPill status={row.health_status} />
                    </td>

                    <td className="px-3 py-3">
                      {safeText(row.quality_score, "0")}
                    </td>

                    <td className="px-3 py-3">
                      {safeText(row.source_reputation_score, "0")}
                    </td>

                    <td className="px-3 py-3">
                      {safeText(row.trial_status)}
                    </td>

                    <td className="px-3 py-3">
                      {formatDateLike(row.updated_at_iso)}
                    </td>

                    <td className="px-3 py-3">
                      <div className="flex gap-2 flex-wrap">
                        <AdminActionButton
                          label="Recheck"
                          tone="cyan"
                          onClick={() =>
                            onRecheck(sourceId, row.source_kind, row.country, row.category)
                          }
                        />
                        <AdminActionButton
                          label="Disable"
                          tone="pink"
                          onClick={() => onDisable(sourceId, row.source_kind)}
                        />
                        <AdminActionButton
                          label="Enable"
                          tone="emerald"
                          onClick={() => onEnable(sourceId, row.source_kind)}
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

// ================= PAGE =================
export default function SourcesPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loadingAction, setLoadingAction] = useState(false);

  async function load() {
    try {
      setError("");
      const result = await fetchSources({
        country: "TH",
        category: "beauty_skincare"
      });
      setData(result);
    } catch (err) {
      setError(err.message || String(err));
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleRecheck(id, kind, country, category) {
    try {
      setLoadingAction(true);
      await postAction("/admin/sources/recheck", {
        source_id: id,
        source_kind: kind,
        country,
        category
      });
      await load();
    } finally {
      setLoadingAction(false);
    }
  }

  async function handleDisable(id, kind) {
    try {
      setLoadingAction(true);
      await postAction("/admin/sources/disable", {
        source_id: id,
        source_kind: kind
      });
      await load();
    } finally {
      setLoadingAction(false);
    }
  }

  async function handleEnable(id, kind) {
    try {
      setLoadingAction(true);
      await postAction("/admin/sources/enable", {
        source_id: id,
        source_kind: kind
      });
      await load();
    } finally {
      setLoadingAction(false);
    }
  }

  const aiSources = useMemo(() => data?.ai_sources || [], [data]);
  const candidates = useMemo(() => data?.candidates || [], [data]);

  const summary = data?.summary || {};

  return (
    <AdminShell>
      <AdminPageHeader title="Sources Intelligence" />

      {error && <div className="text-rose-400 mb-4">{error}</div>}

      <div className="grid grid-cols-5 gap-4 mb-6">
        <AdminMetricCard title="Active Sources" value={summary.active_ai_sources} />
        <AdminMetricCard title="Candidates" value={summary.candidate_sources} />
        <AdminMetricCard title="Promoted" value={summary.promoted_candidates} />
        <AdminMetricCard title="Approved" value={summary.trial_approved} />
        <AdminMetricCard title="Rejected" value={summary.trial_rejected} />
      </div>

      <SourcesTable
        title="AI Sources"
        rows={aiSources}
        type="ai"
        onRecheck={handleRecheck}
        onDisable={handleDisable}
        onEnable={handleEnable}
      />

      <div className="mt-6" />

      <SourcesTable
        title="Candidates"
        rows={candidates}
        type="candidate"
        onRecheck={handleRecheck}
        onDisable={handleDisable}
        onEnable={handleEnable}
      />
    </AdminShell>
  );
}