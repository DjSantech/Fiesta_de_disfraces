import { useId } from 'react';
import clsx from 'clsx';

/** <Switch checked={on} onChange={setOn} label="Ventas abiertas" description="…" /> */
export default function Switch({ checked, onChange, label, description, disabled, id, className }) {
  const autoId = useId();
  const switchId = id || autoId;
  return (
    <div className={clsx('flex items-center justify-between gap-4', className)}>
      {(label || description) && (
        <label htmlFor={switchId} className="min-w-0 cursor-pointer">
          {label && <span className="block text-sm font-medium text-bone">{label}</span>}
          {description && <span className="mt-0.5 block text-xs text-fog">{description}</span>}
        </label>
      )}
      <button
        id={switchId}
        type="button"
        role="switch"
        aria-checked={Boolean(checked)}
        disabled={disabled}
        onClick={() => onChange?.(!checked)}
        className={clsx(
          'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition',
          checked ? 'border-blood bg-blood' : 'border-white/15 bg-tomb',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
      >
        <span
          className={clsx(
            'inline-block h-5 w-5 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-6' : 'translate-x-1',
          )}
        />
      </button>
    </div>
  );
}
