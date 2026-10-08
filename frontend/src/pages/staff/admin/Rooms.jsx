import { useState } from 'react';
import clsx from 'clsx';
import { BedDouble, Hourglass, Lock, Pencil, Receipt, ShowerHead, UserRound } from 'lucide-react';
import { Badge, Button, Card, EmptyState, Input, Modal, PageSpinner, Switch, useToast } from '../../../components/ui';
import { fieldError, staffApi } from '../../../lib/api';
import { useFetch } from '../../../lib/useFetch';
import { formatCOP, formatTime } from '../../../lib/format';
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE, ROOM_STATUS_LABEL } from '../../../lib/labels';
import PageHeader from '../../../components/staff/admin/PageHeader';
import ErrorState from '../../../components/staff/admin/ErrorState';
import OrderDetailModal from '../../../components/staff/admin/OrderDetailModal';
import { IntegerInput, MoneyInput } from '../../../components/staff/admin/NumberInput';
import { PhoneLink, WhatsAppButton } from '../../../components/staff/admin/Contact';
import { useNow } from '../../../components/staff/admin/hooks';
import { ROOM_STATUS_TONE, formatDuration, plural } from '../../../components/staff/admin/utils';

const STATUS_ACCENT = {
  available: 'border-toxic/20',
  held: 'border-gold/30',
  booked: 'border-ultra/30',
  blocked: 'border-white/[0.08]',
};

function RoomCard({ room, now, onEdit, onOpenOrder }) {
  const o = room.order;
  const holdLeft = o?.holdExpiresAt ? new Date(o.holdExpiresAt).getTime() - now : null;
  const capacity = Math.max(0, Math.min(20, room.capacity || 0));

  return (
    <Card className={clsx('flex flex-col gap-5 sm:p-6', STATUS_ACCENT[room.status])}>
      <div className="flex items-start gap-4">
        <span
          className={clsx(
            'flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl font-display text-3xl',
            room.status === 'booked' ? 'bg-ultra/20 text-violet-200' : room.status === 'held' ? 'bg-gold/12 text-gold' : 'bg-white/[0.05] text-bone',
          )}
          aria-hidden="true"
        >
          {room.number}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="truncate text-lg font-semibold text-bone">{room.name}</h2>
            <Badge tone={ROOM_STATUS_TONE[room.status]} dot>
              {ROOM_STATUS_LABEL[room.status] || room.status}
            </Badge>
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-fog">
            <span>{plural(room.capacity, 'persona')}</span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1">
              <ShowerHead className="h-3.5 w-3.5" />
              {room.privateBathroom ? 'Baño privado' : 'Baño compartido'}
            </span>
          </p>
        </div>
      </div>

      <div className="flex items-end justify-between gap-3">
        <p className="text-3xl font-bold tabular-nums leading-none text-bone">{formatCOP(room.price)}</p>
        <div className="flex flex-wrap justify-end gap-0.5" aria-label={`Capacidad: ${room.capacity} personas`}>
          {Array.from({ length: capacity }, (_, i) => (
            <UserRound
              key={i}
              className={clsx('h-4 w-4', room.status === 'booked' ? 'text-violet-300' : 'text-smoke')}
              strokeWidth={2}
              aria-hidden="true"
            />
          ))}
        </div>
      </div>

      <div className="flex-1 border-t border-white/[0.07] pt-4">
        {room.blocked && !o ? (
          <p className="flex items-start gap-2 text-sm text-fog">
            <Lock className="mt-0.5 h-4 w-4 shrink-0" />
            Bloqueada: no aparece disponible para comprar en la web.
          </p>
        ) : o ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-smoke">{room.status === 'held' ? 'Apartada por' : 'Reservada por'}</p>
                <p className="truncate font-semibold text-bone">{o.buyerName}</p>
                <PhoneLink phone={o.buyerPhone} className="mt-0.5 text-sm" />
              </div>
              <Badge tone={ORDER_STATUS_TONE[o.status]}>{ORDER_STATUS_LABEL[o.status] || o.status}</Badge>
            </div>
            {room.status === 'held' && o.holdExpiresAt && (
              <p className="flex items-center gap-2 rounded-xl border border-gold/20 bg-gold/[0.06] px-3 py-2 text-xs text-gold">
                <Hourglass className="h-3.5 w-3.5 shrink-0" />
                {o.status === 'in_review'
                  ? 'Subió comprobante: queda apartada hasta que lo revises.'
                  : holdLeft > 0
                    ? `Apartada hasta las ${formatTime(o.holdExpiresAt)} (quedan ${formatDuration(holdLeft)})`
                    : `El apartado venció a las ${formatTime(o.holdExpiresAt)}`}
              </p>
            )}
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <Button variant="secondary" onClick={() => onOpenOrder(o.id)}>
                <Receipt className="h-4 w-4" />
                Ver compra
              </Button>
              <WhatsAppButton iconOnly variant="secondary" phone={o.buyerPhone} label={`Escribirle a ${o.buyerName}`} />
            </div>
          </div>
        ) : (
          <p className="text-sm text-fog">{room.status === 'available' ? 'Libre para la venta.' : 'Sin compra asociada.'}</p>
        )}
      </div>

      <Button variant="ghost" onClick={() => onEdit(room)} className="-mx-2 -mb-2 justify-start sm:-mb-3">
        <Pencil className="h-4 w-4" />
        Editar habitación
      </Button>
    </Card>
  );
}

function RoomEditModal({ room, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({
    name: room.name || '',
    capacity: room.capacity ?? null,
    price: room.price ?? null,
    privateBathroom: Boolean(room.privateBathroom),
    blocked: Boolean(room.blocked),
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const set = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: null }));
  };

  const hasOrder = Boolean(room.order);

  const submit = async (e) => {
    e.preventDefault();
    const next = {};
    if (form.name.trim().length < 2) next.name = 'Escribe un nombre.';
    if (!form.capacity || form.capacity < 1 || form.capacity > 20) next.capacity = 'Entre 1 y 20 personas.';
    if (form.price === null) next.price = 'Escribe el precio.';
    if (Object.keys(next).length) {
      setErrors(next);
      return;
    }
    const body = {};
    if (form.name.trim() !== room.name) body.name = form.name.trim();
    if (form.capacity !== room.capacity) body.capacity = form.capacity;
    if (form.price !== room.price) body.price = form.price;
    if (form.privateBathroom !== Boolean(room.privateBathroom)) body.privateBathroom = form.privateBathroom;
    if (form.blocked !== Boolean(room.blocked)) body.blocked = form.blocked;
    if (!Object.keys(body).length) {
      onClose();
      return;
    }
    setSaving(true);
    try {
      const res = await staffApi(`/api/admin/rooms/${room.number}`, { method: 'PUT', body });
      toast.success('Habitación actualizada.');
      onSaved(res.room);
    } catch (err) {
      setErrors({
        name: fieldError(err, 'name'),
        capacity: fieldError(err, 'capacity'),
        price: fieldError(err, 'price'),
      });
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Editar ${room.name}`}
      description="Los cambios aplican a las compras nuevas."
      footer={
        <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" form="room-form" loading={saving}>
            Guardar
          </Button>
        </div>
      }
    >
      <form id="room-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Input label="Nombre" value={form.name} onChange={(e) => set('name', e.target.value)} error={errors.name} autoComplete="off" />
        <div className="grid grid-cols-2 gap-3">
          <IntegerInput
            label="Capacidad"
            suffix="pers."
            max={20}
            maxDigits={2}
            value={form.capacity}
            onChange={(n) => set('capacity', n)}
            error={errors.capacity}
            hint="De 1 a 20"
          />
          <MoneyInput label="Precio" value={form.price} onChange={(n) => set('price', n)} error={errors.price} />
        </div>
        <div className="flex flex-col gap-4 rounded-2xl border border-white/[0.08] bg-tomb/40 p-4">
          <Switch
            label="Baño privado"
            description="Se muestra en la web como ventaja de la habitación."
            checked={form.privateBathroom}
            onChange={(v) => set('privateBathroom', v)}
          />
          <div className="h-px bg-white/[0.06]" />
          <Switch
            label="Bloquear habitación"
            description="No se podrá comprar en la web mientras esté bloqueada."
            checked={form.blocked}
            onChange={(v) => set('blocked', v)}
          />
        </div>
        {hasOrder && (
          <p className="rounded-xl border border-gold/20 bg-gold/[0.06] px-3.5 py-3 text-xs leading-relaxed text-gold">
            Tiene una compra activa de {room.order.buyerName}. Cambiar el precio o la capacidad no modifica esa compra
            {form.blocked && !room.blocked ? ', y bloquearla no la cancela' : ''}.
          </p>
        )}
      </form>
    </Modal>
  );
}

export default function Rooms() {
  const { data, error, loading, reload, setData } = useFetch((signal) => staffApi('/api/admin/rooms', { signal }), [], {
    interval: 30000,
  });
  const [editing, setEditing] = useState(null);
  const [orderId, setOrderId] = useState(null);
  const now = useNow(30000);

  const rooms = data?.items || [];
  const booked = rooms.filter((r) => r.status === 'booked');
  const held = rooms.filter((r) => r.status === 'held').length;
  const available = rooms.filter((r) => r.status === 'available').length;
  const people = booked.reduce((sum, r) => sum + (r.capacity || 0), 0);
  const peopleCapacity = rooms.reduce((sum, r) => sum + (r.capacity || 0), 0);

  return (
    <div>
      <PageHeader
        title="Habitaciones"
        description="Se alquilan completas e incluyen la entrada de todo el grupo. Sus personas van aparte del aforo general."
      />

      {loading && !data ? (
        <PageSpinner label="Cargando habitaciones…" />
      ) : !data ? (
        <ErrorState error={error} onRetry={reload} />
      ) : rooms.length === 0 ? (
        <EmptyState icon={BedDouble} title="No hay habitaciones configuradas" />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="rounded-full border border-ultra/30 bg-ultra/10 px-3 py-1.5 text-violet-200">
              <strong className="tabular-nums">{booked.length}</strong> de {rooms.length} reservadas
            </span>
            {held > 0 && (
              <span className="rounded-full border border-gold/30 bg-gold/10 px-3 py-1.5 text-gold">
                <strong className="tabular-nums">{held}</strong> {held === 1 ? 'apartada' : 'apartadas'}
              </span>
            )}
            <span className="rounded-full border border-toxic/25 bg-toxic/[0.07] px-3 py-1.5 text-toxic">
              <strong className="tabular-nums">{available}</strong> {available === 1 ? 'disponible' : 'disponibles'}
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-fog">
              <strong className="tabular-nums text-bone">{people}</strong> / {peopleCapacity} personas
            </span>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {rooms.map((room) => (
              <RoomCard key={room.number} room={room} now={now} onEdit={setEditing} onOpenOrder={setOrderId} />
            ))}
          </div>
        </div>
      )}

      {editing && (
        <RoomEditModal
          room={editing}
          onClose={() => setEditing(null)}
          onSaved={(room) => {
            setData((d) => (d ? { ...d, items: d.items.map((r) => (r.number === room.number ? room : r)) } : d));
            setEditing(null);
            reload({ silent: true });
          }}
        />
      )}
      {orderId && <OrderDetailModal orderId={orderId} onClose={() => setOrderId(null)} onChanged={() => reload({ silent: true })} />}
    </div>
  );
}
