const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' });
const dateLong = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const time = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });

export const formatDateTime = (iso: string) => dateTime.format(new Date(iso));
export const formatDateLong = (iso: string) => dateLong.format(new Date(iso));
export const formatTime = (iso: string) => time.format(new Date(iso));

/** Intervalo amigável: "terça-feira, 12 de novembro de 2026 · 10:00 – 12:00". */
export function formatRange(startIso: string, endIso: string): string {
  const sameDay = new Date(startIso).toDateString() === new Date(endIso).toDateString();
  return sameDay
    ? `${formatDateLong(startIso)} · ${formatTime(startIso)} – ${formatTime(endIso)}`
    : `${formatDateTime(startIso)} – ${formatDateTime(endIso)}`;
}

/** ISO (UTC) → valor de <input type="datetime-local"> no fuso do navegador. */
export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Valor de <input type="datetime-local"> → ISO com fuso, ou string vazia. */
export function fromLocalInput(value: string): string {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

export const formatNumber = (n: number) => n.toLocaleString('pt-BR');
export const formatPercent = (n: number) => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
