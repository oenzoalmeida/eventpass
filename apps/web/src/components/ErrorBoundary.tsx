import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from './ui';

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Última linha de defesa da interface: se um erro de renderização escapar,
 * mostra uma saída em vez de deixar a tela em branco.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error('Erro de renderização capturado pela ErrorBoundary', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div role="alert" className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
          <h1 className="text-xl font-bold">Algo deu errado</h1>
          <p className="text-sm text-fg-muted">
            Ocorreu um erro inesperado nesta página. Recarregar costuma resolver.
          </p>
          <Button onClick={() => window.location.reload()}>Recarregar página</Button>
        </div>
      );
    }
    return this.props.children;
  }
}
