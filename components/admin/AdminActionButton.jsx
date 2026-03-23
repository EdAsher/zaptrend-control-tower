export default function AdminActionButton({
  label,
  onClick,
  tone = "dark",
  disabled = false
}) {
  const toneMap = {
    cyan: "bg-cyan-400 text-black hover:bg-cyan-300 shadow-[0_10px_30px_rgba(34,211,238,0.20)]",
    orange: "bg-orange-500 text-white hover:bg-orange-400 shadow-[0_10px_30px_rgba(249,115,22,0.18)]",
    emerald: "bg-emerald-500 text-white hover:bg-emerald-400 shadow-[0_10px_30px_rgba(52,211,153,0.18)]",
    pink: "bg-pink-500 text-white hover:bg-pink-400 shadow-[0_10px_30px_rgba(236,72,153,0.18)]",
    dark: "border border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10"
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={[
        "group relative overflow-hidden rounded-2xl px-4 py-3 text-sm font-medium transition duration-200",
        "focus:outline-none",
        disabled ? "cursor-not-allowed opacity-60" : "hover:-translate-y-0.5",
        toneMap[tone] || toneMap.dark
      ].join(" ")}
    >
      <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.14),transparent_35%,transparent_65%,rgba(255,255,255,0.08))] opacity-0 transition duration-300 group-hover:opacity-100" />
      <span className="relative">{label}</span>
    </button>
  );
}