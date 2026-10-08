import clsx from 'clsx';

/**
 * Selector de opciones grandes (radio). Ideal para Mujer/Hombre/Invitado o métodos de pago.
 * options: [{ value, label, hint?, icon?: LucideIcon, disabled? }]
 * columns: número fijo de columnas; si no, se acomoda solo (mínimo `minWidth` px por opción).
 */
export default function Segmented({ options, value, onChange, size = 'md', columns, minWidth = 92, className, ariaLabel }) {
  const style = columns
    ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }
    : { gridTemplateColumns: `repeat(auto-fit, minmax(${minWidth}px, 1fr))` };

  return (
    <div role="radiogroup" aria-label={ariaLabel} className={clsx('grid gap-2', className)} style={style}>
      {options.map((opt) => {
        const active = opt.value === value;
        const Icon = opt.icon;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={opt.disabled}
            onClick={() => onChange?.(opt.value)}
            className={clsx(
              'flex flex-col items-center justify-center gap-1 rounded-xl border px-3 py-2 text-center font-semibold transition',
              size === 'lg' && 'min-h-18 text-base',
              size === 'md' && 'min-h-12 text-sm',
              size === 'sm' && 'min-h-9 text-xs',
              active
                ? 'border-blood bg-blood/15 text-bone shadow-[inset_0_0_0_1px_rgb(225_29_46/0.6)]'
                : 'border-white/10 bg-tomb/60 text-fog hover:border-white/25 hover:text-bone',
              'disabled:cursor-not-allowed disabled:opacity-40',
            )}
          >
            {Icon && <Icon className={size === 'lg' ? 'h-6 w-6' : 'h-5 w-5'} strokeWidth={1.75} />}
            <span>{opt.label}</span>
            {opt.hint && <span className="text-xs font-normal text-smoke">{opt.hint}</span>}
          </button>
        );
      })}
    </div>
  );
}
