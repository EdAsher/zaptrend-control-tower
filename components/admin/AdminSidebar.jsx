"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const nav = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/sources", label: "Sources" },
  { href: "/admin/trends", label: "Trends" }
];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden xl:flex xl:w-[290px] xl:flex-col">
      <div className="sticky top-0 h-screen p-5">
        <div className="zt-surface relative flex h-full flex-col overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(236,72,153,0.10),transparent_24%)]" />

          <div className="relative border-b border-white/10 px-6 py-6">
            <div className="text-[11px] uppercase tracking-[0.35em] text-cyan-300/80">
              ZapTrend
            </div>
            <div className="mt-3 text-[28px] font-semibold tracking-tight text-white">
              Control Tower
            </div>
            <div className="mt-2 max-w-[220px] text-sm leading-6 text-zinc-400">
              Futuristic intelligence and automation console.
            </div>
          </div>

          <div className="relative px-4 py-4">
            <div className="mb-3 px-3 text-[11px] uppercase tracking-[0.24em] text-zinc-500">
              Navigation
            </div>

            <div className="space-y-2">
              {nav.map((item) => {
                const active =
                  item.href === "/admin"
                    ? pathname === "/admin"
                    : pathname?.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={[
                      "group relative flex items-center gap-3 overflow-hidden rounded-2xl px-4 py-3 text-sm transition duration-200",
                      active
                        ? "border border-cyan-400/20 bg-cyan-400/10 text-white shadow-[0_0_0_1px_rgba(34,211,238,0.05),0_12px_30px_rgba(34,211,238,0.08)]"
                        : "border border-transparent text-zinc-300 hover:border-white/10 hover:bg-white/5 hover:text-white"
                    ].join(" ")}
                  >
                    {active ? (
                      <span className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-cyan-300" />
                    ) : null}

                    <span
                      className={[
                        "inline-flex h-9 w-9 items-center justify-center rounded-xl border text-xs transition",
                        active
                          ? "border-cyan-300/20 bg-cyan-300/10 text-cyan-200"
                          : "border-white/10 bg-black/20 text-zinc-300 group-hover:text-white"
                      ].join(" ")}
                    >
                      {item.icon}
                    </span>

                    <span className="font-medium tracking-[0.01em]">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="relative mt-auto border-t border-white/10 px-6 py-5">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" />
                <span className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                  Status
                </span>
              </div>

              <div className="mt-3 text-sm font-medium text-emerald-300">
                Engine online
              </div>
              <div className="mt-1 text-xs leading-5 text-zinc-500">
                Sources, trends, generation, automation.
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}