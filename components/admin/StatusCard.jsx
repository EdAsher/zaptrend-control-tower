export default function StatusCard({ title, status, meta = [] }) {
  const normalized = String(status || "UNKNOWN").toUpperCase();

  const tone =
    normalized === "COMPLETED"
      ? "text-emerald-300 border-emerald-400/20 bg-emerald-400/10"
      : normalized === "FAILED"
      ? "text-rose-300 border-rose-400/20 bg-rose-400/10"
      : "text-zinc-300 border-zinc-400/20 bg-zinc-400/10";

  return (
    <div className="rounded-[26px] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
      <div className="flex items-start justify-between">
        <div className="text-sm uppercase tracking-[0.18em] text-zinc-500">
          {title}
        </div>

        <span className={`rounded-full border px-2.5 py-1 text-xs ${tone}`}>
          {normalized}
        </span>
      </div>

      <div className="mt-5 space-y-3">
        {meta.map((item) => (
          <div key={item.label} className="flex justify-between text-sm">
            <div className="text-zinc-400">{item.label}</div>
            <div className="text-white">{item.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}