import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { X } from 'lucide-react';

const SIZES = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-4xl',
};

/**
 * Hoja inferior en celular, diálogo centrado en escritorio.
 * <Modal open onClose={fn} title="Título" description="…" footer={<Button/>} size="md">contenido</Modal>
 */
// Pila de modales abiertos: Escape cierra solo el de arriba.
const modalStack = [];

export default function Modal({ open, onClose, title, description, children, footer, size = 'md', closeOnBackdrop = true, className }) {
  const panelRef = useRef(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    const previousFocus = document.activeElement;
    const entry = {};
    modalStack.push(entry);
    const onKey = (e) => {
      if (e.key === 'Escape' && modalStack[modalStack.length - 1] === entry) onCloseRef.current?.();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      const i = modalStack.indexOf(entry);
      if (i !== -1) modalStack.splice(i, 1);
      document.body.style.overflow = prevOverflow;
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        onClick={closeOnBackdrop ? () => onCloseRef.current?.() : undefined}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={clsx(
          'relative z-10 flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-crypt shadow-2xl shadow-black/60 outline-none sm:rounded-3xl',
          SIZES[size],
          className,
        )}
      >
        {(title || onClose) && (
          <div className="flex items-start justify-between gap-4 border-b border-white/[0.07] px-5 py-4 sm:px-6">
            <div className="min-w-0">
              {title && (
                <h2 id={titleId} className="text-lg font-semibold text-bone">
                  {title}
                </h2>
              )}
              {description && <p className="mt-1 text-sm text-fog">{description}</p>}
            </div>
            {onClose && (
              <button
                type="button"
                onClick={() => onCloseRef.current?.()}
                className="-mr-2 rounded-lg p-2 text-fog transition hover:bg-white/5 hover:text-bone"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        )}
        <div className="overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        {footer && <div className="border-t border-white/[0.07] px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
