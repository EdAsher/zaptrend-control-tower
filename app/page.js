export default function HomePage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center px-6 py-16">
        <div className="w-full">
          <div className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-cyan-300">
            ZapTrend Lite v2.1
          </div>

          <h1 className="mt-6 text-5xl font-bold tracking-tight text-white md:text-6xl">
            Autonomous local trend discovery for ZapLah
          </h1>

          <p className="mt-6 max-w-3xl text-base leading-8 text-zinc-400 md:text-lg">
            Discover local social reviewer sources, health-check them automatically,
            scan only healthy sources, and rank country-specific trending items with
            momentum and decay.
          </p>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
              <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                Discovery
              </div>
              <div className="mt-3 text-xl font-semibold text-white">
                Auto source discovery
              </div>
              <div className="mt-2 text-sm leading-6 text-zinc-400">
                Curates local social reviewer sources by country and category.
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
              <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                Health
              </div>
              <div className="mt-3 text-xl font-semibold text-white">
                Healthy sources only
              </div>
              <div className="mt-2 text-sm leading-6 text-zinc-400">
                Unavailable or unhealthy accounts are flagged and excluded from scans.
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
              <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                Trends
              </div>
              <div className="mt-3 text-xl font-semibold text-white">
                Momentum-based ranking
              </div>
              <div className="mt-2 text-sm leading-6 text-zinc-400">
                New items rise fast while older items decay gradually and remain visible.
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-wrap gap-4">
            <a
              href="/admin"
              className="inline-flex items-center justify-center rounded-2xl bg-cyan-400 px-6 py-3 text-sm font-semibold text-black transition hover:-translate-y-0.5 hover:bg-cyan-300"
            >
              Open Dashboard
            </a>

            <a
              href="/admin/trends"
              className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-zinc-200 transition hover:-translate-y-0.5 hover:bg-white/10"
            >
              View Trends
            </a>

            <a
              href="/admin/sources"
              className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-zinc-200 transition hover:-translate-y-0.5 hover:bg-white/10"
            >
              View Sources
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}