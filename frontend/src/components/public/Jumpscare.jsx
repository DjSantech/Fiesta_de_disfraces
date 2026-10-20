import { useEffect, useRef, useState } from 'react';
import { m } from 'motion/react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { KEYS, local, session } from './utils/storage';
import { lockScroll } from './utils/scrollLock';

// Susto (screamer) al tocar "Entrar" en la intro. Créditos de la imagen y el grito: docs/CREDITOS.md.
// El navegador solo deja sonar audio tras un toque, por eso el grito arranca en el clic de la intro
// (playScare) y este componente solo pinta: estática → cara → "TE VEMOS EL 31" → mensaje tranquilo.
// Seguridad: un solo destello rojo, nada de parpadeos rápidos y menos de 2 s de imagen.

export const SUSTO = { image: '/susto/cara.jpg', sound: '/susto/grito.mp3' };

const STATIC_MS = 110;
const FACE_END_MS = 1900;
const TEXT_END_MS = 2600;

const param = (name) => {
  try {
    return new URLSearchParams(window.location.search).get(name);
  } catch {
    return null;
  }
};

/** ¿El susto está listo para saltar? ?susto=1 lo fuerza, ?susto=0 lo apaga; nunca al staff; una vez por sesión. */
export function jumpscareArmed(enabled) {
  const p = param('susto');
  if (p === '0') return false;
  if (p === '1') return true;
  if (!enabled) return false;
  if (local.get('fd_staff_token')) return false;
  return session.get(KEYS.scareSeen) !== '1';
}

/** Precarga el grito y la cara para que salgan al instante. */
export function prepareScare() {
  try {
    const img = new Image();
    img.src = SUSTO.image;
    const audio = new Audio(SUSTO.sound);
    audio.preload = 'auto';
    audio.load();
    return audio;
  } catch {
    return null;
  }
}

/** Llamar DENTRO del manejador del clic: así el navegador permite el sonido. */
export function playScare(audio) {
  session.set(KEYS.scareSeen, '1');
  try {
    const a = audio || new Audio(SUSTO.sound);
    a.muted = false;
    a.volume = 1;
    a.currentTime = 0;
    a.play()?.catch(() => {});
  } catch {
    /* sin audio: queda solo la imagen */
  }
  try {
    navigator.vibrate?.([450, 90, 700]);
  } catch {
    /* sin vibración */
  }
}

const reducedMotion = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

const rand = (min, max) => min + Math.random() * (max - min);

/** Ruido de TV en baja resolución (se escala pixelado). */
function useStatic(canvasRef, active) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!active || !canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;
    const { width, height } = canvas;
    const frame = ctx.createImageData(width, height);
    const buf = new Uint32Array(frame.data.buffer);
    let raf = 0;
    const draw = () => {
      for (let i = 0; i < buf.length; i++) {
        const v = (Math.random() * 255) | 0;
        buf[i] = 0xff000000 | (v << 16) | (v << 8) | v;
      }
      ctx.putImageData(frame, 0, 0);
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [canvasRef, active]);
}

// Cuadrado que cubre la pantalla (con margen para la sacudida) con la cara (54 %, 38 % de la foto)
// en el centro; arriba nunca deja hueco negro.
const FACE_SIZE = 'max(115vw, 115dvh)';
const FACE_BOX = {
  width: FACE_SIZE,
  height: FACE_SIZE,
  left: `calc(50vw - 0.54 * ${FACE_SIZE})`,
  top: `min(0px, calc(50dvh - 0.38 * ${FACE_SIZE}))`,
  transformOrigin: '54% 38%',
};
const SLICES = 4;

function Face({ calm }) {
  const shakeRef = useRef(null);
  const ghostRef = useRef(null);
  const sliceRefs = useRef([]);

  useEffect(() => {
    if (calm) return undefined;
    const start = performance.now();
    let raf = 0;
    let lastSlice = 0;
    const tick = (now) => {
      const t = now - start;
      // Sacudida violenta al inicio que se calma un poco, con zoom lento hacia la cara.
      const k = t < 260 ? 1 : 0.45;
      const zoom = 1.32 - Math.min(t, 140) / 140 * 0.3 + (t / 1800) * 0.16;
      if (shakeRef.current) {
        shakeRef.current.style.transform = `translate(${rand(-22, 22) * k}px, ${rand(-16, 16) * k}px) rotate(${rand(-1.6, 1.6) * k}deg) scale(${zoom})`;
      }
      if (ghostRef.current) {
        ghostRef.current.style.transform = `translate(${rand(10, 26) * (Math.random() < 0.5 ? -1 : 1)}px, ${rand(-6, 6)}px)`;
      }
      if (now - lastSlice > 85) {
        lastSlice = now;
        sliceRefs.current.forEach((el) => {
          if (!el) return;
          if (Math.random() < 0.45) {
            el.style.opacity = '0';
            return;
          }
          const top = rand(0, 92);
          el.style.opacity = '1';
          el.style.clipPath = `inset(${top}% 0 ${Math.max(0, 100 - top - rand(1.5, 9))}% 0)`;
          el.style.transform = `translateX(${rand(-60, 60)}px)`;
        });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [calm]);

  const img = 'absolute inset-0 h-full w-full select-none object-cover';
  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      <div ref={shakeRef} className="absolute" style={{ ...FACE_BOX, transform: calm ? 'scale(1.05)' : undefined }}>
        <img src={SUSTO.image} alt="" draggable="false" className={img} style={{ filter: 'contrast(1.25) brightness(1.05)' }} />
        {/* Fantasma desplazado (separación de color) */}
        {!calm && (
          <img
            ref={ghostRef}
            src={SUSTO.image}
            alt=""
            draggable="false"
            className={`${img} opacity-40 mix-blend-screen`}
            style={{ filter: 'sepia(1) hue-rotate(140deg) saturate(5) brightness(0.9)' }}
          />
        )}
        {/* Bandas de imagen corridas (glitch) */}
        {!calm &&
          Array.from({ length: SLICES }, (_, i) => (
            <img
              key={i}
              ref={(el) => (sliceRefs.current[i] = el)}
              src={SUSTO.image}
              alt=""
              draggable="false"
              className={img}
              style={{ opacity: 0, filter: i % 2 ? 'invert(1) contrast(1.4)' : 'contrast(1.8) brightness(1.3)' }}
            />
          ))}
        {/* Tinte rojo sangre */}
        <div className="absolute inset-0 bg-[#d10a0a] mix-blend-multiply" style={{ opacity: 0.62 }} />
        <div className="absolute inset-0 bg-[#ff2a1a] mix-blend-color" style={{ opacity: 0.35 }} />
        {/* Ojos encendidos */}
        {[
          ['46.5%', '24.8%', '3.2%'],
          ['64%', '29%', '4%'],
        ].map(([x, y, r]) => (
          <span
            key={x}
            className="fd-susto-eye absolute rounded-full mix-blend-screen"
            style={{
              left: x,
              top: y,
              width: r,
              height: r,
              transform: 'translate(-50%, -50%)',
              background: 'radial-gradient(circle, rgb(255 245 235 / 1) 0%, rgb(255 60 30 / 0.95) 35%, rgb(255 0 0 / 0.35) 60%, transparent 72%)',
              boxShadow: '0 0 40px 18px rgb(255 20 0 / 0.55)',
            }}
          />
        ))}
      </div>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_60%_at_50%_42%,transparent_35%,rgb(0_0_0/0.85)_100%)]" />
      <div className="fd-susto-scan pointer-events-none absolute inset-0" />
    </div>
  );
}

export default function Jumpscare({ onDone }) {
  const calm = reducedMotion();
  const [phase, setPhase] = useState(calm ? 'face' : 'static');
  const staticRef = useRef(null);
  const grainRef = useRef(null);
  const closeRef = useRef(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useStatic(staticRef, phase === 'static');
  useStatic(grainRef, phase === 'face' && !calm);

  useEffect(() => {
    const unlock = lockScroll();
    const timers = [
      !calm && setTimeout(() => setPhase('face'), STATIC_MS),
      setTimeout(() => setPhase('text'), FACE_END_MS),
      setTimeout(() => setPhase('calm'), TEXT_END_MS),
    ].filter(Boolean);
    const onKey = (e) => {
      if (e.key === 'Escape') onDoneRef.current?.();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      timers.forEach(clearTimeout);
      document.removeEventListener('keydown', onKey);
      unlock();
    };
  }, [calm]);

  useEffect(() => {
    if (phase === 'calm') closeRef.current?.focus({ preventScroll: true });
  }, [phase]);

  return (
    <m.div
      role="dialog"
      aria-modal="true"
      aria-label="Susto de bienvenida"
      className="fixed inset-0 z-[90] overflow-hidden bg-black text-bone"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.5 } }}
    >
      {phase === 'static' && (
        <canvas ref={staticRef} width={200} height={120} aria-hidden="true" className="absolute inset-0 h-full w-full [image-rendering:pixelated]" />
      )}

      {phase === 'face' && (
        <>
          <Face calm={calm} />
          {!calm && (
            <canvas ref={grainRef} width={180} height={110} aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.13] mix-blend-screen [image-rendering:pixelated]" />
          )}
          {/* Único destello rojo, al aparecer la cara */}
          {!calm && (
            <m.div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[#ff1a00]"
              initial={{ opacity: 0.75 }}
              animate={{ opacity: 0 }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
            />
          )}
        </>
      )}

      {phase === 'text' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black px-6">
          <p className="fd-susto-text text-center font-display uppercase leading-[0.86] text-[length:clamp(3.6rem,17vw,11rem)]">
            Te vemos
            <br />
            <span className="text-[#ff2a1a]">el 31</span>
          </p>
        </div>
      )}

      {phase === 'calm' && (
        <m.div
          className="absolute inset-0 flex flex-col items-center justify-center bg-[radial-gradient(60%_50%_at_50%_45%,rgb(120_10_0/0.45),transparent_70%)] px-6 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <p className="text-5xl" aria-hidden="true">😈</p>
          <h2 className="mt-4 font-display text-[length:clamp(2.6rem,9vw,4.5rem)] uppercase leading-none tracking-wide">¿Te asustaste?</h2>
          <p className="mt-3 font-serif text-2xl italic text-fog sm:text-3xl">Esto apenas empieza.</p>
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.3em] text-pumpkin-light">Sábado 31 de octubre · Pereira</p>
          <div className="mt-9 flex w-full max-w-sm flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
            <Link
              to="/comprar"
              onClick={() => onDoneRef.current?.()}
              className="fd-shine group inline-flex h-13 items-center justify-center gap-2 rounded-full bg-pumpkin px-8 font-display text-lg uppercase tracking-[0.16em] text-white shadow-[0_0_40px_-8px_rgb(255_106_0/0.9)] transition hover:bg-pumpkin-light"
            >
              Comprar entrada
              <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
            </Link>
            <button
              ref={closeRef}
              type="button"
              onClick={() => onDoneRef.current?.()}
              className="inline-flex h-13 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] px-8 text-sm font-semibold uppercase tracking-[0.2em] text-fog transition hover:border-white/35 hover:text-bone"
            >
              Seguir
            </button>
          </div>
        </m.div>
      )}
    </m.div>
  );
}
