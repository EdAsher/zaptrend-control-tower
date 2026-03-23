export default function StatCard({
  title,
  value,
  subtitle,
  accent = "cyan"
}) {
  const accentMap = {
    cyan: "text-cyan-300",
    emerald: "text-emerald-300",
    rose: "text-rose-300",
    violet: "text-violet-300",
    orange: "text-orange-300",
    blue: "text-blue-300"
  };

  return (
    <div className="rounded-[26px] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_20px_60px_rgba(0,0,0,0.35)] transition hover:-translate-y-0.5 hover:bg-white/[0.06]">
      <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">
        {title}
      </div>

      <div className={`mt-3 text-4xl font-semibold ${accentMap[accent] || "text-white"}`}>
        {value}
      </div>

      {subtitle && (
        <div className="mt-2 text-sm text-zinc-400">
          {subtitle}
        </div>
      )}
    </div>
  );
}