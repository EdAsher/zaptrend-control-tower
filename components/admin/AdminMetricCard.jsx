import AdminSurface from "./AdminSurface";

export default function AdminMetricCard({
  title,
  value,
  subtitle = "",
  accent = "cyan"
}) {
  const accentMap = {
    cyan: {
      text: "text-cyan-300/80",
      dot: "bg-cyan-300",
      glow: "cyan"
    },
    emerald: {
      text: "text-emerald-300/80",
      dot: "bg-emerald-300",
      glow: "emerald"
    },
    pink: {
      text: "text-pink-300/80",
      dot: "bg-pink-300",
      glow: "pink"
    },
    orange: {
      text: "text-orange-300/80",
      dot: "bg-orange-300",
      glow: "orange"
    },
    violet: {
      text: "text-violet-300/80",
      dot: "bg-violet-300",
      glow: "cyan"
    },
    rose: {
      text: "text-rose-300/80",
      dot: "bg-rose-300",
      glow: "pink"
    }
  };

  const tone = accentMap[accent] || accentMap.cyan;

  return (
    <AdminSurface hover glow={tone.glow} className="group">
      <div className="flex items-center gap-2">
        <span className={`inline-flex h-2.5 w-2.5 rounded-full ${tone.dot} shadow-[0_0_14px_currentColor]`} />
        <div className={`text-[11px] uppercase tracking-[0.24em] ${tone.text}`}>
          {title}
        </div>
      </div>

      <div className="mt-5 text-5xl font-semibold leading-none tracking-tight text-white transition duration-300 group-hover:scale-[1.02]">
        {value}
      </div>

      {subtitle ? (
        <div className="mt-4 text-sm leading-6 text-zinc-400">{subtitle}</div>
      ) : null}
    </AdminSurface>
  );
}