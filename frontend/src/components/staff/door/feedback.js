// Señales para portería: beep con WebAudio + vibración. Todo es "mejor esfuerzo":
// si el navegador no lo permite, no pasa nada.

let ctx = null;

/** Crea/reanuda el AudioContext. Llamar desde un gesto del usuario (pointerdown) para desbloquear el audio. */
export function unlockAudio() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
    }
    // 'suspended' (sin gesto aún) o 'interrupted' (iOS tras una llamada): reanudar.
    if (ctx.state !== 'running' && ctx.state !== 'closed') ctx.resume().catch(() => {});
  } catch {
    /* sin audio */
  }
}

function tone({ freq, type = 'sine', start = 0, duration = 0.12, volume = 0.5, endFreq }) {
  const t0 = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t0 + duration);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.012);
  gain.gain.setValueAtTime(volume, t0 + duration - 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

/** 'ok' = tono agudo corto · 'bad' = zumbido grave · 'warn' = doble tono medio. */
export function beep(kind = 'ok') {
  unlockAudio();
  if (!ctx || ctx.state !== 'running') return;
  try {
    if (kind === 'ok') {
      tone({ freq: 1568, duration: 0.09, volume: 0.45 });
      tone({ freq: 2093, start: 0.1, duration: 0.14, volume: 0.45 });
    } else if (kind === 'warn') {
      tone({ freq: 880, type: 'triangle', duration: 0.14, volume: 0.5 });
      tone({ freq: 880, type: 'triangle', start: 0.2, duration: 0.14, volume: 0.5 });
    } else {
      // Onda cuadrada grave: sus armónicos se oyen incluso en parlantes pequeños.
      tone({ freq: 196, type: 'square', duration: 0.22, volume: 0.28 });
      tone({ freq: 147, type: 'square', start: 0.26, duration: 0.34, volume: 0.28 });
    }
  } catch {
    /* sin audio */
  }
}

export function vibrate(kind = 'ok') {
  try {
    if (!('vibrate' in navigator)) return;
    navigator.vibrate(kind === 'ok' ? 70 : kind === 'warn' ? [90, 80, 90] : [260, 110, 260]);
  } catch {
    /* sin vibración (iPhone) */
  }
}

/** Beep + vibración. */
export function signal(kind) {
  beep(kind);
  vibrate(kind);
}
