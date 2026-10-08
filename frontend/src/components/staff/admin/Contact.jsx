import clsx from 'clsx';
import { MessageCircle, Phone } from 'lucide-react';
import { Button } from '../../ui';
import { whatsappLink } from '../../../lib/format';
import { formatPhone, instagramUrl } from './utils';

/** Glifo de cámara (lucide ya no trae íconos de marcas). */
export function InstagramIcon({ className, strokeWidth = 1.75 }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={clsx('h-4 w-4', className)}
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  );
}

const stop = (e) => e.stopPropagation();

/** @usuario → abre su perfil en una pestaña nueva. */
export function InstagramLink({ user, className }) {
  if (!user) return null;
  const handle = String(user).replace(/^@/, '');
  return (
    <a
      href={instagramUrl(handle)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={stop}
      className={clsx('inline-flex min-w-0 items-center gap-1 text-fog underline-offset-2 transition hover:text-bone hover:underline', className)}
    >
      <InstagramIcon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">@{handle}</span>
    </a>
  );
}

/** Celular legible con enlace para llamar. */
export function PhoneLink({ phone, className }) {
  if (!phone) return null;
  return (
    <a
      href={`tel:+57${String(phone).replace(/\D/g, '').replace(/^57(?=\d{10}$)/, '')}`}
      onClick={stop}
      className={clsx('inline-flex items-center gap-1 tabular-nums text-fog transition hover:text-bone', className)}
    >
      <Phone className="h-3.5 w-3.5 shrink-0" />
      {formatPhone(phone)}
    </a>
  );
}

/** Botón que abre WhatsApp con un mensaje listo. */
export function WhatsAppButton({ phone, text, label = 'Enviar por WhatsApp', variant = 'success', size = 'md', block, className, iconOnly }) {
  if (!phone) return null;
  const href = whatsappLink(phone, text);
  if (iconOnly) {
    return (
      <Button
        as="a"
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={stop}
        variant={variant}
        size="icon"
        className={className || 'h-11 w-11'}
        aria-label={label}
        title={label}
      >
        <MessageCircle className="h-4 w-4" />
      </Button>
    );
  }
  return (
    <Button as="a" href={href} target="_blank" rel="noopener noreferrer" onClick={stop} variant={variant} size={size} block={block} className={className}>
      <MessageCircle className="h-4 w-4" />
      {label}
    </Button>
  );
}
