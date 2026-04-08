"use client";

import { useEffect, useState } from "react";
import AdminShell from "../../../components/admin/AdminShell";
import AdminPageHeader from "../../../components/admin/AdminPageHeader";
import AdminSurface from "../../../components/admin/AdminSurface";

const API_BASE =
  (process.env.NEXT_PUBLIC_ZAPTREND_API_BASE || "").replace(/\/$/, "");

export default function SourcesPage() {
  const [data, setData] = useState([]);

  async function load() {
    const res = await fetch(`${API_BASE}/admin/lite/sources`);
    const json = await res.json();
    setData(json.results || []);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <AdminShell>
      <AdminPageHeader title="Social Sources" />

      <AdminSurface>
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th>Source</th>
              <th>Platform</th>
              <th>Country</th>
              <th>Category</th>
              <th>Health</th>
              <th>Last Checked</th>
            </tr>
          </thead>

          <tbody>
            {data.map((s) => (
              <tr key={s.source_id}>
                <td>{s.source_id}</td>
                <td>{s.platform}</td>
                <td>{s.country}</td>
                <td>{s.category}</td>
                <td>{s.health_status}</td>
                <td>{s.last_checked}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </AdminSurface>
    </AdminShell>
  );
}