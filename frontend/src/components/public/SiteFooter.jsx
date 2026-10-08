import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { ArrowUpRight, KeyRound, TicketCheck } from 'lucide-react';
import { EVENT } from '../../config/event';
import { whatsappLink } from '../../lib/format';
import { InstagramIcon, WhatsAppIcon } from './icons';
import { usePublicConfig } from './usePublicConfig';

function prettyWhatsapp(n) {
  const d = String(n || '').replace(/\D/g, '');
  const local = d.length === 12 && d.startsWith('57') ? d.slice(2) : d;
  if (local.length !== 10) return n;
  return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
}

export default function SiteFooter({ compact = false }) {
  const { config } = usePublicConfig();
  const contact = config.contact || {};
  const admin = contact.adminName || 'DJ Santech';
  const ig = String(contact.instagram || '').replace(/^@+/, '').trim();

  return (
    <footer className={clsx('relative overflow-hidden border-t border-white/[0.07] bg-night', compact ? 'pt-10' : 'pt-16 sm:pt-24')}>
      {!compact && (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(60%_100%_at_50%_0%,rgb(225_29_46/0.14),transparent_70%)]" aria-hidden="true" />
      )}
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {!compact && (
          <div aria-hidden="true" className="select-none">
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-blood-light">{EVENT.presenter}</p>
            <p className="mt-3 font-display text-[length:clamp(3.4rem,17vw,12rem)] uppercase leading-[0.84] text-bone">
              Fiesta de
              <br />
              <span className="fd-text-stroke [-webkit-text-stroke:1.5px_rgb(242_237_228/0.35)]">Disfraces</span>
            </p>
            <p className="mt-4 font-serif text-2xl italic text-fog">Nos vemos el 31.</p>
          </div>
        )}

        <div className={clsx('grid gap-8 sm:grid-cols-2 lg:grid-cols-4', !compact && 'mt-14 border-t border-white/[0.07] pt-10')}>
          <div className="lg:col-span-2">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.3em] text-fog">Contacto</h2>
            <p className="mt-3 text-sm leading-relaxed text-fog">
              ¿Dudas con tu compra, tu grupo o tu habitación? Escríbele a <span className="text-bone">{admin}</span>.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href={whatsappLink(contact.whatsapp, `Hola ${admin}, tengo una pregunta sobre la Fiesta de Disfraces.`)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/12 bg-white/[0.04] px-4 text-sm font-semibold text-bone transition hover:border-toxic/40 hover:bg-toxic/[0.06]"
              >
                <WhatsAppIcon className="h-5 w-5 text-toxic" />
                WhatsApp · {prettyWhatsapp(contact.whatsapp)}
              </a>
              {ig && (
                <a
                  href={`https://instagram.com/${encodeURIComponent(ig)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/12 bg-white/[0.04] px-4 text-sm font-semibold text-bone transition hover:border-white/25 hover:bg-white/[0.08]"
                >
                  <InstagramIcon className="h-5 w-5 text-blood-light" />@{ig}
                </a>
              )}
            </div>
          </div>

          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.3em] text-fog">Tu entrada</h2>
            <ul className="mt-3 flex flex-col gap-1 text-sm">
              <li>
                <Link to="/comprar" className="inline-flex items-center gap-2 py-1.5 text-bone transition hover:text-blood-light">
                  <TicketCheck className="h-4 w-4 text-blood-light" strokeWidth={1.75} />
                  Comprar entrada
                </Link>
              </li>
              <li>
                <Link to="/recuperar" className="inline-flex items-center gap-2 py-1.5 text-bone transition hover:text-blood-light">
                  <KeyRound className="h-4 w-4 text-blood-light" strokeWidth={1.75} />
                  Recuperar mi entrada
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.3em] text-fog">La noche</h2>
            <p className="mt-3 text-sm leading-relaxed text-fog">
              {EVENT.dateLabel} · {EVENT.venue}
              <br />
              Solo mayores de edad · Nos reservamos el derecho de admisión.
            </p>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-white/[0.07] py-6 text-xs text-fog/80 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {EVENT.year} {EVENT.name} · {EVENT.city}. Hecho para la noche más terrorífica del año.
          </p>
          <Link to="/staff/login" className="inline-flex items-center gap-1 self-start text-smoke transition hover:text-fog sm:self-auto">
            Staff
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </footer>
  );
}
