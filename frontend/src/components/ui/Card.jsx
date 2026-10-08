import clsx from 'clsx';

/** Contenedor base. padding: 'none' | 'sm' | 'md' | 'lg' */
export default function Card({ as: Comp = 'div', padding = 'md', className, children, ...props }) {
  return (
    <Comp
      className={clsx(
        'rounded-2xl border border-white/[0.08] bg-crypt/80',
        padding === 'sm' && 'p-4',
        padding === 'md' && 'p-5',
        padding === 'lg' && 'p-6 sm:p-8',
        className,
      )}
      {...props}
    >
      {children}
    </Comp>
  );
}

const ACCENTS = {
  red: 'text-danger-light',
  green: 'text-toxic',
  amber: 'text-gold',
  violet: 'text-violet-300',
  orange: 'text-ember',
  neutral: 'text-bone',
};

/** Indicador numérico: <Stat label="Vendidas" value="37/100" hint="63 cupos" icon={Ticket} tone="red" /> */
export function Stat({ label, value, hint, icon: Icon, tone = 'neutral', className, children }) {
  return (
    <Card padding="sm" className={clsx('flex flex-col gap-2', className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wider text-smoke">{label}</p>
        {Icon && <Icon className={clsx('h-4 w-4', ACCENTS[tone])} strokeWidth={1.75} />}
      </div>
      <p className={clsx('text-2xl font-bold tabular-nums leading-none sm:text-3xl', ACCENTS[tone])}>{value}</p>
      {hint && <p className="text-xs text-fog">{hint}</p>}
      {children}
    </Card>
  );
}
