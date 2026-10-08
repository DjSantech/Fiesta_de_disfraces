import { useState } from 'react';
import clsx from 'clsx';
import { Ban, CircleCheck, DoorOpen, Receipt, RotateCcw, Save, Undo2, UserRound } from 'lucide-react';
import { Badge, Button, Input, Modal, useToast } from '../../ui';
import { fieldError, staffApi } from '../../../lib/api';
import { formatDateTime } from '../../../lib/format';
import { GENDER_LABEL, PHASE_LABEL, TICKET_KIND_LABEL, TICKET_STATUS_LABEL, TICKET_STATUS_TONE } from '../../../lib/labels';
import ConfirmDialog from './ConfirmDialog';
import CopyButton from './CopyButton';
import { DetailGrid, DetailItem, DetailSection } from './Detail';
import { InstagramLink, PhoneLink, WhatsAppButton } from './Contact';
import { ticketUrl, ticketWhatsappText } from './utils';

const VOID_SUGGESTIONS = ['Pidió devolución', 'Compra duplicada', 'Entrada mal emitida', 'Cambio de titular'];

/** "General · Mujer · Preventa" / "Habitación 3" / "Cortesía" */
export function ticketKindText(t) {
  if (t.kind === 'room') return t.roomNumber ? `Habitación ${t.roomNumber}` : 'Habitación';
  if (t.kind === 'cortesia') return ['Cortesía', GENDER_LABEL[t.gender]].filter(Boolean).join(' · ');
  return ['General', GENDER_LABEL[t.gender], t.phase && PHASE_LABEL[t.phase]].filter(Boolean).join(' · ');
}

/**
 * Gestión de una entrada: renombrar titular / cédula, anular, restaurar o deshacer ingreso,
 * copiar enlace y mandarla por WhatsApp. Móntalo solo cuando esté abierto.
 */
export default function TicketModal({ ticket: initial, onClose, onChanged, onOpenOrder }) {
  const toast = useToast();
  const [ticket, setTicket] = useState(initial);
  const [holderName, setHolderName] = useState(initial.holderName || '');
  const [holderCedula, setHolderCedula] = useState(initial.holderCedula || '');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [confirm, setConfirm] = useState(null); // 'void' | 'restore'

  const nameChanged = holderName.trim() !== (ticket.holderName || '');
  const cedulaChanged = holderCedula.trim() !== (ticket.holderCedula || '');
  const dirty = nameChanged || cedulaChanged;
  const isCompanion = ticket.kind === 'room';
  const buyer = ticket.order?.buyer;

  const apply = (updated, message) => {
    setTicket(updated);
    setHolderName(updated.holderName || '');
    setHolderCedula(updated.holderCedula || '');
    setConfirm(null);
    if (message) toast.success(message);
    onChanged?.(updated);
  };

  const saveHolder = async (e) => {
    e?.preventDefault();
    if (holderName.trim().length < 2) {
      setErrors({ holderName: 'Escribe el nombre del titular.' });
      return;
    }
    const body = {};
    if (nameChanged) body.holderName = holderName.trim();
    if (cedulaChanged) body.holderCedula = holderCedula.trim() || null;
    setSaving(true);
    setErrors({});
    try {
      const res = await staffApi(`/api/admin/tickets/${ticket.id}`, { method: 'PATCH', body });
      apply(res.ticket, 'Titular actualizado.');
    } catch (err) {
      setErrors({ holderName: fieldError(err, 'holderName'), holderCedula: fieldError(err, 'holderCedula') });
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const voidTicket = async (reason) => {
    try {
      const res = await staffApi(`/api/admin/tickets/${ticket.id}/void`, { method: 'POST', body: { reason } });
      apply(res.ticket, 'Entrada anulada: su QR ya no funciona en la puerta.');
    } catch (err) {
      toast.error(err.message);
      throw err;
    }
  };

  const restore = async () => {
    const wasUsed = ticket.status === 'used';
    try {
      const res = await staffApi(`/api/admin/tickets/${ticket.id}/restore`, { method: 'POST' });
      apply(res.ticket, wasUsed ? 'Ingreso deshecho: la entrada vuelve a estar válida.' : 'Entrada restaurada.');
    } catch (err) {
      toast.error(err.message);
      throw err;
    }
  };

  const link = ticketUrl(ticket.token);

  return (
    <>
      <Modal
        open
        onClose={onClose}
        size="lg"
        title={ticket.holderName}
        description={`${ticket.code} · ${ticketKindText(ticket)}`}
        footer={
          <div className="grid grid-cols-[auto_1fr] gap-2 sm:flex sm:justify-end">
            <CopyButton text={link} label="Copiar enlace" copiedLabel="Copiado" />
            {buyer?.phone ? (
              <WhatsAppButton phone={buyer.phone} text={ticketWhatsappText(ticket)} label="WhatsApp al comprador" />
            ) : (
              <Button variant="secondary" onClick={onClose}>
                Cerrar
              </Button>
            )}
          </div>
        }
      >
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={TICKET_STATUS_TONE[ticket.status]} dot>
                {TICKET_STATUS_LABEL[ticket.status] || ticket.status}
              </Badge>
              <Badge>{TICKET_KIND_LABEL[ticket.kind] || ticket.kind}</Badge>
              {ticket.isGuest && <Badge tone="orange">Invitado</Badge>}
            </div>
            {ticket.status === 'used' && (
              <div className="flex items-start gap-3 rounded-2xl border border-ultra/30 bg-ultra/10 p-3.5">
                <DoorOpen className="mt-0.5 h-5 w-5 shrink-0 text-violet-300" strokeWidth={1.75} />
                <p className="text-sm text-fog">
                  <span className="font-semibold text-bone">Ya ingresó</span>
                  {ticket.checkedInAt && ` · ${formatDateTime(ticket.checkedInAt)}`}
                  {ticket.checkedInBy?.name && ` · registró ${ticket.checkedInBy.name}`}
                </p>
              </div>
            )}
            {ticket.status === 'void' && (
              <div className="flex items-start gap-3 rounded-2xl border border-danger/30 bg-danger/10 p-3.5">
                <Ban className="mt-0.5 h-5 w-5 shrink-0 text-danger-light" strokeWidth={1.75} />
                <p className="text-sm text-fog">
                  <span className="font-semibold text-bone">Anulada</span>
                  {ticket.voidReason ? ` · ${ticket.voidReason}` : ''}. Su QR no funciona en la puerta.
                </p>
              </div>
            )}
          </div>

          <DetailSection title="Titular" icon={UserRound}>
            <form onSubmit={saveHolder} noValidate className="flex flex-col gap-3">
              {isCompanion && (
                <p className="text-xs text-fog">Pon el nombre real del acompañante para que portería lo pueda verificar con su documento.</p>
              )}
              <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr]">
                <Input
                  label="Nombre"
                  value={holderName}
                  onChange={(e) => {
                    setHolderName(e.target.value);
                    setErrors((x) => ({ ...x, holderName: null }));
                  }}
                  error={errors.holderName}
                  autoComplete="off"
                />
                <Input
                  label="Cédula"
                  hint={isCompanion ? 'Opcional' : undefined}
                  value={holderCedula}
                  onChange={(e) => {
                    setHolderCedula(e.target.value);
                    setErrors((x) => ({ ...x, holderCedula: null }));
                  }}
                  error={errors.holderCedula}
                  autoComplete="off"
                />
              </div>
              {dirty && (
                <div className="flex gap-2">
                  <Button type="submit" loading={saving}>
                    {!saving && <Save className="h-4 w-4" />}
                    Guardar titular
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setHolderName(ticket.holderName || '');
                      setHolderCedula(ticket.holderCedula || '');
                      setErrors({});
                    }}
                    disabled={saving}
                  >
                    Deshacer
                  </Button>
                </div>
              )}
            </form>
          </DetailSection>

          <DetailSection
            title="Compra"
            icon={Receipt}
            action={
              ticket.order?.id && onOpenOrder ? (
                <Button variant="secondary" size="sm" className="h-10" onClick={() => onOpenOrder(ticket.order.id)}>
                  Ver compra
                </Button>
              ) : null
            }
          >
            <DetailGrid>
              <DetailItem label="Comprador">{buyer?.name}</DetailItem>
              <DetailItem label="Celular">
                <PhoneLink phone={buyer?.phone} className="text-bone" />
              </DetailItem>
              <DetailItem label="Instagram">
                <InstagramLink user={buyer?.instagram} className="text-bone" />
              </DetailItem>
              <DetailItem label="Emitida">{ticket.createdAt && formatDateTime(ticket.createdAt)}</DetailItem>
              <DetailItem label="Enlace de la entrada" full>
                <span className="font-mono text-xs text-fog">{link}</span>
              </DetailItem>
            </DetailGrid>
          </DetailSection>

          <DetailSection title="Estado" icon={CircleCheck}>
            <div
              className={clsx(
                'flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between',
                ticket.status === 'valid' ? 'border-pumpkin/20 bg-pumpkin/[0.04]' : 'border-white/[0.08] bg-white/[0.02]',
              )}
            >
              <p className="text-sm text-fog">
                {ticket.status === 'valid' && 'Si la anulas, su QR deja de funcionar en la puerta. Puedes restaurarla después.'}
                {ticket.status === 'used' && '¿Se escaneó por error? Deshaz el ingreso para que vuelva a quedar válida.'}
                {ticket.status === 'void' && 'Restáurala para que su QR vuelva a funcionar.'}
              </p>
              {ticket.status === 'valid' && (
                <Button variant="danger" onClick={() => setConfirm('void')} className="shrink-0">
                  <Ban className="h-4 w-4" />
                  Anular entrada
                </Button>
              )}
              {ticket.status === 'used' && (
                <Button variant="secondary" onClick={() => setConfirm('restore')} className="shrink-0">
                  <Undo2 className="h-4 w-4" />
                  Deshacer ingreso
                </Button>
              )}
              {ticket.status === 'void' && (
                <Button variant="secondary" onClick={() => setConfirm('restore')} className="shrink-0">
                  <RotateCcw className="h-4 w-4" />
                  Restaurar entrada
                </Button>
              )}
            </div>
          </DetailSection>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirm === 'void'}
        onClose={() => setConfirm(null)}
        onConfirm={voidTicket}
        tone="danger"
        icon={Ban}
        title="¿Anular esta entrada?"
        confirmLabel="Anular entrada"
        description={
          <>
            El QR de <strong className="text-bone">{ticket.holderName}</strong> ({ticket.code}) deja de funcionar en la puerta
            {ticket.kind !== 'room' ? ' y libera su cupo en el aforo' : ''}. Puedes restaurarla después.
          </>
        }
        reason={{ label: 'Motivo', placeholder: 'Ej.: Pidió devolución', minLength: 3, maxLength: 200, suggestions: VOID_SUGGESTIONS }}
      />
      <ConfirmDialog
        open={confirm === 'restore'}
        onClose={() => setConfirm(null)}
        onConfirm={restore}
        tone={ticket.status === 'used' ? 'ember' : 'success'}
        icon={ticket.status === 'used' ? Undo2 : RotateCcw}
        title={ticket.status === 'used' ? '¿Deshacer el ingreso?' : '¿Restaurar esta entrada?'}
        confirmLabel={ticket.status === 'used' ? 'Sí, deshacer ingreso' : 'Sí, restaurar'}
        description={
          ticket.status === 'used' ? (
            <div className="flex flex-col gap-2">
              <p>Úsalo solo si el QR se escaneó por error. Esto pasa:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  La entrada de <strong className="text-bone">{ticket.holderName}</strong> vuelve a quedar <strong className="text-bone">válida</strong>{' '}
                  y podrá entrar otra vez con el mismo QR.
                </li>
                <li>
                  Se anula su registro de ingreso en portería
                  {ticket.checkedInAt ? ` (${formatDateTime(ticket.checkedInAt)}${ticket.checkedInBy?.name ? `, ${ticket.checkedInBy.name}` : ''})` : ''}, junto
                  con el parqueadero o casco que se haya cobrado ahí.
                </li>
                <li>“Adentro ahora” baja en 1.</li>
              </ul>
            </div>
          ) : (
            <>
              La entrada de <strong className="text-bone">{ticket.holderName}</strong> vuelve a quedar válida y su QR funciona otra vez en la
              puerta{ticket.kind !== 'room' ? ' (vuelve a contar en el aforo)' : ''}.
            </>
          )
        }
      />
    </>
  );
}
