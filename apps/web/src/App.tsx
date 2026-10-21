import { ThemeToggle } from './components/ui';
import { DesignSystemPage } from './pages/DesignSystemPage';

export function App() {
  return (
    <div className="min-h-dvh">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2"
      >
        Pular para o conteúdo
      </a>
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <span className="text-lg font-bold tracking-tight">
            Event<span className="text-primary">Pass</span>
          </span>
          <ThemeToggle />
        </div>
      </header>
      <main id="conteudo" className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold">Design system</h1>
        <DesignSystemPage />
      </main>
    </div>
  );
}
