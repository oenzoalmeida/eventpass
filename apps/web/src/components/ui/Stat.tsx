export function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <dt className="text-xs font-medium uppercase tracking-wide text-fg-muted">{label}</dt>
      <dd className="mt-1 text-2xl font-bold tabular-nums text-fg">{value}</dd>
      {hint && <dd className="mt-0.5 text-xs text-fg-muted">{hint}</dd>}
    </div>
  );
}
