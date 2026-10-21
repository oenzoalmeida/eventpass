import { Badge, Button, ThemeToggle } from './components/ui';
import { useAuth } from './auth/useAuth';
import { DesignSystemPage } from './pages/DesignSystemPage';
import { LoginPage } from './pages/LoginPage';

export function App() {
  const { status, admin, logout } = useAuth();

  return (
    <div className="min-h-dvh">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2"
      >
        Pular para o conteúdo
      </a>
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <span className="text-lg font-bold tracking-tight">
            Event<span className="text-primary">Pass</span>
          </span>
          <div className="flex items-center gap-3">
            {admin && (
              <>
                <Badge>{admin.name}</Badge>
                <Button variant="ghost" size="sm" onClick={() => void logout()}>
                  Sair
                </Button>
              </>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main id="conteudo" className="mx-auto max-w-6xl px-4 py-8">
        {status === 'loading' && (
          <p role="status" className="text-fg-muted">
            Carregando…
          </p>
        )}
        {status === 'anonymous' && <LoginPage />}
        {status === 'authenticated' && (
          <>
            <h1 className="mb-6 text-2xl font-bold">Design system</h1>
            <DesignSystemPage />
          </>
        )}
      </main>
    </div>
  );
}
