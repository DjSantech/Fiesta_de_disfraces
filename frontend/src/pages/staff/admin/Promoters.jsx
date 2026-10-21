import { useState } from 'react';
import clsx from 'clsx';
import { Megaphone } from 'lucide-react';
import { Badge, Card, EmptyState, PageSpinner, Stat, Switch, useToast } from '../../../components/ui';
import { staffApi } from '../../../lib/api';
import { useFetch } from '../../../lib/useFetch';
import { formatCOP, formatNumber, formatRelative } from '../../../lib/format';
import PageHeader from '../../../components/staff/admin/PageHeader';
import ErrorState from '../../../components/staff/admin/ErrorState';
import { PhoneLink } from '../../../components/staff/admin/Contact';

/** Promotores: quién vende con su link, cuánto trae y activar/desactivar. */
export default function Promoters() {
  const toast = useToast();
  const list = useFetch((signal) => staffApi('/api/admin/promoters', { signal }), [], { interval: 60000 });
  const [saving, setSaving] = useState(null);

  const toggle = async (p, active) => {
    setSaving(p.id);
    try {
      const { promoter } = await staffApi(`/api/admin/promoters/${p.id}`, { method: 'PUT', body: { active } });
      list.setData((d) => ({ ...d, items: d.items.map((x) => (x.id === p.id ? promoter : x)) }));
      toast.success(active ? `${p.name} quedó activo.` : `${p.name} quedó desactivado: su link ya no suma.`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(null);
    }
  };

  const items = list.data?.items || [];
  const sum = (k) => items.reduce((s, p) => s + (p.stats?.[k] || 0), 0);

  return (
    <div>
      <PageHeader
        title="Promotores"
        description="Personas que venden con su propio link (?ref=CÓDIGO). Las compras de la web quedan con su código; en WhatsApp el mensaje trae “Código promotor”."
      />
      {!list.data ? (
        list.error ? <ErrorState error={list.error} onRetry={list.reload} /> : <PageSpinner label="Cargando promotores…" />
      ) : items.length === 0 ? (
        <EmptyState icon={Megaphone} title="Aún no hay promotores" description="Se registran solos en /promotores desde la web." />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Promotores" value={formatNumber(items.length)} hint={`${items.filter((p) => p.active).length} activos`} icon={Megaphone} />
            <Stat label="Visitas con link" value={formatNumber(sum('visits'))} hint={`${formatNumber(sum('whatsapp'))} clics a WhatsApp`} />
            <Stat label="Compras pagadas" value={formatNumber(sum('paidOrders'))} hint={`${formatNumber(sum('paidTickets'))} entradas`} tone="green" />
            <Stat label="Total vendido" value={formatCOP(sum('sold'))} tone="green" />
          </div>

          <Card padding="none" className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-white/[0.07] text-left text-xs uppercase tracking-wider text-smoke">
                  <th className="px-4 py-3 font-medium">Promotor</th>
                  <th className="px-4 py-3 font-medium">Código</th>
                  <th className="px-4 py-3 text-right font-medium">Visitas</th>
                  <th className="px-4 py-3 text-right font-medium">WhatsApp</th>
                  <th className="px-4 py-3 text-right font-medium">Compras</th>
                  <th className="px-4 py-3 text-right font-medium">Pagadas</th>
                  <th className="px-4 py-3 text-right font-medium">Vendido</th>
                  <th className="px-4 py-3 font-medium">Activo</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {items.map((p) => (
                  <tr key={p.id} className={clsx('border-b border-white/[0.05] last:border-0', !p.active && 'opacity-60')}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-bone">{p.name}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-fog">
                        <PhoneLink phone={p.phone} />
                        <span className="text-smoke">· {p.lastLoginAt ? `entró ${formatRelative(p.lastLoginAt)}` : 'sin ingresos'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono font-bold tracking-[0.15em] text-pumpkin-light">{p.code}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-bone">{formatNumber(p.stats.visits)}</td>
                    <td className="px-4 py-3 text-right text-bone">{formatNumber(p.stats.whatsapp)}</td>
                    <td className="px-4 py-3 text-right text-bone">{formatNumber(p.stats.orders)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-semibold text-toxic">{formatNumber(p.stats.paidOrders)}</span>
                      <span className="block text-xs text-smoke">{formatNumber(p.stats.paidTickets)} entradas</span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-toxic">{formatCOP(p.stats.sold)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Switch checked={p.active} disabled={saving === p.id} onChange={(v) => toggle(p, v)} id={`promotor-${p.id}`} />
                        {!p.active && <Badge tone="neutral">Inactivo</Badge>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <p className="text-xs text-smoke">
            Visitas = personas únicas por día que entraron con el link (anónimo). Desactivar: su link deja de sumar y no puede entrar a su panel.
          </p>
        </div>
      )}
    </div>
  );
}
