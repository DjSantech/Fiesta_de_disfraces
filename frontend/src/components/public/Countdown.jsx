import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { countdownParts } from './utils/dates';

const pad = (n) => String(n).padStart(2, '0');

/** Cuenta regresiva a `target` (ISO). Se actualiza cada segundo. */
export default function Countdown({ target, className }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const { diff, days, hours, minutes, seconds } = countdownParts(target, now);

  if (diff <= 0) {
    const live = diff > -10 * 3600 * 1000;
    return (
      <div className={clsx('rounded-2xl border border-pumpkin/40 bg-pumpkin/10 px-5 py-4 text-center', className)}>
        <p className="font-display text-2xl uppercase tracking-[0.06em] text-bone sm:text-3xl">
          {live ? 'La noche ya empezó' : 'Gracias por venir'}
        </p>
        <p className="mt-1 text-sm text-fog">{live ? 'Nos vemos en la finca.' : 'Fue la noche más terrorífica del año.'}</p>
      </div>
    );
  }

  const units = [
    { value: days, label: days === 1 ? 'Día' : 'Días' },
    { value: hours, label: 'Horas' },
    { value: minutes, label: 'Min' },
    { value: seconds, label: 'Seg' },
  ];

  return (
    <div
      role="timer"
      aria-label={`Faltan ${days} días, ${hours} horas y ${minutes} minutos`}
      className={clsx('grid grid-cols-4 gap-2 sm:gap-3', className)}
    >
      {units.map((u, i) => (
        <div
          key={u.label}
          className="relative overflow-hidden rounded-2xl border border-white/[0.09] bg-white/[0.035] px-1 pb-2.5 pt-3 text-center backdrop-blur-sm"
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-pumpkin/60 to-transparent" aria-hidden="true" />
          <span
            className={clsx(
              'block font-display text-[2.05rem] leading-none tabular-nums text-bone sm:text-5xl',
              i === 3 && 'text-pumpkin-light',
            )}
            aria-hidden="true"
          >
            {pad(u.value)}
          </span>
          <span className="mt-1.5 block text-[10px] font-semibold uppercase tracking-[0.24em] text-fog" aria-hidden="true">
            {u.label}
          </span>
        </div>
      ))}
    </div>
  );
}
