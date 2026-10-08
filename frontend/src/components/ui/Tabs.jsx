import clsx from 'clsx';

/**
 * Pestañas tipo píldora. tabs: [{ value, label, icon?: LucideIcon, badge?: number|string }]
 * <Tabs tabs={tabs} value={tab} onChange={setTab} />
 */
export default function Tabs({ tabs, value, onChange, className, ariaLabel }) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={clsx(
        'flex gap-1 overflow-x-auto rounded-2xl border border-white/[0.08] bg-crypt/80 p-1 [scrollbar-width:none]',
        className,
      )}
    >
      {tabs.map((t) => {
        const active = t.value === value;
        const Icon = t.icon;
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange?.(t.value)}
            className={clsx(
              'flex h-11 min-w-fit flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3 text-sm font-semibold transition',
              active ? 'bg-pumpkin text-white shadow-[0_0_20px_-8px_rgb(255_106_0/0.9)]' : 'text-fog hover:bg-white/5 hover:text-bone',
            )}
          >
            {Icon && <Icon className="h-4 w-4" strokeWidth={1.75} />}
            {t.label}
            {t.badge !== undefined && t.badge !== null && t.badge !== 0 && (
              <span
                className={clsx(
                  'min-w-5 rounded-full px-1.5 text-xs leading-5',
                  active ? 'bg-white/25 text-white' : 'bg-pumpkin/20 text-pumpkin-light',
                )}
              >
                {t.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
