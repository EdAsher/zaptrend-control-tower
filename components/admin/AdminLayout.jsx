import AdminSidebar from "./AdminSidebar";

export default function AdminLayout({ children }) {
  return (
    <div className="zt-shell">
      <div className="mx-auto flex max-w-[1680px]">
        <AdminSidebar />

        <div className="min-w-0 flex-1">
          <div className="px-4 py-5 xl:px-6 xl:py-6">
            <div className="mb-5 rounded-[24px] border border-white/8 bg-white/[0.03] px-5 py-3 backdrop-blur-xl shadow-[0_10px_40px_rgba(0,0,0,0.22)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs uppercase tracking-[0.24em] text-zinc-500">
                  Live Ops
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="zt-pill zt-pill-success">API Online</span>
                  <span className="zt-pill zt-pill-info">Control Tower Active</span>
                </div>
              </div>
            </div>

            <div className="mx-auto max-w-7xl">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}