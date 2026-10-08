import { useEffect, useState } from 'react';
import { Ban, Car, HardHat, Pencil, Search, Undo2 } from 'lucide-react';
import { Badge, Button, Card, Input, Modal, PageSpinner, EmptyState, Switch, useToast } from '../../ui';
import { formatCOP, formatTime, maskCedula, maskPhone } from '../../../lib/format';
import { POS_METHOD_LABEL } from '../../../lib/labels';
import ExtrasFields from './ExtrasFields';
import { CATEGORY_TONE, categoryLabel, doorApi, helmetPrice, mapFieldErrors, normalizePlate, parkingPrice, validateExtras, vehicleText } from './doorUtils';
import { LoadError, LoadMore, ReasonModal, RefreshLine } from './shared/OpsUi';
import { useDebounced, usePagedList, useSingleFlight } from './shared/hooks';
import { errorMessage } from './shared/errors';

/** Tarjeta de una entrada de puerta con sus acciones. */
export function EntryCard({ entry, onEdit, onVoid, onReturnHelmet, returning }) {
  const e = entry;
  const helmetPending = e.helmet?.stored && !e.helmet.returned;
  return (
    <Card padding="sm" className={e.voided ? 'opacity-55' : ''}>
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 break-words text-lg font-bold leading-tight text-bone">{e.name}</p>
        <span className="shrink-0 text-sm font-semibold tabular-nums text-fog">{formatTime(e.createdAt)}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Badge tone={CATEGORY_TONE[e.category]}>{categoryLabel(e.category)}</Badge>
        <Badge>{e.source === 'ticket' ? `QR ${e.ticket?.code || ''}` : 'Venta en puerta'}</Badge>
        {e.guestListMatch && <Badge tone="green">En lista</Badge>}
        {e.voided && <Badge tone="red">Anulada</Badge>}
      </div>
      <p className="mt-2 text-sm text-fog">
        {[e.cedula && `CC ${maskCedula(e.cedula)}`, e.phone && maskPhone(e.phone), e.createdBy?.name && `Registró ${e.createdBy.name}`].filter(Boolean).join(' · ')}
      </p>
      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-t border-white/[0.07] pt-2 text-sm">
        <span className="text-fog">
          Entrada {formatCOP(e.entryAmount)}
          {e.parkingAmount > 0 && ` · Parqueo ${formatCOP(e.parkingAmount)}`}
          {e.helmetAmount > 0 && ` · Casco ${formatCOP(e.helmetAmount)}`}
        </span>
        <span className="font-bold text-bone">
          {formatCOP(e.totalAmount)} · {POS_METHOD_LABEL[e.paymentMethod] || e.paymentMethod}
        </span>
      </div>
      {(e.vehicle?.type || e.helmet?.stored) && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold text-bone">
          {e.vehicle?.type && (
            <span className="flex items-center gap-1.5">
              <Car className="h-4 w-4 text-fog" /> {vehicleText(e.vehicle)}
            </span>
          )}
          {e.helmet?.stored && (
            <span className="flex items-center gap-1.5">
              <HardHat className="h-4 w-4 text-fog" /> Ficha {e.helmet.tag || '—'} ·{' '}
              {e.helmet.returned ? <span className="text-toxic">Devuelto {formatTime(e.helmet.returnedAt)}</span> : <span className="text-gold">Guardado</span>}
            </span>
          )}
        </div>
      )}
      {e.voided && e.voidReason && <p className="mt-2 text-sm text-danger-light">Motivo: {e.voidReason}</p>}
      {!e.voided && (onEdit || onVoid || onReturnHelmet) && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {helmetPending && onReturnHelmet && (
            <Button variant="success" size="lg" className="col-span-2" loading={returning} onClick={() => onReturnHelmet(e)}>
              <Undo2 className="h-5 w-5" /> Devolver casco {e.helmet.tag ? `· ficha ${e.helmet.tag}` : ''}
            </Button>
          )}
          {onEdit && (
            <Button variant="secondary" size="lg" onClick={() => onEdit(e)}>
              <Pencil className="h-4 w-4" /> Editar
            </Button>
          )}
          {onVoid && (
            <Button variant="danger" size="lg" onClick={() => onVoid(e)}>
              <Ban className="h-4 w-4" /> Anular
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

/** Editar vehículo / casco / nota de una entrada (PATCH; el backend recalcula montos). */
export function EditEntryModal({ entry, config, onClose, onSaved }) {
  const toast = useToast();
  const [value, setValue] = useState(() => ({
    vehicleType: entry.vehicle?.type || '',
    plate: entry.vehicle?.plate || '',
    helmet: Boolean(entry.helmet?.stored),
    tag: entry.helmet?.tag || '',
    returned: Boolean(entry.helmet?.returned),
  }));
  const [notes, setNotes] = useState(entry.notes || '');
  const [errors, setErrors] = useState({});
  const [busy, run] = useSingleFlight();
  const courtesy = entry.paymentMethod === 'cortesia';
  const newTotal = courtesy ? 0 : entry.entryAmount + parkingPrice(config, value.vehicleType) + helmetPrice(config, value.helmet);
  const diff = newTotal - entry.totalAmount;

  const save = () =>
    run(async () => {
      const e = validateExtras(value);
      setErrors(e);
      if (Object.keys(e).length) return;
      try {
        const data = await doorApi.patchEntry(entry.id, {
          vehicle: value.vehicleType ? { type: value.vehicleType, plate: normalizePlate(value.plate) } : null,
          helmet: value.helmet ? { stored: true, ...(value.tag.trim() ? { tag: value.tag.trim() } : {}), returned: Boolean(value.returned) } : null,
          notes: notes.trim(),
        });
        toast.success('Entrada actualizada');
        onSaved(data.entry);
      } catch (err) {
        if (err.code === 'VALIDATION_ERROR') setErrors(mapFieldErrors(err));
        toast.error(errorMessage(err));
      }
    });

  return (
    <Modal
      open
      onClose={busy ? undefined : onClose}
      title={`Editar · ${entry.name}`}
      description="Vehículo, casco y nota. El cobro se recalcula."
      footer={
        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" size="lg" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button size="lg" onClick={save} loading={busy}>
            Guardar
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <ExtrasFields value={value} onChange={setValue} config={config} errors={errors} showReturned />
        <Input label="Nota" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={200} />
        <div className="rounded-xl bg-tomb/60 px-4 py-3 text-sm text-fog">
          Nuevo total <b className="text-bone">{formatCOP(newTotal)}</b>
          {diff > 0 && <span className="text-gold"> · cobra {formatCOP(diff)} más</span>}
          {diff < 0 && <span className="text-gold"> · devuelve {formatCOP(-diff)}</span>}
        </div>
      </div>
    </Modal>
  );
}

/** Hook con las acciones comunes (editar, anular, devolver casco) sobre una lista. */
export function useEntryActions({ onUpdated, onChanged }) {
  const toast = useToast();
  const [editing, setEditing] = useState(null);
  const [voiding, setVoiding] = useState(null);
  const [returningId, setReturningId] = useState(null);

  const returnHelmet = async (entry) => {
    if (returningId) return;
    setReturningId(entry.id);
    try {
      const data = await doorApi.returnHelmet(entry);
      onUpdated(data.entry);
      onChanged?.();
      toast.success(`Casco${entry.helmet?.tag ? ` ficha ${entry.helmet.tag}` : ''} devuelto`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setReturningId(null);
    }
  };

  const confirmVoid = async (reason) => {
    try {
      const data = await doorApi.voidEntry(voiding.id, reason);
      onUpdated(data.entry);
      onChanged?.();
      toast.success('Entrada anulada');
      setVoiding(null);
    } catch (err) {
      toast.error(errorMessage(err));
      throw err;
    }
  };

  const modals = (config) => (
    <>
      {editing && (
        <EditEntryModal
          entry={editing}
          config={config}
          onClose={() => setEditing(null)}
          onSaved={(e) => {
            onUpdated(e);
            onChanged?.();
            setEditing(null);
          }}
        />
      )}
      <ReasonModal
        open={Boolean(voiding)}
        onClose={() => setVoiding(null)}
        title="Anular entrada"
        description="Se descuenta del aforo y de la caja."
        confirmLabel="Anular entrada"
        quickReasons={['Registro duplicado', 'Error de cobro', 'Se registró por error', 'No ingresó']}
        onConfirm={confirmVoid}
      >
        {voiding && (
          <div className="rounded-xl bg-tomb/60 px-4 py-3 text-sm text-fog">
            <p className="font-semibold text-bone">
              {voiding.name} · {formatCOP(voiding.totalAmount)}
            </p>
            {voiding.source === 'ticket' && <p className="mt-1 text-gold">Entró con QR: el QR vuelve a quedar válido.</p>}
          </div>
        )}
      </ReasonModal>
    </>
  );

  return { setEditing, setVoiding, returnHelmet, returningId, modals };
}

export default function LogTab({ active, config, onChanged }) {
  const [q, setQ] = useState('');
  const dq = useDebounced(q.trim(), 350);
  const [includeVoided, setIncludeVoided] = useState(false);
  const list = usePagedList(
    (page, limit, signal) => doorApi.entries({ q: dq, includeVoided: includeVoided ? 1 : '', page, limit }, signal),
    [dq, includeVoided],
    { limit: 25 },
  );
  const actions = useEntryActions({ onUpdated: list.updateItem, onChanged });

  useEffect(() => {
    if (active) list.reload({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          className="flex-1"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Nombre, cédula, placa o código"
          leading={<Search className="h-5 w-5" />}
          inputClassName="h-13"
          enterKeyHint="search"
          aria-label="Buscar en el registro"
        />
        <Switch checked={includeVoided} onChange={setIncludeVoided} label="Incluir anuladas" className="min-h-12 sm:w-52 [&>label]:flex-1" />
      </div>
      <RefreshLine loadedAt={list.loadedAt} onRefresh={() => list.reload({ silent: true })} refreshing={list.loading} />
      {list.loading && !list.items.length ? (
        <PageSpinner label="Cargando registro…" />
      ) : list.error && !list.items.length ? (
        <LoadError error={list.error} onRetry={list.reload} />
      ) : !list.items.length ? (
        <EmptyState title={dq ? 'Sin resultados' : 'Aún no hay ingresos'} description={dq ? `Nada coincide con «${dq}».` : 'Aquí aparecen las entradas registradas.'} />
      ) : (
        <>
          <p className="text-sm text-fog">{list.total} entradas</p>
          <div className="grid gap-3 lg:grid-cols-2">
            {list.items.map((e) => (
              <EntryCard
                key={e.id}
                entry={e}
                onEdit={actions.setEditing}
                onVoid={actions.setVoiding}
                onReturnHelmet={actions.returnHelmet}
                returning={actions.returningId === e.id}
              />
            ))}
          </div>
          <LoadMore list={list} />
        </>
      )}
      {actions.modals(config)}
    </div>
  );
}
