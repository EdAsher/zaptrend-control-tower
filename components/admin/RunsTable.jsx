export default function RunsTable({ title, rows = [] }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-5 backdrop-blur">
      <div className="mb-4 text-base font-semibold text-white">{title}</div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-zinc-400">
              <th className="pb-3 pr-4">Run ID</th>
              <th className="pb-3 pr-4">Country</th>
              <th className="pb-3 pr-4">Category</th>
              <th className="pb-3 pr-4">Status</th>
              <th className="pb-3 pr-4">Date</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-4 text-zinc-500">No rows.</td>
              </tr>
            ) : rows.map((row) => (
              <tr key={row.id} className="border-b border-white/5 text-zinc-200">
                <td className="py-3 pr-4">{row.run_id || row.id}</td>
                <td className="py-3 pr-4">{row.country || "-"}</td>
                <td className="py-3 pr-4">{row.category_id || row.category || "-"}</td>
                <td className="py-3 pr-4">{row.status || "-"}</td>
                <td className="py-3 pr-4">{row.date_utc || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}