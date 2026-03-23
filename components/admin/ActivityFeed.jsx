import AdminStatusPill from "./AdminStatusPill";

function safeText(value, fallback = "-") {
  if (value === undefined || value === null || value === "") return fallback;
  return String(value);
}

function inferStatus(item) {
  const raw =
    item?.status ||
    item?.meta?.status ||
    item?.type ||
    "completed";

  const text = String(raw).toUpperCase();

  if (text.includes("FAIL") || text.includes("ERROR")) return "FAILED";
  if (text.includes("RUN")) return "RUNNING";
  if (text.includes("HOT")) return "HOT";
  return "COMPLETED";
}

export default function ActivityFeed({ items = [] }) {
  if (!items.length) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-zinc-500">
        No recent activity.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item, index) => {
        const title =
          item?.title ||
          item?.message ||
          item?.type ||
          `Activity ${index + 1}`;

        const meta = item?.meta || {};
        const status = inferStatus(item);

        return (
          <div
            key={item?.id || `${title}-${index}`}
            className="rounded-2xl border border-white/10 bg-black/20 p-4 transition duration-200 hover:-translate-y-0.5 hover:border-white/15 hover:bg-white/[0.04]"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm font-medium text-white">
                  {safeText(title)}
                </div>

                <div className="mt-2 text-xs leading-6 text-zinc-400">
                  {meta.run_id ? <div>Run ID: {safeText(meta.run_id)}</div> : null}
                  {meta.sources_scanned !== undefined ? (
                    <div>Sources scanned: {safeText(meta.sources_scanned, "0")}</div>
                  ) : null}
                  {meta.mentions_detected !== undefined ? (
                    <div>Mentions detected: {safeText(meta.mentions_detected, "0")}</div>
                  ) : null}
                  {meta.candidates_created !== undefined ? (
                    <div>Candidates created: {safeText(meta.candidates_created, "0")}</div>
                  ) : null}
                </div>
              </div>

              <div className="shrink-0">
                <AdminStatusPill value={status} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}