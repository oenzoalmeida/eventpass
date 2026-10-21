import type { ReactNode } from 'react';
import { Link, useRouter } from '../router/router';
import { cn } from '../lib/cn';

const nav = [
  { href: '/admin', label: 'Visão geral', exact: true },
  { href: '/admin/eventos', label: 'Eventos' },
  { href: '/admin/design', label: 'Design system' },
];

export function AdminLayout({ children }: { children: ReactNode }) {
  const { path } = useRouter();
  return (
    <div className="grid gap-8 md:grid-cols-[200px_1fr]">
      <nav aria-label="Painel" className="md:sticky md:top-6 md:self-start">
        <ul className="flex gap-1 overflow-x-auto md:flex-col">
          {nav.map((item) => {
            const active = item.exact ? path === item.href : path.startsWith(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'block whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium',
                    active ? 'bg-primary/10 text-primary' : 'text-fg-muted hover:bg-surface-muted hover:text-fg',
                  )}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {description && <p className="mt-1 text-sm text-fg-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
