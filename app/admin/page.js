"use client";

import { useState } from "react";
import AdminShell from "../../components/admin/AdminShell";
import AdminPageHeader from "../../components/admin/AdminPageHeader";
import AdminSurface from "../../components/admin/AdminSurface";
import AdminActionButton from "../../components/admin/AdminActionButton";

const API_BASE =
  (process.env.NEXT_PUBLIC_ZAPTREND_API_BASE || "").replace(/\/$/, "");

export default function AdminOverviewPage() {
  const [country, setCountry] = useState("TH");
  const [category, setCategory] = useState("beauty_skincare");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  async function run(path) {
    try {
      setLoading(true);
      setMsg("");
      await fetch(`${API_BASE}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country, category })
      });
      setMsg("Run completed ✅");
    } catch (err) {
      setMsg(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AdminShell>
      <AdminPageHeader
        title="ZapTrend Lite"
        subtitle="Simple social trend consensus engine"
      />

      <AdminSurface>
        <div className="grid gap-4 md:grid-cols-2">
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="input"
          >
            <option value="TH">TH</option>
            <option value="SG">SG</option>
            <option value="MY">MY</option>
          </select>

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="input"
          >
            <option value="beauty_skincare">beauty_skincare</option>
            <option value="snacks_drinks">snacks_drinks</option>
          </select>
        </div>

        <div className="mt-6 flex gap-3">
          <AdminActionButton
            label="Run Social Scan"
            tone="cyan"
            onClick={() => run("/admin/lite/social/run")}
            disabled={loading}
          />

          <AdminActionButton
            label="Run Trend Engine"
            tone="pink"
            onClick={() => run("/admin/lite/trends/run")}
            disabled={loading}
          />
        </div>

        {msg && (
          <div className="mt-4 text-sm text-zinc-400">{msg}</div>
        )}
      </AdminSurface>
    </AdminShell>
  );
}