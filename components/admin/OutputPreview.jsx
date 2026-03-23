export default function OutputPreview({ preview = null }) {
  const items = preview?.items || [];

  return (
    <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-5 backdrop-blur">
      <div className="mb-2 text-base font-semibold text-white">Latest Output Preview</div>
      {preview ? (
        <div className="mb-4 text-xs text-zinc-500">
          {preview.country} · {preview.category_id} · {preview.run_id}
        </div>
      ) : null}

      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="text-sm text-zinc-400">No output preview available.</div>
        ) : items.map((item, idx) => (
          <div key={`${item.title}-${idx}`} className="rounded-2xl border border-white/5 bg-black/20 p-4">
            <div className="text-sm font-medium text-white">{item.title}</div>
            <div className="mt-1 text-xs leading-6 text-zinc-400">{item.caption}</div>
          </div>
        ))}
      </div>
    </div>
  );
}