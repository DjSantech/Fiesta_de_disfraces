import { useEffect, useRef, useState } from 'react';
import QrScanner from 'qr-scanner';
import clsx from 'clsx';
import { Camera, CameraOff, Flashlight, FlashlightOff, Lock, RefreshCw, ShieldAlert, SwitchCamera } from 'lucide-react';
import { Button, Spinner } from '../../ui';

const ERRORS = {
  insecure: { icon: Lock, title: 'La cámara necesita HTTPS', text: 'Abre la portería con https:// (o en localhost). En pruebas por red local usa npm run dev:lan.' },
  unsupported: { icon: CameraOff, title: 'Este navegador no usa la cámara', text: 'Abre la portería en Chrome (Android) o Safari (iPhone) actualizados.' },
  denied: {
    icon: ShieldAlert,
    title: 'Permiso de cámara bloqueado',
    text: 'Android: candado junto a la dirección → Permisos → Cámara → Permitir. iPhone: Ajustes → Safari → Cámara → Permitir. Luego toca Reintentar.',
    retry: 'Reintentar',
  },
  prompt: { icon: Camera, title: 'Falta el permiso de la cámara', text: 'Toca el botón y acepta el aviso del navegador.', retry: 'Permitir cámara' },
  notfound: { icon: CameraOff, title: 'No encontramos una cámara', text: 'Escribe el código o busca a la persona abajo.', retry: 'Reintentar' },
  busy: { icon: CameraOff, title: 'La cámara está ocupada', text: 'Cierra otras apps o pestañas que la usen y reintenta.', retry: 'Reintentar' },
  generic: { icon: CameraOff, title: 'No se pudo abrir la cámara', text: 'Reintenta. Si sigue fallando, recarga la página.', retry: 'Reintentar' },
};

// qr-scanner oculta el motivo real ("Camera not found."): lo averiguamos aparte.
async function diagnose() {
  if (!window.isSecureContext) return 'insecure';
  if (!navigator.mediaDevices?.getUserMedia) return 'unsupported';
  let permission = null;
  try {
    permission = (await navigator.permissions?.query({ name: 'camera' }))?.state ?? null;
  } catch {
    permission = null;
  }
  if (permission === 'denied') return 'denied';
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    if (!devices.some((d) => d.kind === 'videoinput')) return 'notfound';
  } catch {
    /* seguir */
  }
  if (permission === 'prompt') return 'prompt';
  try {
    const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    s.getTracks().forEach((t) => t.stop());
    return 'generic';
  } catch (e) {
    if (['NotAllowedError', 'SecurityError'].includes(e?.name)) return 'denied';
    if (['NotFoundError', 'OverconstrainedError'].includes(e?.name)) return 'notfound';
    if (['NotReadableError', 'AbortError'].includes(e?.name)) return 'busy';
    return 'generic';
  }
}

function RoundButton({ onClick, label, active, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={clsx(
        'flex h-12 w-12 items-center justify-center rounded-full border backdrop-blur transition',
        active ? 'border-gold bg-gold text-ink' : 'border-white/20 bg-black/50 text-white hover:bg-black/70',
      )}
    >
      {children}
    </button>
  );
}

/**
 * Visor de cámara con qr-scanner. El <video> y el overlay se crean fuera de React
 * (qr-scanner manipula el DOM y detiene el stream con retraso al destruirse).
 */
export default function QrCamera({ paused = false, onScan, className, children }) {
  const hostRef = useRef(null);
  const scannerRef = useRef(null);
  const videoRef = useRef(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const failedRef = useRef(false);
  const attemptRef = useRef(0);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState('starting');
  const [errorKind, setErrorKind] = useState(null);
  const [flash, setFlash] = useState({ available: false, on: false });
  const [cameras, setCameras] = useState([]);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setStatus('error');
      setErrorKind(!window.isSecureContext ? 'insecure' : 'unsupported');
      return undefined;
    }
    const host = hostRef.current;
    const video = document.createElement('video');
    video.className = 'absolute inset-0 h-full w-full object-cover';
    video.setAttribute('playsinline', '');
    video.muted = true;
    const overlay = document.createElement('div');
    overlay.className = 'rounded-[26px] border-[3px] border-white/90 shadow-[0_0_0_200vmax_rgb(0_0_0/0.42)]';
    host.append(video, overlay);
    const scanner = new QrScanner(
      video,
      (res) => {
        if (!pausedRef.current) onScanRef.current?.(res.data);
      },
      {
        preferredCamera: 'environment',
        maxScansPerSecond: 5,
        highlightScanRegion: true,
        highlightCodeOutline: true,
        overlay,
        returnDetailedScanResult: true,
        onDecodeError: () => {},
      },
    );
    const outline = overlay.querySelector('.code-outline-highlight');
    if (outline) {
      outline.style.stroke = '#22e584';
      outline.style.strokeDasharray = 'none';
    }
    scannerRef.current = scanner;
    videoRef.current = video;
    setReady(true);
    return () => {
      scannerRef.current = null;
      setReady(false);
      scanner.destroy();
      video.remove();
      overlay.remove();
    };
  }, []);

  useEffect(() => {
    const scanner = scannerRef.current;
    if (!ready || !scanner) return undefined;
    if (paused) {
      scanner.stop();
      return undefined;
    }
    // En error solo se reintenta a mano (evita pedir permiso a cada rato).
    if (failedRef.current && attemptRef.current === attempt) return undefined;
    attemptRef.current = attempt;
    failedRef.current = false;
    let cancelled = false;
    setStatus((s) => (s === 'running' ? s : 'starting'));
    scanner
      .start()
      .then(async () => {
        if (cancelled) return;
        setStatus('running');
        try {
          const has = await scanner.hasFlash();
          if (!cancelled) setFlash({ available: has, on: scanner.isFlashOn() });
        } catch {
          /* sin linterna */
        }
        try {
          const list = await QrScanner.listCameras(true);
          if (!cancelled) setCameras(list);
        } catch {
          /* una sola cámara */
        }
      })
      .catch(async () => {
        if (cancelled) return;
        failedRef.current = true;
        const kind = await diagnose();
        if (!cancelled) {
          setErrorKind(kind);
          setStatus('error');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [ready, paused, attempt]);

  const toggleFlash = async () => {
    const s = scannerRef.current;
    if (!s) return;
    try {
      await s.toggleFlash();
      setFlash({ available: true, on: s.isFlashOn() });
    } catch {
      setFlash({ available: false, on: false });
    }
  };

  const switchCamera = async () => {
    const s = scannerRef.current;
    if (!s || cameras.length < 2) return;
    const currentId = videoRef.current?.srcObject?.getVideoTracks?.()[0]?.getSettings?.().deviceId;
    const idx = cameras.findIndex((c) => c.id === currentId);
    const next = cameras[(idx + 1) % cameras.length];
    try {
      await s.setCamera(next.id);
      setFlash({ available: await s.hasFlash(), on: s.isFlashOn() });
    } catch {
      /* se queda la actual */
    }
  };

  const err = ERRORS[errorKind] || ERRORS.generic;
  const ErrIcon = err.icon;

  return (
    <div className={clsx('relative flex aspect-square flex-col justify-center rounded-3xl border border-white/10 bg-black', className)}>
      <div ref={hostRef} className="absolute inset-0 overflow-hidden rounded-[inherit]" />
      {status === 'starting' && !paused && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-[inherit] bg-black/70 px-6 text-center">
          <Spinner className="h-8 w-8 text-toxic" />
          <p className="font-semibold text-bone">Abriendo cámara…</p>
          <p className="text-sm text-fog">Si el navegador pregunta, toca Permitir.</p>
        </div>
      )}
      {status === 'error' && (
        <div className="relative flex flex-col items-center gap-3 px-6 py-8 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gold/15 text-gold">
            <ErrIcon className="h-7 w-7" />
          </span>
          <p className="text-lg font-bold text-bone">{err.title}</p>
          <p className="max-w-sm text-sm leading-relaxed text-fog">{err.text}</p>
          {err.retry && (
            <Button size="lg" variant="secondary" onClick={() => setAttempt((a) => a + 1)}>
              <RefreshCw className="h-4 w-4" />
              {err.retry}
            </Button>
          )}
        </div>
      )}
      {status === 'running' && (
        <>
          <div className="absolute right-3 top-3 flex gap-2">
            {cameras.length > 1 && (
              <RoundButton onClick={switchCamera} label="Cambiar cámara">
                <SwitchCamera className="h-5 w-5" />
              </RoundButton>
            )}
            {flash.available && (
              <RoundButton onClick={toggleFlash} active={flash.on} label={flash.on ? 'Apagar linterna' : 'Encender linterna'}>
                {flash.on ? <FlashlightOff className="h-5 w-5" /> : <Flashlight className="h-5 w-5" />}
              </RoundButton>
            )}
          </div>
          {!paused && (
            <p className="pointer-events-none absolute inset-x-0 bottom-4 text-center text-sm font-semibold text-white drop-shadow-[0_1px_4px_rgb(0_0_0/0.9)]">
              Apunta al código QR
            </p>
          )}
        </>
      )}
      {children}
    </div>
  );
}
