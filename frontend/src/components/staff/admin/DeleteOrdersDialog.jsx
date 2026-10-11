import { Trash2, TriangleAlert } from 'lucide-react';
import { useToast } from '../../ui';
import { staffApi } from '../../../lib/api';
import ConfirmDialog from './ConfirmDialog';
import { plural } from './utils';

/**
 * Elimina una o varias compras (con auditoría). orders = [{ id, name, tickets }].
 * onDone({ deleted, skipped }) se llama al terminar (aunque se hayan omitido algunas).
 */
export default function DeleteOrdersDialog({ open, orders, onClose, onDone }) {
  const toast = useToast();
  const n = orders.length;
  const m = orders.reduce((s, o) => s + (o.tickets ?? 0), 0);
  const single = n === 1;

  const confirm = async (reason) => {
    try {
      if (single) {
        await staffApi(`/api/admin/orders/${orders[0].id}/delete`, { method: 'POST', body: { reason } });
        toast.success(`Compra de ${orders[0].name} eliminada.`);
        onDone?.({ deleted: 1, skipped: [] });
        return;
      }
      const res = await staffApi('/api/admin/orders/delete-many', { method: 'POST', body: { ids: orders.map((o) => o.id), reason } });
      const names = new Map(orders.map((o) => [o.id, o.name]));
      if (res.skipped?.length) {
        const omitted = res.skipped.map((s) => `${names.get(s.id) || s.id} (${s.message})`).join(' · ');
        toast.error(`${plural(res.deleted, 'compra eliminada', 'compras eliminadas')}. Omitidas: ${omitted}`);
      } else {
        toast.success(`${plural(res.deleted, 'compra eliminada', 'compras eliminadas')}.`);
      }
      onDone?.(res);
    } catch (err) {
      toast.error(err.message);
      if (single && (err.code === 'NOT_FOUND' || err.code === 'HAS_CHECKINS')) {
        onDone?.({ deleted: 0, skipped: [{ id: orders[0].id, code: err.code, message: err.message }] });
      }
      throw err;
    }
  };

  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={confirm}
      tone="danger"
      icon={Trash2}
      title={single ? '¿Eliminar esta compra?' : `¿Eliminar ${n} compras?`}
      confirmLabel={single ? 'Eliminar compra' : `Eliminar ${n} compras`}
      description={
        <>
          Se {single ? 'eliminará' : 'eliminarán'} <strong className="text-bone">{plural(n, 'compra')}</strong>
          {single ? (
            <>
              {' '}
              de <strong className="text-bone">{orders[0].name}</strong>
            </>
          ) : null}{' '}
          y <strong className="text-bone">{plural(m, 'entrada')}</strong>, con sus comprobantes. Las habitaciones apartadas se liberan y los
          descuentos de invitado se restauran.
        </>
      }
      reason={{
        label: 'Motivo (obligatorio)',
        placeholder: 'Ej.: Compra de prueba',
        minLength: 3,
        maxLength: 200,
        suggestions: ['Compra de prueba', 'Duplicada', 'Pedido del comprador'],
      }}
    >
      <div className="flex items-start gap-2.5 rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger-light" role="alert">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
        <p>No se puede deshacer. Queda un registro en Auditoría con quién la eliminó, cuándo y por qué.</p>
      </div>
      {!single && (
        <ul className="max-h-32 list-disc space-y-0.5 overflow-y-auto pl-5 text-sm text-fog">
          {orders.slice(0, 20).map((o) => (
            <li key={o.id}>{o.name}</li>
          ))}
          {n > 20 && <li>y {n - 20} más…</li>}
        </ul>
      )}
    </ConfirmDialog>
  );
}
