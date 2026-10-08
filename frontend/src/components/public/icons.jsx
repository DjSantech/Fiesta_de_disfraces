// Iconos de marca que lucide ya no trae (mismo estilo de trazo que lucide).

export function InstagramIcon({ className = 'h-5 w-5', strokeWidth = 1.75, ...props }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true" {...props}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.4" cy="6.6" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function WhatsAppIcon({ className = 'h-5 w-5', strokeWidth = 1.75, ...props }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true" {...props}>
      <path d="M3.5 20.5l1.3-4.1A8.5 8.5 0 1 1 8 19.6z" />
      <path d="M9.1 8.6c.2-.5.5-.6.8-.6h.5c.2 0 .4.1.5.4l.7 1.6c.1.2 0 .5-.1.6l-.5.6c-.1.2-.1.4 0 .6.5.9 1.3 1.7 2.3 2.2.2.1.4.1.6 0l.6-.6c.2-.2.4-.2.6-.1l1.6.7c.3.1.4.3.4.5v.5c0 .3-.2.7-.6.9-.6.3-1.4.4-2.3.1-2.2-.7-4.2-2.6-4.9-4.8-.3-.9-.3-1.7-.2-2.6z" />
    </svg>
  );
}
