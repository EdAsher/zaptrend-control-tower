export default function AdminStatusPill({ value }) {
  const text = String(value || "UNKNOWN").toUpperCase();

  const tone =
    text === "COMPLETED" || text === "ACTIVE" || text === "HEALTHY"
      ? "text-emerald-300 border-emerald-400/20 bg-emerald-400/10 shadow-[0_0_20px_rgba(52,211,153,0.10)]"
      : text === "RUNNING" || text === "TRENDING" || text === "NEW_RISING"
      ? "text-cyan-300 border-cyan-400/20 bg-cyan-400/10 shadow-[0_0_20px_rgba(34,211,238,0.10)]"
      : text === "HOLDING"
      ? "text-orange-300 border-orange-400/20 bg-orange-400/10 shadow-[0_0_20px_rgba(249,115,22,0.10)]"
      : text === "UNAVAILABLE" || text === "DISABLED" || text === "ARCHIVE_READY"
      ? "text-zinc-300 border-zinc-400/20 bg-zinc-400/10"
      : text === "FAILED" || text === "ERROR"
      ? "text-rose-300 border-rose-400/20 bg-rose-400/10 shadow-[0_0_20px_rgba(244,63,94,0.10)]"
      : "text-zinc-300 border-zinc-400/20 bg-zinc-400/10";

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium tracking-[0.06em] ${tone}`}
    >
      {text}
    </span>
  );
}