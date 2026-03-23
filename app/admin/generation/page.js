"use client";

import AdminShell from "../../../components/admin/AdminShell";
import AdminPageHeader from "../../../components/admin/AdminPageHeader";
import AdminSurface from "../../../components/admin/AdminSurface";
import AdminMetricCard from "../../../components/admin/AdminMetricCard";
import AdminActionButton from "../../../components/admin/AdminActionButton";

import { useEffect, useState } from "react";

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

function Surface({ children, className = "" }) {
  return (
    <div
      className={`rounded-[28px] border border-white/10 bg-white/[0.04] backdrop-blur-xl shadow-[0_20px_80px_rgba(0,0,0,0.35)] ${className}`}
    >
      {children}
    </div>
  );
}

function MetricCard({ title, value }) {
  return (
    <Surface className="p-5">
      <div className="text-xs uppercase tracking-[0.22em] text-cyan-300/70">
        {title}
      </div>
      <div className="mt-3 text-4xl font-semibold text-white">{value}</div>
    </Surface>
  );
}

export default function GenerationPage() {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");

  async function load() {
    try {
      setError("");
      const res = await fetchJson("/admin/generation/status");
      setStatus(res);
    } catch (err) {
      setError(err.message || String(err));
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <AdminShell>
      <AdminPageHeader
        title="Generation Console"
        subtitle="Monitor AI trend generation status, queue health, and generation output pipelines."
      />

      {error ? (
        <div className="mb-6 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

<div className="mb-8 grid gap-4 md:grid-cols-3">
  <AdminMetricCard title="Queue Size" value={status?.queue_size} />
  <AdminMetricCard title="Generated Today" value={status?.generated_today} accent="cyan" />
  <AdminMetricCard title="Engine Status" value={status?.engine_status} accent="emerald" />
</div>

<AdminSurface className="mb-8">
  <div className="text-sm text-zinc-400">
    Monitor AI generation runs, queue processing, and output pipelines.
  </div>

  <div className="mt-4">
    <AdminActionButton label="Run Generation" tone="cyan" />
  </div>
</AdminSurface>
    </AdminShell>
  );
}