export default function HomePage() {
  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold">ZapTrend Control Tower</h1>
        <p className="mt-3 text-zinc-400">
          AI-powered trend discovery and automation dashboard
        </p>
        <a
          href="/admin"
          className="mt-6 inline-block rounded-xl bg-cyan-500 px-5 py-3 font-medium text-black"
        >
          Open Dashboard
        </a>
      </div>
    </main>
  );
}