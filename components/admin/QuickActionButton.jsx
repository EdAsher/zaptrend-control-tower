export default function QuickActionButton({
  label,
  onClick,
  tone = "dark"
}) {
  const toneMap = {
    orange: "bg-orange-500 hover:bg-orange-400 text-white",
    blue: "bg-blue-500 hover:bg-blue-400 text-white",
    emerald: "bg-emerald-500 hover:bg-emerald-400 text-white",
    dark: "bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
  };

  return (
    <button
      onClick={onClick}
      className={`rounded-xl px-4 py-3 text-sm font-medium transition transform hover:-translate-y-0.5 ${toneMap[tone]}`}
    >
      {label}
    </button>
  );
}