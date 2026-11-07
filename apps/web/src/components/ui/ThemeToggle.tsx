import { useTheme } from '../../theme/useTheme';
import type { ThemePreference } from '../../theme/ThemeProvider';
import { cn } from '../../lib/cn';

const options: Array<{ value: ThemePreference; label: string }> = [
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Escuro' },
  { value: 'system', label: 'Sistema' },
];

/** Seletor de tema acessível (grupo de botões com aria-pressed). */
export function ThemeToggle() {
  const { preference, setPreference } = useTheme();
  return (
    <div role="group" aria-label="Tema" className="inline-flex rounded-lg border border-border-strong bg-surface p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={preference === o.value}
          onClick={() => setPreference(o.value)}
          className={cn(
            'inline-flex items-center rounded-md min-h-11 px-3 text-xs font-medium transition-colors active:scale-[0.97] motion-reduce:transform-none',
            preference === o.value ? 'bg-primary text-primary-fg' : 'text-fg-muted hover:text-fg',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
