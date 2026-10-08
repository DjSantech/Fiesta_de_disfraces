import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { Button, Modal, Textarea } from '../../ui';
import { useEscapeCapture } from './hooks';

const CONFIRM_VARIANT = { danger: 'primary', success: 'success', primary: 'primary', ember: 'ember' };
const ICON_TONE = {
  danger: 'bg-danger/12 text-danger-light ring-danger/30',
  success: 'bg-toxic/10 text-toxic ring-toxic/30',
  primary: 'bg-pumpkin/12 text-pumpkin-light ring-pumpkin/30',
  ember: 'bg-ember/12 text-ember ring-ember/30',
};

/**
 * Confirmación para acciones importantes. Se puede abrir encima de otro Modal.
 *   reason: { label, placeholder, hint, required = true, minLength = 3, maxLength = 200, suggestions: [] }
 *           → pide un texto (motivo / nota) y se lo pasa a onConfirm(texto).
 * onConfirm puede ser async: mientras corre, el botón muestra "cargando" y no se puede cerrar.
 * El que llama decide si cierra el diálogo (normalmente al terminar bien).
 */
export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  children,
  icon: Icon,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  tone = 'danger',
  reason,
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setText('');
      setBusy(false);
    }
  }, [open]);

  useEscapeCapture(open, () => {
    if (!busy) onClose?.();
  });

  const required = reason ? reason.required !== false : false;
  const minLength = required ? (reason?.minLength ?? 3) : 0;
  const maxLength = reason?.maxLength ?? 200;
  const valid = !reason || text.trim().length >= minLength;

  const handleConfirm = async () => {
    if (!valid || busy) return;
    setBusy(true);
    try {
      await onConfirm?.(text.trim());
    } catch {
      /* el que llama muestra el error */
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    if (!busy) onClose?.();
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title={title}
      size={reason ? 'md' : 'sm'}
      closeOnBackdrop={!busy}
      footer={
        <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
          <Button variant="secondary" onClick={close} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button variant={CONFIRM_VARIANT[tone] || 'primary'} onClick={handleConfirm} loading={busy} disabled={!valid}>
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {(description || Icon) && (
          <div className="flex items-start gap-3.5">
            {Icon && (
              <span className={clsx('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1', ICON_TONE[tone])}>
                <Icon className="h-5 w-5" strokeWidth={1.75} />
              </span>
            )}
            {description && <div className="min-w-0 pt-0.5 text-sm leading-relaxed text-fog">{description}</div>}
          </div>
        )}
        {children}
        {reason && (
          <div className="flex flex-col gap-2.5">
            <Textarea
              label={reason.label}
              placeholder={reason.placeholder}
              hint={reason.hint || (required ? `Mínimo ${minLength} caracteres.` : undefined)}
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, maxLength))}
              rows={3}
              required={required}
            />
            {reason.suggestions?.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {reason.suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setText(s)}
                    className={clsx(
                      'min-h-10 rounded-full border px-3.5 text-xs font-medium transition',
                      text === s
                        ? 'border-pumpkin/60 bg-pumpkin/15 text-bone'
                        : 'border-white/10 bg-white/[0.03] text-fog hover:border-white/25 hover:text-bone',
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
