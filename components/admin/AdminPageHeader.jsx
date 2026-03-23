export default function AdminPageHeader({ title, subtitle, right = null }) {
  return (
    <div className="mb-10 flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
      <div>
        <div className="zt-page-kicker">ZapTrend Control Tower</div>
        <h1 className="zt-page-title">{title}</h1>
        {subtitle ? <p className="zt-page-subtitle">{subtitle}</p> : null}
      </div>

      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}