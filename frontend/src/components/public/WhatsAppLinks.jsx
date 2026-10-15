import clsx from 'clsx';
import { ArrowUpRight, Users } from 'lucide-react';
import { WHATSAPP_GROUP } from '../../config/event';
import { whatsappLink } from '../../lib/format';
import { WhatsAppIcon } from './icons';

/**
 * Enlaces de WhatsApp: el grupo de la fiesta y el chat directo con el admin.
 * variant="cta": botones grandes (sección final). variant="compact": botones medianos (pie de página).
 */
export default function WhatsAppLinks({ contact = {}, variant = 'cta', className }) {
  const admin = contact.adminName || 'DJ Santech';
  const big = variant === 'cta';
  const base = clsx(
    'inline-flex items-center justify-center gap-2.5 rounded-xl border font-semibold transition',
    big ? 'h-14 px-6 text-base' : 'h-11 px-4 text-sm',
  );
  return (
    <div className={clsx('flex flex-col gap-3 sm:flex-row sm:flex-wrap', big && 'justify-center', className)}>
      <a
        href={WHATSAPP_GROUP.url}
        target="_blank"
        rel="noopener noreferrer"
        className={clsx(base, 'border-[#2f7d55]/60 bg-[#12372a] text-[#d6f5e3] shadow-[0_0_24px_-10px_rgb(79_209_139/0.6)] hover:bg-[#17452f]')}
      >
        <Users className="h-5 w-5 shrink-0 text-[#4fd18b]" strokeWidth={1.75} aria-hidden="true" />
        {WHATSAPP_GROUP.label}
        <ArrowUpRight className="h-4 w-4 opacity-70" aria-hidden="true" />
      </a>
      {contact.whatsapp && (
        <a
          href={whatsappLink(contact.whatsapp, `Hola ${admin}, tengo una pregunta sobre la Fiesta de Disfraces.`)}
          target="_blank"
          rel="noopener noreferrer"
          className={clsx(base, 'border-white/12 bg-white/[0.04] text-bone hover:border-toxic/40 hover:bg-white/[0.07]')}
        >
          <WhatsAppIcon className="h-5 w-5 shrink-0 text-toxic" />
          Escríbele a {admin}
        </a>
      )}
    </div>
  );
}
