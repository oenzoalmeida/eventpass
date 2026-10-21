import { Badge, Button, Loading, ThemeToggle } from './components/ui';
import { useAuth } from './auth/useAuth';
import { Link, matchPath, useRouter } from './router/router';
import { AdminLayout } from './admin/AdminLayout';
import { DashboardPage } from './admin/DashboardPage';
import { EventsListPage } from './admin/EventsListPage';
import { NewEventPage } from './admin/NewEventPage';
import { EventDetailPage } from './admin/EventDetailPage';
import { DesignSystemPage } from './pages/DesignSystemPage';
import { LoginPage } from './pages/LoginPage';
import { HomePage } from './public/HomePage';
import { EventPage } from './public/EventPage';
import { TicketPage } from './public/TicketPage';

function NotFound() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-xl font-bold">Página não encontrada</h1>
      <p className="mt-2 text-fg-muted">
        <Link href="/" className="text-primary underline">Voltar ao início</Link>
      </p>
    </div>
  );
}

function AdminRoutes({ path }: { path: string }) {
  const { status } = useAuth();
  if (status === 'loading') return <Loading />;
  if (status === 'anonymous') return <LoginPage />;

  let page = <NotFound />;
  let m: Record<string, string> | null;
  if (path === '/admin' || path === '/admin/') page = <DashboardPage />;
  else if (path === '/admin/eventos') page = <EventsListPage />;
  else if (path === '/admin/eventos/novo') page = <NewEventPage />;
  else if (path === '/admin/design')
    page = (
      <>
        <h1 className="mb-6 text-2xl font-bold">Design system</h1>
        <DesignSystemPage />
      </>
    );
  else if ((m = matchPath('/admin/eventos/:id', path)) && /^\d+$/.test(m.id!)) page = <EventDetailPage key={m.id} id={Number(m.id)} />;

  return <AdminLayout>{page}</AdminLayout>;
}

function Routes() {
  const { path } = useRouter();
  if (path === '/') return <HomePage />;
  if (path.startsWith('/admin')) return <AdminRoutes path={path} />;
  let m = matchPath('/e/:slug', path);
  if (m) return <EventPage key={m.slug} slug={m.slug!} />;
  m = matchPath('/ingresso/:token', path);
  if (m) return <TicketPage key={m.token} token={m.token!} />;
  return <NotFound />;
}

export function App() {
  const { admin, logout } = useAuth();
  const { path, navigate } = useRouter();
  const inAdmin = path.startsWith('/admin');

  return (
    <div className="min-h-dvh">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2"
      >
        Pular para o conteúdo
      </a>
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link href={admin && inAdmin ? '/admin' : '/'} className="text-lg font-bold tracking-tight">
            Event<span className="text-primary">Pass</span>
          </Link>
          <div className="flex items-center gap-3">
            {admin ? (
              <>
                {!inAdmin && (
                  <Link href="/admin" className="text-sm font-medium text-fg-muted hover:text-fg">
                    Painel
                  </Link>
                )}
                <Badge>{admin.name}</Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    void logout().then(() => navigate('/admin'));
                  }}
                >
                  Sair
                </Button>
              </>
            ) : (
              !inAdmin && (
                <Link href="/admin" className="text-sm font-medium text-fg-muted hover:text-fg">
                  Área do organizador
                </Link>
              )
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main id="conteudo" className="mx-auto max-w-6xl px-4 py-8">
        <Routes />
      </main>
    </div>
  );
}
