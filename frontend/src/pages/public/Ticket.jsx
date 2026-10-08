import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CalendarPlus, Download, MapPin, Navigation, RefreshCw, SearchX, Share2 } from 'lucide-react';
import { Button, PageSpinner } from '../../components/ui';
import { api } from '../../lib/api';
import { useFetch } from '../../lib/useFetch';
import PublicLayout, { PageAtmosphere, PageContainer } from '../../components/public/PublicLayout';
import { TicketCard, ticketUrl } from '../../components/public/tickets';
import { StateScreen } from '../../components/public/ui';
import { describeError } from '../../components/public/utils/errors';
import { CELEBRATION } from '../../config/event';

export default function Ticket() {
  const { token } = useParams();
  const { data, error, loading, reload } = useFetch((signal) => api(`/api/public/tickets/${token}`, { signal }), [token]);
  const [busy, setBusy] = useState(null);
  useEffect(() => {
    document.title = 'Tu entrada · Fiesta de Disfraces';
  }, []);

  async function run(kind) {
    setBusy(kind);
    try {
      const art = await import('../../components/public/utils/ticketArt');
      const url = ticketUrl(token);
      if (kind === 'png') await art.downloadTicketPng(data.ticket, data.event.startsAt, url);
      if (kind === 'ics') art.downloadIcs(data.event.startsAt, url, data.location?.name);
      if (kind === 'story') await art.shareStory();
    } finally {
      setBusy(null);
    }
  }

  let content;
  if (loading && !data) content = <PageSpinner label="Cargando tu entrada…" />;
  else if (error && !data) {
    const d = describeError(error);
    content = (
      <StateScreen icon={SearchX} title={error.code === 'NOT_FOUND' ? 'Entrada no encontrada' : d.title} actions={<><Button variant="secondary" onClick={() => reload()}><RefreshCw className="h-4 w-4" />Reintentar</Button><Button as={Link} to="/recuperar">Recuperar mi entrada</Button></>}>
        {d.message}
      </StateScreen>
    );
  } else if (data) {
    const loc = data.location;
    content = (
      <div className="flex flex-col gap-5">
        {loc && (
          <section className="noise-border rounded-3xl bg-[linear-gradient(160deg,rgb(34_229_132/0.12),rgb(21_21_28/0.95)_50%)] p-5">
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-toxic">
              <MapPin className="h-4 w-4" /> Ubicación revelada
            </p>
            <h2 className="mt-3 font-display text-3xl uppercase text-bone">{loc.name}</h2>
            {loc.notes && <p className="mt-2 text-sm leading-relaxed text-fog">{loc.notes}</p>}
            {loc.mapsUrl && (
              <Button as="a" href={loc.mapsUrl} target="_blank" rel="noopener noreferrer" variant="success" size="lg" block className="mt-4">
                <Navigation className="h-4 w-4" /> Abrir en Google Maps
              </Button>
            )}
          </section>
        )}
        <TicketCard ticket={data.ticket} startsAt={data.event.startsAt} />
        <p className="text-center text-sm text-fog">{CELEBRATION.note}</p>
        <div className="grid gap-2">
          <Button size="lg" loading={busy === 'png'} onClick={() => run('png')}><Download className="h-4 w-4" />Descargar entrada</Button>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" loading={busy === 'ics'} onClick={() => run('ics')}><CalendarPlus className="h-4 w-4" />Calendario</Button>
            <Button variant="secondary" loading={busy === 'story'} onClick={() => run('story')}><Share2 className="h-4 w-4" />Tu historia</Button>
          </div>
          <p className="text-center text-xs text-fog/80">“Compartir en tu historia” crea una imagen sin tu QR: nadie puede copiar tu entrada.</p>
        </div>
      </div>
    );
  }

  return (
    <PublicLayout>
      <PageAtmosphere />
      <PageContainer size="sm">{content}</PageContainer>
    </PublicLayout>
  );
}
