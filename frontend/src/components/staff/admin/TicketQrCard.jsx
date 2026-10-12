import { useEffect, useState } from 'react';
import { Download, ImageDown, QrCode } from 'lucide-react';
import QRCode from 'qrcode';
import { Badge, Button, useToast } from '../../ui';
import { TICKET_KIND_LABEL, TICKET_STATUS_LABEL, TICKET_STATUS_TONE } from '../../../lib/labels';
import { FALLBACK_CONFIG } from '../../../config/event';
import { usePublicConfig } from '../../public/usePublicConfig';
import CopyButton from './CopyButton';
import { WhatsAppButton } from './Contact';
import { firstName, ticketUrl } from './utils';

/** Texto de WhatsApp con el enlace de la entrada (el PNG se adjunta a mano). */
export function ticketQrWhatsappText(buyerName, link) {
  return `¡Hola ${firstName(buyerName)}! Tu entrada para la Fiesta de Disfraces está lista. Ábrela aquí: ${link}. Presenta el QR en la puerta con tu cédula.`;
}

/** QR en el navegador: módulos negros sobre fondo blanco, con margen y corrección M. */
export function qrDataUrl(link, width = 720) {
  return QRCode.toDataURL(link, { errorCorrectionLevel: 'M', margin: 4, width, color: { dark: '#000000', light: '#ffffff' } });
}

function saveDataUrl(dataUrl, filename) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Descarga la entrada completa (QR + nombre + código + fecha) reutilizando ticketArt. */
export async function downloadTicketArt(ticket, startsAt) {
  const art = await import('../../public/utils/ticketArt');
  await art.downloadTicketPng({ code: ticket.code, holderName: ticket.holderName }, startsAt, ticketUrl(ticket.token));
}

/**
 * Tarjeta con el QR grande de una entrada y sus acciones (descargar PNG, solo QR, copiar enlace, WhatsApp).
 * La usan "Crear entrada", el detalle de la compra y el modal de la entrada.
 * `buyer` = { name, phone } del comprador (destino del WhatsApp).
 */
export default function TicketQrCard({ ticket, buyer, className }) {
  const toast = useToast();
  const { config } = usePublicConfig();
  const [qr, setQr] = useState(null);
  const [busy, setBusy] = useState(false);
  const link = ticketUrl(ticket.token);
  const startsAt = config?.event?.startsAt || FALLBACK_CONFIG.event.startsAt;

  useEffect(() => {
    let alive = true;
    setQr(null);
    qrDataUrl(link).then((url) => alive && setQr(url)).catch(() => alive && setQr(null));
    return () => {
      alive = false;
    };
  }, [link]);

  const downloadFull = async () => {
    setBusy(true);
    try {
      await downloadTicketArt(ticket, startsAt);
    } catch {
      toast.error('No se pudo generar la imagen de la entrada.');
    } finally {
      setBusy(false);
    }
  };

  const downloadQr = () => {
    if (qr) saveDataUrl(qr, `qr-${ticket.code}.png`);
  };

  return (
    <div className={`flex flex-col items-center gap-4 rounded-2xl border border-white/[0.08] bg-tomb/50 p-4 text-center ${className || ''}`}>
      <div className="flex w-full items-center justify-between gap-2 text-left">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-bone">{ticket.holderName}</p>
          <p className="font-mono text-sm tracking-wide text-fog">{ticket.code}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {ticket.kind && <Badge tone="neutral">{TICKET_KIND_LABEL[ticket.kind] || ticket.kind}</Badge>}
          {ticket.status && <Badge tone={TICKET_STATUS_TONE[ticket.status]}>{TICKET_STATUS_LABEL[ticket.status] || ticket.status}</Badge>}
        </div>
      </div>

      <div className="flex aspect-square w-full max-w-[18rem] items-center justify-center rounded-2xl bg-white p-1">
        {qr ? (
          <img src={qr} alt={`QR de la entrada ${ticket.code}`} className="h-full w-full" />
        ) : (
          <QrCode className="h-10 w-10 animate-pulse text-neutral-400" aria-label="Generando QR…" />
        )}
      </div>

      <div className="grid w-full grid-cols-1 gap-2">
        <Button onClick={downloadFull} loading={busy}>
          <ImageDown className="h-4 w-4" />
          Descargar entrada (PNG)
        </Button>
        <Button variant="secondary" onClick={downloadQr} disabled={!qr}>
          <Download className="h-4 w-4" />
          Descargar solo el QR (PNG)
        </Button>
        <CopyButton text={link} label="Copiar enlace de la entrada" copiedLabel="Copiado" />
        {buyer?.phone && (
          <WhatsAppButton phone={buyer.phone} text={ticketQrWhatsappText(buyer.name, link)} label="Enviar por WhatsApp" />
        )}
      </div>
      {buyer?.phone && (
        <p className="text-xs text-smoke">
          WhatsApp Web no permite adjuntar imágenes por enlace: el mensaje lleva el enlace de la entrada; si quieres mandar también el PNG, adjúntalo a mano desde la descarga.
        </p>
      )}
    </div>
  );
}
