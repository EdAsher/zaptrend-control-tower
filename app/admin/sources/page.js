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

function StatusPill({ value, tone = "neutral" }) {
  const styles = {
    healthy: "border-emerald-400/30 bg-emerald-500/10 text-emerald-300",
    active: "border-cyan-400/30 bg-cyan-500/10 text-cyan-300",
    unavailable: "border-rose-400/30 bg-rose-500/10 text-rose-300",
    disabled: "border-zinc-400/20 bg-zinc-500/10 text-zinc-300",
    neutral: "border-white/10 bg-white/5 text-zinc-300",
    warn: "border-amber-400/30 bg-amber-500/10 text-amber-300"
  };

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${
        styles[tone] || styles.neutral
      }`}
    >
      {value}
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

export default function SourcesPage() {
  const [country, setCountry] = useState("TH");
  const [category, setCategory] = useState("beauty_skincare");
  const [data, setData] = useState([]);
  const [error, setError] = useState("");

  async function load() {
    try {
      setError("");
      const json = await fetchJson(
        `/admin/lite/sources?country=${encodeURIComponent(country)}&category=${encodeURIComponent(category)}`
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
    const healthy = data.filter((x) => x.health_status === "healthy" && !x.auto_disabled).length;
    const unhealthy = data.filter((x) => x.health_status !== "healthy" || x.auto_disabled).length;
    const active = data.filter((x) => x.status === "active").length;
    const disabled = data.filter((x) => x.status === "disabled").length;

    return {
      total: data.length,
      healthy,
      unhealthy,
      active,
      disabled
    };
  }, [data]);

  return (
    <AdminShell>
      <AdminPageHeader
        title="Social Sources"
        subtitle="Discovered reviewer sources, health state, availability, and active scanning pool."
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
          title="Total Sources"
          value={summary.total}
          subtitle="All discovered sources"
          accent="cyan"
        />
        <AdminMetricCard
          title="Healthy Sources"
          value={summary.healthy}
          subtitle="Eligible for scan runs"
          accent="emerald"
        />
        <AdminMetricCard
          title="Unhealthy Sources"
          value={summary.unhealthy}
          subtitle="Unavailable or flagged"
          accent="rose"
        />
        <AdminMetricCard
          title="Disabled Sources"
          value={summary.disabled}
          subtitle="Auto-disabled or inactive"
          accent="orange"
        />
      </div>

      <AdminSurface>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-zinc-400">
              <tr>
                <th>Source</th>
                <th>Platform</th>
                <th>Status</th>
                <th>Health</th>
                <th>Posts</th>
                <th>Last Checked</th>
                <th>Next Health Check</th>
              </tr>
            </thead>

            <tbody>
              {data.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-zinc-500">
                    No sources found for this country/category.
                  </td>
                </tr>
              ) : (
                data.map((s) => (
                  <tr key={s.source_id}>
                    <td>
                      <div className="font-medium text-white">
                        {s.display_name || s.source_id}
                      </div>
                      <div className="mt-1 text-xs text-zinc-500">
                        {s.handle || "-"}
                      </div>
                    </td>

                    <td>
                      <div className="text-white">{s.platform || "-"}</div>
                      <div className="mt-1 text-xs text-zinc-500">
                        {s.country} · {s.category}
                      </div>
                    </td>

                    <td>
                      <div className="flex flex-wrap gap-2">
                        <StatusPill
                          value={s.status || "-"}
                          tone={s.status === "active" ? "active" : "disabled"}
                        />
                        {s.auto_disabled ? (
                          <StatusPill value="auto-disabled" tone="warn" />
                        ) : null}
                      </div>
                    </td>

                    <td>
                      <div className="flex flex-col gap-2">
                        <StatusPill
                          value={s.health_status || "-"}
                          tone={
                            s.health_status === "healthy"
                              ? "healthy"
                              : s.health_status === "unavailable"
                              ? "unavailable"
                              : "neutral"
                          }
                        />
                        <div className="text-xs text-zinc-500">
                          {s.health_reason || "-"}
                        </div>
                      </div>
                    </td>

                    <td>
                      <div className="text-white">{s.post_count ?? 0}</div>
                      <div className="mt-1 text-xs text-zinc-500">
                        fail count: {s.health_fail_count ?? 0}
                      </div>
                    </td>

                    <td>
                      <div className="text-white">
                        {formatDateLike(s.health_last_checked || s.last_checked)}
                      </div>
                    </td>

                    <td>
                      <div className="text-white">
                        {formatDateLike(s.next_health_check_at)}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </AdminSurface>
    </AdminShell>
  );
}