"use client";

import { useEffect, useState } from "react";
import AdminShell from "../../../components/admin/AdminShell";
import AdminPageHeader from "../../../components/admin/AdminPageHeader";
import AdminSurface from "../../../components/admin/AdminSurface";

const API_BASE =
  (process.env.NEXT_PUBLIC_ZAPTREND_API_BASE || "").replace(/\/$/, "");

export default function TrendsPage() {
  const [data, setData] = useState([]);

  async function load() {
    const res = await fetch(`${API_BASE}/admin/lite/trends/latest`);
    const json = await res.json();
    setData(json.results || []);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <AdminShell>
      <AdminPageHeader title="Trend Items" />

      <div className="grid gap-4">
        {data.map((item, i) => (
          <AdminSurface key={i}>
            <div className="text-lg font-semibold">
              #{i + 1} {item.name}
            </div>

            <div className="text-sm text-zinc-400 mt-1">
              {item.country} · {item.category}
            </div>

            <div className="mt-3 flex gap-6 text-sm">
              <div>Mentions: {item.mention_count}</div>
              <div>Sources: {item.unique_sources}</div>
              <div>Score: {item.score}</div>
            </div>
          </AdminSurface>
        ))}
      </div>
    </AdminShell>
  );
}