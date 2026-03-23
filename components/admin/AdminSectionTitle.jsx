export default function AdminSectionTitle({
  eyebrow,
  title,
  subtitle = ""
}) {
  return (
    <div>
      {eyebrow && (
        <div className="text-xs uppercase tracking-[0.22em] text-zinc-500">
          {eyebrow}
        </div>
      )}

      <div className="mt-2 text-2xl font-semibold text-white">
        {title}
      </div>

      {subtitle && (
        <div className="mt-2 text-sm text-zinc-400">
          {subtitle}
        </div>
      )}
    </div>
  );
}