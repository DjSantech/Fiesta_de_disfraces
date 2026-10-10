import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { CheckCircle2, Clock3, ImagePlus, RefreshCw, Send, ShieldCheck, TriangleAlert } from 'lucide-react';
import { Button, Input, Modal } from '../ui';
import { api } from '../../lib/api';
import { formatCOP, formatTime } from '../../lib/format';
import { PHASE_LABEL, GENDER_LABEL } from '../../lib/labels';
import { REFUND_POLICY } from '../../config/event';
import { CopyButton, Notice } from './ui';
import { describeError } from './utils/errors';

export function PolicyModal({ open, onClose }) {
  return (
    <Modal open={open} onClose={onClose} title="Política de devoluciones" footer={<Button block onClick={onClose}>Entendido</Button>}>
      <ul className="flex flex-col gap-3">
        {REFUND_POLICY.map((t) => (
          <li key={t} className="flex gap-3 text-sm leading-relaxed text-fog">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rotate-45 bg-pumpkin" aria-hidden="true" />
            {t}
          </li>
        ))}
      </ul>
    </Modal>
  );
}

/** Desglose de precio (Breakdown del contrato). */
export function PriceBreakdown({ kind, gender, room, breakdown, loading, className }) {
  if (!breakdown) return null;
  const item = kind === 'room'
    ? `${room?.name || 'Habitación'}${room?.capacity ? ` · hasta ${room.capacity} personas` : ''}`
    : `Entrada ${GENDER_LABEL[gender] || ''} · ${PHASE_LABEL[breakdown.phase] || ''}`;
  return (
    <dl className={clsx('flex flex-col gap-2 text-sm', className)}>
      <div className="flex justify-between gap-3">
        <dt className="text-fog">{item}</dt>
        <dd className="tabular-nums text-bone">{formatCOP(breakdown.base)}</dd>
      </div>
      {breakdown.discount > 0 && (
        <div className="flex justify-between gap-3">
          <dt className="text-gold">Lista de invitados (amigos cercanos)</dt>
          <dd className="tabular-nums text-gold">−{formatCOP(breakdown.discount)}</dd>
        </div>
      )}
      <div className="mt-1 flex items-end justify-between gap-3 border-t border-white/[0.08] pt-3">
        <dt className="text-[11px] font-semibold uppercase tracking-[0.24em] text-fog">Total</dt>
        <dd className={clsx('font-display text-4xl leading-none tabular-nums text-bone', loading && 'opacity-50')}>{formatCOP(breakdown.total)}</dd>
      </div>
    </dl>
  );
}

/** Comprime en el navegador: máx 1600 px, JPEG 0.82. */
async function compressImage(file) {
  let source;
  try {
    source = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    source = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }
  const w = source.width;
  const h = source.height;
  const scale = Math.min(1, 1600 / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.82));
  if (!blob) throw new Error('compress');
  return new File([blob], 'comprobante.jpg', { type: 'image/jpeg' });
}

/** Subida del pantallazo del comprobante → POST /receipt. */
export function ReceiptUpload({ token, onUploaded, replacing = false }) {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  async function onPick(e) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setError(null);
    setBusy(true);
    try {
      let out;
      try {
        out = await compressImage(f);
      } catch {
        if (/^image\/(jpeg|png|webp)$/.test(f.type) && f.size <= 5 * 1024 * 1024) out = f;
        else throw new Error('read');
      }
      setFile(out);
      setPreview(URL.createObjectURL(out));
    } catch {
      setError({ title: 'No pudimos leer esa imagen', message: 'Sube un pantallazo en JPG o PNG.' });
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file, file.name || 'comprobante.jpg');
      if (reference.trim()) fd.append('reference', reference.trim().slice(0, 60));
      const data = await api(`/api/public/orders/${token}/receipt`, { method: 'POST', body: fd });
      onUploaded?.(data.order);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-labelledby="receipt-title"
      className="relative overflow-hidden rounded-3xl border-2 border-pumpkin bg-linear-to-b from-pumpkin/[0.14] to-crypt p-5 animate-pulse-glow sm:p-6"
    >
      <p className="inline-flex items-center gap-2 rounded-full bg-pumpkin px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-white">
        <TriangleAlert className="h-3.5 w-3.5" /> Último paso · obligatorio
      </p>
      <h3 id="receipt-title" className="mt-3 font-display text-4xl uppercase leading-[0.95] text-bone sm:text-5xl">Sube la captura de tu pago</h3>
      <p className="mt-2 text-[15px] leading-relaxed text-bone/90">Tu entrada se confirma cuando recibimos tu comprobante.</p>
      <ul className="mt-3 flex flex-col gap-1.5 text-sm text-fog">
        {['Que se vea el valor', 'Que se vea la fecha', 'Que se vea la referencia'].map((t) => (
          <li key={t} className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-toxic" /> {t}</li>
        ))}
      </ul>
      <div className="mt-5 flex flex-col gap-4">
        <input ref={inputRef} type="file" accept="image/*" className="sr-only" onChange={onPick} tabIndex={-1} aria-hidden="true" />
        {preview ? (
          <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-ink/60 p-3">
            <img src={preview} alt="Vista previa del comprobante" className="h-28 w-20 rounded-lg object-cover" />
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-semibold text-bone">Comprobante listo</p>
              <p className="text-fog">{Math.round(file.size / 1024)} KB</p>
              <button type="button" onClick={() => inputRef.current?.click()} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-pumpkin-light">
                <RefreshCw className="h-3.5 w-3.5" /> Cambiar imagen
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-pumpkin/70 bg-pumpkin/10 px-4 py-8 text-center transition hover:bg-pumpkin/20"
          >
            <ImagePlus className="h-12 w-12 text-pumpkin-light" strokeWidth={1.4} />
            <span className="font-display text-2xl uppercase text-bone">{replacing ? 'Subir otra captura' : 'Toca para subir la captura'}</span>
            <span className="text-xs text-fog">JPG o PNG · lo optimizamos antes de enviarlo</span>
          </button>
        )}
        <Input label="Referencia de la transacción (opcional)" value={reference} maxLength={60} onChange={(e) => setReference(e.target.value)} placeholder="Ej. M845123" />
        {error && <Notice title={error.title}>{error.message}</Notice>}
        <Button size="xl" block onClick={submit} disabled={!file} loading={busy} className="font-display uppercase tracking-[0.05em]">
          <Send className="h-5 w-5" /> Enviar comprobante
        </Button>
      </div>
    </section>
  );
}

const LOGOS = [
  { match: 'bre', src: '/pagos/logo-breb.png', alt: 'Logo Bre-B' },
  { match: 'nequi', src: '/pagos/logo-nequi.png', alt: 'Logo Nequi' },
];

function LogoChip({ src, alt }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <span className="flex h-12 w-28 items-center justify-center rounded-full bg-white px-4">
      <img src={src} alt={alt} loading="lazy" width="96" height="32" onError={() => setFailed(true)} className="max-h-8 w-auto max-w-full object-contain" />
    </span>
  );
}

function PayQr() {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <figure className="flex flex-col items-center gap-3">
      <div className="rounded-2xl bg-white p-3 shadow-[0_0_40px_-12px_rgb(255_106_0/0.7)]">
        <img src="/pagos/qr-pago.png" alt="Código QR para pagar por Bre-B o Nequi" loading="lazy" onError={() => setFailed(true)} className="w-60 max-w-full" />
      </div>
      <figcaption className="max-w-xs text-center text-sm text-fog">Escanéalo desde la app de tu banco (Bre-B) o desde Nequi</figcaption>
    </figure>
  );
}

const pretty = (n) => String(n).replace(/^(\d{3})(\d{3})(\d{4})$/, '$1 $2 $3');

/** Instrucciones de transferencia + subida del comprobante. */
export function TransferPanel({ order, config, onUploaded }) {
  const accounts = config.paymentAccounts || [];
  const logos = LOGOS.filter((l) => accounts.some((a) => String(a.label).toLowerCase().includes(l.match)));
  const key = accounts.find((a) => /bre/i.test(a.label)) || accounts[0];
  const others = accounts.filter((a) => a.number !== key?.number);
  return (
    <div className="flex flex-col gap-5">
      {!order.receiptUploaded && (
        <Notice tone="gold" icon={TriangleAlert} title="Falta tu comprobante">
          Tu entrada todavía no está confirmada. Paga y sube la captura aquí abajo.
        </Notice>
      )}
      <div className="rounded-3xl border border-pumpkin/30 bg-pumpkin/[0.07] p-5 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-fog">Valor exacto a transferir</p>
        <p className="mt-2 font-display text-5xl tabular-nums text-bone">{formatCOP(order.amount)}</p>
        <CopyButton value={order.amount} label="Copiar valor" className="mt-3" />
      </div>
      {order.holdExpiresAt && (
        <Notice tone="gold" icon={Clock3} title={`Habitación apartada hasta las ${formatTime(order.holdExpiresAt)}`}>
          Sube el comprobante antes de esa hora para no perderla.
        </Notice>
      )}
      {key && (
        <div className="flex flex-col items-center gap-5 rounded-3xl border border-white/10 bg-crypt/70 p-5 text-center">
          {logos.length > 0 && (
            <div className="flex items-center justify-center gap-3">
              {logos.map((l) => <LogoChip key={l.src} {...l} />)}
            </div>
          )}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-pumpkin-light">Llave Bre-B</p>
            <p className="mt-1 font-display text-5xl tabular-nums text-bone sm:text-6xl">{key.number}</p>
            <CopyButton value={key.number} label="Copiar llave" className="mt-3" />
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-fog">
            Llave Bre-B: pega este número en tu app bancaria · También puedes enviar por Nequi al mismo número
          </p>
          <PayQr />
          {others.map((a) => (
            <p key={a.label + a.number} className="text-sm text-fog">{a.label}: <span className="tabular-nums text-bone">{pretty(a.number)}</span></p>
          ))}
        </div>
      )}
      {config.transferInstructions && <p className="text-sm leading-relaxed text-fog">{config.transferInstructions}</p>}
      <ReceiptUpload token={order.token} onUploaded={onUploaded} replacing={order.receiptUploaded} />
      <p className="flex gap-2 text-xs leading-relaxed text-fog">
        <ShieldCheck className="h-4 w-4 shrink-0 text-toxic" />
        Confirmamos tu pago a mano en pocas horas. Tu entrada aparecerá en el enlace de tu compra.
      </p>
    </div>
  );
}
