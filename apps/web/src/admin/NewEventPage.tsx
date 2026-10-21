import { api } from '../lib/api';
import { useRouter } from '../router/router';
import { EventForm } from './EventForm';
import { PageHeader } from './AdminLayout';

export function NewEventPage() {
  const { navigate } = useRouter();
  return (
    <>
      <PageHeader title="Novo evento" description="O evento começa como rascunho; publique quando estiver pronto." />
      <EventForm
        submitLabel="Criar rascunho"
        onSubmit={async (data) => {
          const event = await api.createEvent(data);
          navigate(`/admin/eventos/${event.id}`);
        }}
      />
    </>
  );
}
