import clsx from 'clsx';

const TONES = {
  neutral: 'border-white/10 bg-white/[0.06] text-fog',
  red: 'border-blood/30 bg-blood/15 text-blood-light',
  green: 'border-toxic/30 bg-toxic/10 text-toxic',
  amber: 'border-gold/30 bg-gold/10 text-gold',
  violet: 'border-ultra/35 bg-ultra/15 text-violet-300',
  orange: 'border-ember/30 bg-ember/15 text-ember',
};

/** <Badge tone="green|red|amber|violet|orange|neutral" dot>Pagada</Badge> */
export default function Badge({ tone = 'neutral', dot = false, className, children }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        TONES[tone] || TONES.neutral,
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />}
      {children}
    </span>
  );
}
