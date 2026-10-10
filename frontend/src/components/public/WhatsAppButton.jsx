import clsx from 'clsx';
import { whatsappLink } from '../../lib/format';

export function WhatsAppIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.14-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.7.63.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2.01-1.41.25-.69.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35zM12.05 21.8h-.01a9.9 9.9 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.89-9.88a9.82 9.82 0 0 1 6.99 2.9 9.82 9.82 0 0 1 2.89 6.99c0 5.45-4.44 9.88-9.88 9.88zM20.5 3.49A11.8 11.8 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.89c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.88 11.88 0 0 0 5.68 1.45h.01c6.55 0 11.89-5.34 11.89-11.89 0-3.18-1.24-6.17-3.44-8.42z" />
    </svg>
  );
}

export const WA_BUY_TEXT = 'Hola DJ Santech, quiero comprar mi entrada para la Fiesta de Disfraces del 31 de octubre en Pereira. Mi nombre es: ';

/** Botón sobrio verde oscuro: abre WhatsApp con mensaje prellenado. */
export default function WhatsAppButton({ contact, name = '', gender = null, className, size = 'md', label = 'Comprar entrada por WhatsApp' }) {
  if (!contact?.whatsapp) return null;
  let text = WA_BUY_TEXT + String(name || '').trim();
  if (gender) text += `${String(name || '').trim() ? '. ' : ''}Entrada ${gender === 'mujer' ? 'de mujer' : 'de hombre'}.`;
  return (
    <a
      href={whatsappLink(contact.whatsapp, text.trim())}
      target="_blank"
      rel="noopener noreferrer"
      className={clsx(
        'inline-flex items-center justify-center gap-2.5 rounded-xl border border-[#2f7d55]/60 bg-[#12372a] font-semibold text-[#d6f5e3] shadow-[0_0_24px_-10px_rgb(47_125_85/0.8)] transition hover:bg-[#184a38] active:scale-[0.99]',
        size === 'lg' ? 'h-14 px-6 text-base' : 'h-12 px-5 text-sm',
        className,
      )}
    >
      <WhatsAppIcon className="h-5 w-5 shrink-0 text-[#4fd18b]" />
      {label}
    </a>
  );
}
