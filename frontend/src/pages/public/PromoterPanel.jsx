import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import QRCode from 'qrcode';
import { BadgeDollarSign, Download, Eye, LogOut, MousePointerClick, RefreshCw, ShoppingCart, Ticket } from 'lucide-react';
import { Button, Spinner } from '../../components/ui';
import PublicLayout, { PageAtmosphere, PageContainer } from '../../components/public/PublicLayout';
import { CopyButton, Notice, Overline } from '../../components/public/ui';
import { WhatsAppIcon } from '../../components/public/WhatsAppButton';
import { useFetch } from '../../lib/useFetch';
import { formatCOP, formatNumber } from '../../lib/format';
import { promoterApi, promoterLink, promoterToken } from '../../lib/promoter';

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const shortDay = (day) => {
  const [, m, d] = String(day).split('-');
  return `${Number(d)} ${MONTHS[Number(m) - 1] || ''}`;
};

function useQr(text) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    let alive = true;
    if (text) {
      QRCode.toDataURL(text, { errorCorrectionLevel: 'M', margin: 2, width: 640, color: { dark: '#000000', light: '#ffffff' } })
        .then((u) => alive && setSrc(u))
        .catch(() => {});
    }
    return () => {
      alive = false;
    };
  }, [text]);
  return src;
}

function StatTile({ icon: Icon, label, value, hint, accent }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-crypt/80 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-smoke">{label}</p>
        <Icon className={clsx('h-4 w-4', accent ? 'text-toxic' : 'text-pumpkin-light')} strokeWidth={1.75} />
      </div>
      <p className={clsx('mt-2 text-3xl font-bold tabular-nums leading-none', accent ? 'text-toxic' : 'text-bone')}>{value}</p>
      {hint && <p className="mt-1.5 text-xs text-fog">{hint}</p>}
    </div>
  );
}

/** Barras por día: visitas (naranja) y compras pagadas (verde). */
function DayChart({ byDay }) {
  const max = Math.max(1, ...byDay.map((d) => d.visits));
  return (
    <div>
      <div className="flex h-32 items-end gap-[3px]" role="img" aria-label={`Visitas por día, últimos ${byDay.length} días`}>
        {byDay.map((d, i) => (
          <div key={d.day} className="relative flex h-full min-w-0 flex-1 items-end" title={`${shortDay(d.day)}: ${d.visits} visitas · ${d.whatsapp} WhatsApp · ${d.paidOrders} pagadas`}>
            <div
              className={clsx('w-full rounded-t-[3px]', d.visits === 0 ? 'bg-white/10' : i === byDay.length - 1 ? 'bg-pumpkin' : 'bg-pumpkin/50')}
              style={{ height: d.visits === 0 ? '3px' : `${Math.max((d.visits / max) * 100, 5)}%` }}
            />
            {d.paidOrders > 0 && <span className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-toxic shadow-[0_0_8px_rgb(34_229_132/0.8)]" />}
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-smoke">
        <span>{shortDay(byDay[0]?.day)}</span>
        <span>Hoy</span>
      </div>
    </div>
  );
}

/** /promotores/panel: link, QR, compartir y estadísticas propias. */
export default function PromoterPanel() {
  const navigate = useNavigate();
  const hasToken = Boolean(promoterToken.get());
  const { data, error, loading, reload } = useFetch((signal) => promoterApi('/api/promoters/me', { signal }), [], { interval: 60000, enabled: hasToken });
  const [refreshing, setRefreshing] = useState(false);
  const link = data ? promoterLink(data.promoter.code) : '';
  const qr = useQr(link);

  useEffect(() => {
    document.title = 'Mi panel de promotor · Fiesta de Disfraces';
  }, []);

  if (!hasToken || error?.status === 401) return <Navigate to="/promotores" replace />;

  const logout = () => {
    promoterToken.set(null);
    navigate('/promotores', { replace: true });
  };
  const refresh = async () => {
    setRefreshing(true);
    await reload({ silent: true });
    setRefreshing(false);
  };

  if (loading && !data) {
    return (
      <PublicLayout>
        <PageContainer size="lg" className="flex justify-center pt-40">
          <Spinner />
        </PageContainer>
      </PublicLayout>
    );
  }
  if (!data) {
    return (
      <PublicLayout>
        <PageContainer size="lg">
          <Notice title="No pudimos cargar tu panel" action={<Button onClick={() => reload()}>Reintentar</Button>}>
            {error?.message}
          </Notice>
        </PageContainer>
      </PublicLayout>
    );
  }

  const { promoter, stats } = data;
  const t = stats.totals;
  const firstName = promoter.name.split(' ')[0];
  const shareText = `¡Fiesta de Disfraces el 31 de octubre en Pereira! Finca, 3 DJs y la noche más terrorífica del año. Compra tu entrada aquí: ${link}`;
  const recent = [...stats.byDay].reverse().filter((d) => d.visits || d.whatsapp || d.orders || d.paidOrders);

  return (
    <PublicLayout headerRight={null}>
      <PageAtmosphere intensity="soft" />
      <PageContainer size="lg">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <Overline>Panel de promotor</Overline>
            <h1 className="mt-3 font-display text-[length:clamp(2.4rem,11vw,4rem)] uppercase leading-[0.9] text-bone">Hola, {firstName}</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={logout} className="mt-1 shrink-0">
            <LogOut className="h-4 w-4" />
            Salir
          </Button>
        </div>

        <section aria-label="Tu link" className="mt-8 rounded-[24px] border border-pumpkin/35 bg-crypt/90 p-5 shadow-[0_0_50px_-26px_rgb(255_106_0/0.9)] sm:p-7">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-pumpkin-light">Tu link para vender</p>
          <p className="mt-3 break-all font-mono text-lg font-semibold leading-snug text-bone sm:text-2xl">{link}</p>
          <p className="mt-2 text-sm text-fog">
            Tu código: <span className="font-mono font-bold tracking-[0.2em] text-bone">{promoter.code}</span>
          </p>
          <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
            <CopyButton value={link} label="Copiar link" copiedLabel="Link copiado" className="h-12! rounded-xl! text-sm!" />
            <a
              href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 items-center justify-center gap-2.5 rounded-xl border border-[#2f7d55]/60 bg-[#12372a] text-sm font-semibold text-[#d6f5e3] transition hover:bg-[#184a38]"
            >
              <WhatsAppIcon className="h-5 w-5 text-[#4fd18b]" />
              Compartir por WhatsApp
            </a>
          </div>
          <div className="mt-6 flex flex-col items-center gap-3 border-t border-white/[0.07] pt-6 sm:flex-row sm:items-center sm:gap-6">
            <div className="flex h-44 w-44 items-center justify-center overflow-hidden rounded-2xl bg-white p-2">
              {qr ? <img src={qr} alt={`QR de tu link ${link}`} className="h-full w-full" /> : <Spinner />}
            </div>
            <div className="text-center sm:text-left">
              <p className="text-sm text-fog">Muéstralo en tu celular o imprímelo: quien lo escanee entra con tu link.</p>
              {qr && (
                <Button as="a" href={qr} download={`promotor-${promoter.code}.png`} variant="secondary" size="sm" className="mt-3">
                  <Download className="h-4 w-4" />
                  Descargar QR
                </Button>
              )}
            </div>
          </div>
        </section>

        <div className="mt-10 flex items-center justify-between gap-3">
          <h2 className="font-display text-3xl uppercase text-bone">Tus resultados</h2>
          <Button variant="secondary" size="icon" onClick={refresh} disabled={refreshing} aria-label="Actualizar">
            <RefreshCw className={clsx('h-4 w-4', refreshing && 'animate-spin')} />
          </Button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
          <StatTile icon={Eye} label="Visitas" value={formatNumber(t.visits)} hint="Personas únicas por día" />
          <StatTile icon={MousePointerClick} label="WhatsApp" value={formatNumber(t.whatsapp)} hint="Tocaron comprar por WhatsApp" />
          <StatTile icon={ShoppingCart} label="Compras creadas" value={formatNumber(t.orders)} hint="Iniciaron compra en la web" />
          <StatTile icon={Ticket} label="Pagadas" value={formatNumber(t.paidOrders)} hint={`${formatNumber(t.paidTickets)} entradas pagadas`} accent />
          <StatTile icon={BadgeDollarSign} label="Total vendido" value={formatCOP(t.sold)} hint="Solo compras pagadas" accent />
        </div>

        <section aria-label="Últimos 14 días" className="mt-4 rounded-2xl border border-white/[0.08] bg-crypt/80 p-5">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-semibold text-bone">Visitas por día · últimos {stats.days} días</p>
            <span className="flex items-center gap-1.5 text-[11px] text-smoke">
              <span className="h-2 w-2 rounded-full bg-toxic" />
              hubo venta pagada
            </span>
          </div>
          <div className="mt-4">
            <DayChart byDay={stats.byDay} />
          </div>
          {recent.length > 0 ? (
            <table className="mt-5 w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-smoke">
                  <th className="pb-2 font-medium">Día</th>
                  <th className="pb-2 text-right font-medium">Visitas</th>
                  <th className="pb-2 text-right font-medium">WhatsApp</th>
                  <th className="pb-2 text-right font-medium">Pagadas</th>
                  <th className="pb-2 text-right font-medium">Vendido</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {recent.map((d) => (
                  <tr key={d.day} className="border-t border-white/[0.06]">
                    <td className="py-2 text-fog">{shortDay(d.day)}</td>
                    <td className="py-2 text-right text-bone">{d.visits}</td>
                    <td className="py-2 text-right text-bone">{d.whatsapp}</td>
                    <td className="py-2 text-right text-bone">{d.paidOrders}</td>
                    <td className="py-2 text-right text-toxic">{d.sold ? formatCOP(d.sold) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="mt-5 text-sm text-fog">Todavía no hay movimiento. Comparte tu link y aquí verás quién entra y compra.</p>
          )}
        </section>
        <p className="mt-6 text-xs leading-relaxed text-smoke">
          Las visitas se cuentan de forma anónima (una por persona al día). Las compras por WhatsApp las confirma el admin con tu código.
        </p>
      </PageContainer>
    </PublicLayout>
  );
}
