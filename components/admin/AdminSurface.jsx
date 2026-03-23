export default function AdminSurface({
  children,
  className = "",
  padded = true,
  hover = false,
  glow = "none"
}) {
  const glowMap = {
    none: "",
    cyan: "shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_24px_80px_rgba(0,0,0,0.38),0_0_40px_rgba(34,211,238,0.08)]",
    pink: "shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_24px_80px_rgba(0,0,0,0.38),0_0_40px_rgba(236,72,153,0.08)]",
    emerald: "shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_24px_80px_rgba(0,0,0,0.38),0_0_40px_rgba(52,211,153,0.08)]",
    orange: "shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_24px_80px_rgba(0,0,0,0.38),0_0_40px_rgba(249,115,22,0.08)]"
  };

  return (
    <div
      className={[
        "relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.04] backdrop-blur-xl",
        "transition duration-300 ease-out",
        glowMap[glow] || glowMap.none,
        padded ? "p-5" : "",
        hover
          ? "hover:-translate-y-1 hover:border-white/15 hover:bg-white/[0.06]"
          : "",
        className
      ].join(" ")}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.05),transparent_34%)]" />
      <div className="relative">{children}</div>
    </div>
  );
}