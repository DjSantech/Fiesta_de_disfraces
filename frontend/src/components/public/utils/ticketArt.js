// Imágenes y calendario de la entrada (se importa solo al hacer clic).
import QRCode from 'qrcode';
import { EVENT } from '../../../config/event';
import { formatTime } from '../../../lib/format';
import { shortWeekdayDate } from './dates';

async function fonts() {
  try {
    await Promise.all(['400 100px Anton', '600 40px Inter', 'italic 500 60px "Cormorant Garamond"'].map((f) => document.fonts.load(f)));
  } catch {
    /* usa fuentes del sistema */
  }
}

function background(ctx, w, h) {
  ctx.fillStyle = '#07070a';
  ctx.fillRect(0, 0, w, h);
  const g = ctx.createRadialGradient(w / 2, 0, 0, w / 2, 0, h * 0.75);
  g.addColorStop(0, 'rgba(255,106,0,0.55)');
  g.addColorStop(1, 'rgba(255,106,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const v = ctx.createRadialGradient(w / 2, h, 0, w / 2, h, h * 0.6);
  v.addColorStop(0, 'rgba(139,92,246,0.22)');
  v.addColorStop(1, 'rgba(139,92,246,0)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
}

function text(ctx, str, x, y, font, color, { glow, spacing = 0, align = 'center' } = {}) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.letterSpacing = `${spacing}px`;
  ctx.shadowColor = glow || 'transparent';
  ctx.shadowBlur = glow ? 40 : 0;
  ctx.fillText(str, x, y);
  ctx.shadowBlur = 0;
}

const toBlob = (c) => new Promise((r) => c.toBlob(r, 'image/png'));

function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** PNG de la entrada: QR + nombre + código + fecha. */
export async function downloadTicketPng(ticket, startsAt, url) {
  await fonts();
  const W = 1080;
  const H = 1620;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  background(ctx, W, H);
  text(ctx, EVENT.presenter.toUpperCase(), W / 2, 130, '600 30px Inter', 'rgba(242,237,228,0.8)', { spacing: 10 });
  text(ctx, 'FIESTA DE', W / 2, 270, '400 150px Anton', '#f2ede4');
  text(ctx, 'DISFRACES', W / 2, 420, '400 150px Anton', '#ff6a00', { glow: 'rgba(255,106,0,0.8)' });
  text(ctx, `${shortWeekdayDate(startsAt)} · ${formatTime(startsAt)} · ${EVENT.city}`.toUpperCase(), W / 2, 495, '600 32px Inter', 'rgba(163,160,173,1)', { spacing: 4 });
  // QR
  const qr = QRCode.create(url, { errorCorrectionLevel: 'M' });
  const n = qr.modules.size;
  const box = 640;
  const bx = (W - box) / 2;
  const by = 560;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(bx, by, box, box, 36);
  ctx.fill();
  const quiet = 4;
  const cell = Math.floor((box - 40) / (n + quiet * 2));
  const off = bx + (box - cell * (n + quiet * 2)) / 2 + cell * quiet;
  const offY = by + (box - cell * (n + quiet * 2)) / 2 + cell * quiet;
  ctx.fillStyle = '#000000';
  for (let r = 0; r < n; r++) for (let col = 0; col < n; col++) if (qr.modules.get(r, col)) ctx.fillRect(off + col * cell, offY + r * cell, cell, cell);
  text(ctx, ticket.code, W / 2, 1320, '400 92px Anton', '#f2ede4', { spacing: 10 });
  text(ctx, ticket.holderName, W / 2, 1405, '600 46px Inter', '#f2ede4');
  text(ctx, 'Entrada única · seguridad la escanea en la puerta', W / 2, 1530, '500 30px Inter', 'rgba(163,160,173,1)');
  download(await toBlob(c), `entrada-${ticket.code}.png`);
}

/** Imagen 1080×1920 para historias, SIN QR. */
export async function shareStory() {
  await fonts();
  const W = 1080;
  const H = 1920;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  background(ctx, W, H);
  text(ctx, EVENT.presenter.toUpperCase(), W / 2, 420, '600 34px Inter', 'rgba(242,237,228,0.85)', { spacing: 12 });
  text(ctx, 'YA TENGO', W / 2, 660, '400 230px Anton', '#f2ede4');
  text(ctx, 'MI ENTRADA', W / 2, 900, '400 230px Anton', '#ff6a00', { glow: 'rgba(255,106,0,0.9)' });
  text(ctx, 'FIESTA DE DISFRACES', W / 2, 1080, '400 96px Anton', '#f2ede4', { spacing: 4 });
  text(ctx, `${EVENT.shortDate} · ${EVENT.city.toUpperCase()}`, W / 2, 1190, '400 80px Anton', 'rgba(255,77,94,1)', { spacing: 8 });
  text(ctx, EVENT.tagline, W / 2, 1320, 'italic 500 64px "Cormorant Garamond"', 'rgba(242,237,228,0.85)');
  text(ctx, '¿Y tú, ya tienes la tuya?', W / 2, 1500, '600 40px Inter', 'rgba(163,160,173,1)');
  text(ctx, window.location.host, W / 2, 1565, '600 36px Inter', 'rgba(242,237,228,0.7)', { spacing: 3 });
  const blob = await toBlob(c);
  const file = new File([blob], 'ya-tengo-mi-entrada.png', { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Ya tengo mi entrada' });
      return;
    } catch (e) {
      if (e?.name === 'AbortError') return;
    }
  }
  download(blob, file.name);
}

/** Archivo .ics para el calendario. */
export function downloadIcs(startsAt, url, locationName) {
  const s = new Date(startsAt);
  const e = new Date(s.getTime() + 8 * 3600 * 1000);
  const f = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Fiesta de Disfraces//ES', 'BEGIN:VEVENT',
    `UID:${f(s)}-fiesta-disfraces@pereira`, `DTSTAMP:${f(new Date())}`, `DTSTART:${f(s)}`, `DTEND:${f(e)}`,
    'SUMMARY:Fiesta de Disfraces · DJ Santech',
    `LOCATION:${(locationName || 'Finca en Pereira (la ubicación se envía el 31)').replace(/,/g, '\\,')}`,
    `DESCRIPTION:Tu entrada: ${url}`, `URL:${url}`,
    'BEGIN:VALARM', 'TRIGGER:-PT3H', 'ACTION:DISPLAY', 'DESCRIPTION:Hoy es la Fiesta de Disfraces', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
  download(new Blob([ics], { type: 'text/calendar;charset=utf-8' }), 'fiesta-de-disfraces.ics');
}
