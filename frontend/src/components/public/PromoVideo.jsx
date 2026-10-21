import { useEffect, useRef, useState } from 'react';
import { m } from 'motion/react';
import { Volume2, X } from 'lucide-react';
import { lockScroll } from './utils/scrollLock';

// Video de la fiesta (43 s) a pantalla completa justo después del susto.
// Solo se descarga cuando se muestra. Si el navegador no deja sonar, arranca en silencio con
// botón "Activar sonido"; si no arranca en 6 s (conexión lenta) o falla, sigue a la web.

export const PROMO_VIDEO = { src: '/video/fiesta.mp4', poster: '/video/fiesta-poster.jpg' };
const START_TIMEOUT_MS = 6000;

// Un solo <video> para toda la visita: se "desbloquea" dentro del toque del susto (unlockPromoVideo)
// para que después pueda sonar; en iPhone el permiso es por elemento.
let shared = null;
function promoVideoEl() {
  if (!shared) {
    shared = document.createElement('video');
    shared.src = PROMO_VIDEO.src;
    shared.poster = PROMO_VIDEO.poster;
    shared.playsInline = true;
    shared.setAttribute('playsinline', '');
    shared.preload = 'auto';
  }
  return shared;
}

/** Llamar DENTRO de un clic (el del susto): reproduce y pausa al instante para ganar el permiso de sonido. */
export function unlockPromoVideo() {
  try {
    const v = promoVideoEl();
    v.muted = false;
    v.play()?.then(() => {
      v.pause();
      v.currentTime = 0;
    }).catch(() => {});
  } catch {
    /* sin video */
  }
}

export default function PromoVideo({ onDone }) {
  const boxRef = useRef(null);
  const videoRef = useRef(null);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const unlock = lockScroll();
    const v = promoVideoEl();
    videoRef.current = v;
    v.className = 'h-full w-full object-contain';
    v.currentTime = 0;
    boxRef.current?.appendChild(v);
    const done = () => onDoneRef.current?.();
    const onTime = () => setProgress(v.duration ? v.currentTime / v.duration : 0);
    v.addEventListener('ended', done);
    v.addEventListener('error', done);
    v.addEventListener('timeupdate', onTime);
    let started = false;
    const timer = setTimeout(() => {
      if (!started) onDoneRef.current?.();
    }, START_TIMEOUT_MS);
    const onPlaying = () => {
      started = true;
      clearTimeout(timer);
    };
    v.addEventListener('playing', onPlaying);
    v.play()?.catch((err) => {
      // Sin permiso para sonar: en silencio, con botón para activar el sonido (AbortError = se cerró antes).
      if (err?.name !== 'NotAllowedError') return;
      v.muted = true;
      setMuted(true);
      v.play()?.catch(() => onDoneRef.current?.());
    });
    const onKey = (e) => {
      if (e.key === 'Escape') onDoneRef.current?.();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(timer);
      v.removeEventListener('playing', onPlaying);
      v.removeEventListener('ended', done);
      v.removeEventListener('error', done);
      v.removeEventListener('timeupdate', onTime);
      v.pause();
      v.remove();
      document.removeEventListener('keydown', onKey);
      unlock();
    };
  }, []);

  const unmute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = false;
    v.volume = 1;
    setMuted(false);
  };

  return (
    <m.div
      role="dialog"
      aria-modal="true"
      aria-label="Video de la Fiesta de Disfraces"
      className="fixed inset-0 z-[85] flex items-center justify-center bg-black"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.6 } }}
    >
      <div ref={boxRef} className="h-full w-full" />

      <div className="absolute inset-x-0 top-0 flex items-center justify-end gap-2 px-4 pt-[max(1rem,env(safe-area-inset-top))]">
        {muted && (
          <button
            type="button"
            onClick={unmute}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-pumpkin/60 bg-black/60 px-4 text-xs font-semibold uppercase tracking-[0.18em] text-bone backdrop-blur"
          >
            <Volume2 className="h-4 w-4" /> Activar sonido
          </button>
        )}
        <button
          type="button"
          onClick={() => onDoneRef.current?.()}
          className="inline-flex h-10 items-center gap-1.5 rounded-full border border-white/20 bg-black/60 px-4 text-xs font-semibold uppercase tracking-[0.22em] text-bone backdrop-blur transition hover:border-white/40"
        >
          Saltar <X className="h-4 w-4" />
        </button>
      </div>

      <div className="absolute inset-x-0 bottom-0 h-[3px] bg-white/10" aria-hidden="true">
        <div className="h-full origin-left bg-pumpkin" style={{ transform: `scaleX(${progress})` }} />
      </div>
    </m.div>
  );
}
