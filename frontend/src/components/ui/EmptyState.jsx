import clsx from 'clsx';
import { Inbox } from 'lucide-react';

/** <EmptyState icon={Users} title="Sin invitados" description="…" action={<Button/>} /> */
export default function EmptyState({ icon: Icon = Inbox, title, description, action, className }) {
  return (
    <div className={clsx('flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/10 px-6 py-12 text-center', className)}>
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.04] text-smoke">
        <Icon className="h-6 w-6" strokeWidth={1.5} />
      </span>
      {title && <p className="font-semibold text-bone">{title}</p>}
      {description && <p className="max-w-sm text-sm text-fog">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
