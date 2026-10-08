import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { CircleAlert, CircleCheck, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

const STYLES = {
  success: { icon: CircleCheck, className: 'border-toxic/30 text-toxic' },
  error: { icon: CircleAlert, className: 'border-danger/40 text-danger-light' },
  info: { icon: Info, className: 'border-white/15 text-bone' },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const push = useCallback(
    (type, message, { duration = 3800 } = {}) => {
      const id = ++idRef.current;
      setToasts((list) => [...list.slice(-3), { id, type, message }]);
      if (duration > 0) setTimeout(() => dismiss(id), duration);
      return id;
    },
    [dismiss],
  );

  const api = useMemo(
    () => ({
      success: (msg, opts) => push('success', msg, opts),
      error: (msg, opts) => push('error', msg, { duration: 5500, ...opts }),
      info: (msg, opts) => push('info', msg, opts),
      dismiss,
    }),
    [push, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-0 z-[70] flex flex-col items-center gap-2 px-4 pt-[max(1rem,env(safe-area-inset-top))]"
      >
        {toasts.map((t) => {
          const { icon: Icon, className } = STYLES[t.type] || STYLES.info;
          return (
            <div
              key={t.id}
              role={t.type === 'error' ? 'alert' : 'status'}
              className={clsx(
                'pointer-events-auto flex w-full max-w-md animate-fade-up items-start gap-3 rounded-2xl border bg-crypt/95 px-4 py-3 shadow-xl shadow-black/50 backdrop-blur',
                className,
              )}
            >
              <Icon className="mt-0.5 h-5 w-5 shrink-0" />
              <p className="flex-1 text-sm font-medium text-bone">{t.message}</p>
              <button type="button" onClick={() => dismiss(t.id)} className="-mr-1 rounded p-1 text-fog hover:text-bone" aria-label="Cerrar aviso">
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

/** const toast = useToast(); toast.success('Guardado'); toast.error(err.message) */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>');
  return ctx;
}
