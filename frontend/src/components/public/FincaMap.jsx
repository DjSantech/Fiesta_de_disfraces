import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import {
  ArrowRight,
  Ban,
  Bath,
  BedDouble,
  Car,
  CookingPot,
  DoorOpen,
  HardHat,
  House,
  Motorbike,
  MousePointerClick,
  Sofa,
  SquareParking,
  Users,
  Waves,
  Disc3,
  Droplets,
} from 'lucide-react';
import { MAP_ZONES } from '../../config/event';
import { formatCOP } from '../../lib/format';
import { ROOM_STATUS, RoomHelpNote, RoomPriceLine, RoomStatusBadge, RoomThumb, RoomViewModal, roomPeopleText } from './rooms';

// Plano nocturno de la finca, fiel al boceto (docs/mapa-boceto.png):
// Entrada arriba al centro → Parqueadero debajo; Salón arriba a la izquierda; Jacuzzi bajo el Salón;
// Piscina grande abajo a la izquierda; la Casa a la derecha con la fila [X][1][2][X][3], Baño bajo la
// primera X, baño privado junto a la 3, y Sala + Cocina adentro.

const W = 400;
const H = 480;

const BONE = '#f2ede4';
const RED = '#ff4d5e';

/** Zonas tocables. `room` enlaza con config.rooms[].number. */
const ZONES = [
  { id: 'entrada', info: 'entrada', shape: { t: 'rect', x: 176, y: 6, w: 84, h: 50, rx: 12 }, hit: true },
  { id: 'parqueadero', info: 'parqueadero', shape: { t: 'rect', x: 158, y: 68, w: 150, h: 72, rx: 6 } },
  { id: 'salon', info: 'salon', shape: { t: 'rect', x: 22, y: 64, w: 118, h: 74, rx: 4 } },
  { id: 'jacuzzi', info: 'jacuzzi', shape: { t: 'circle', cx: 80, cy: 178, r: 24 }, water: true },
  { id: 'piscina', info: 'piscina', shape: { t: 'circle', cx: 86, cy: 318, r: 70 }, water: true },
  { id: 'casa', info: 'casa', shape: { t: 'rect', x: 238, y: 176, w: 80, h: 18, rx: 4 }, hit: true },
  { id: 'x1', info: 'noDisponible', shape: { t: 'rect', x: 172, y: 196, w: 34, h: 54 }, blocked: true },
  { id: 'room1', info: 'room1', room: 1, shape: { t: 'rect', x: 206, y: 196, w: 42, h: 54 } },
  { id: 'room2', info: 'room2', room: 2, shape: { t: 'rect', x: 248, y: 196, w: 42, h: 54 } },
  { id: 'x2', info: 'noDisponible', shape: { t: 'rect', x: 290, y: 196, w: 34, h: 54 }, blocked: true },
  { id: 'room3', info: 'room3', room: 3, shape: { t: 'rect', x: 324, y: 196, w: 60, h: 54 } },
  { id: 'bano3', info: 'bano3', shape: { t: 'rect', x: 344, y: 250, w: 40, h: 32 } },
  { id: 'bano', info: 'bano', shape: { t: 'rect', x: 172, y: 250, w: 40, h: 32 } },
  { id: 'sala', info: 'sala', shape: { t: 'rect', x: 172, y: 282, w: 106, h: 110 } },
  { id: 'cocina', info: 'cocina', shape: { t: 'rect', x: 278, y: 282, w: 106, h: 110 } },
];

const ZONE_ICONS = {
  entrada: DoorOpen,
  parqueadero: SquareParking,
  salon: Disc3,
  jacuzzi: Droplets,
  piscina: Waves,
  casa: House,
  noDisponible: Ban,
  room1: BedDouble,
  room2: BedDouble,
  room3: BedDouble,
  bano3: Bath,
  bano: Bath,
  sala: Sofa,
  cocina: CookingPot,
};

function Shape({ shape, ...props }) {
  if (shape.t === 'circle') return <circle cx={shape.cx} cy={shape.cy} r={shape.r} {...props} />;
  return <rect x={shape.x} y={shape.y} width={shape.w} height={shape.h} rx={shape.rx || 0} {...props} />;
}

function center(shape) {
  if (shape.t === 'circle') return { x: shape.cx, y: shape.cy };
  return { x: shape.x + shape.w / 2, y: shape.y + shape.h / 2 };
}

function roomAriaLabel(name, room, known) {
  if (!room) return name;
  const status = known ? (ROOM_STATUS[room.status] || ROOM_STATUS.blocked).label : 'consultando disponibilidad';
  return `${name}: ${room.beds ? `${room.beds}, ` : ''}${roomPeopleText(room).toLowerCase()}, ${formatCOP(room.currentPrice ?? room.price)}, ${status}`;
}

function statusColor(room, known) {
  if (!room || !known) return 'rgb(242 237 228 / 0.35)';
  return (ROOM_STATUS[room.status] || ROOM_STATUS.blocked).color;
}

export default function FincaMap({ config, known = true, className }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const [selected, setSelected] = useState(null);
  const panelRef = useRef(null);
  const firstSelect = useRef(true);
  const roomsByNumber = useMemo(() => Object.fromEntries((config.rooms || []).map((r) => [r.number, r])), [config.rooms]);

  const select = (id) => setSelected((cur) => (cur === id ? cur : id));

  // En celular, si el panel quedó fuera de pantalla, lo acerca suavemente.
  useEffect(() => {
    if (!selected) return;
    if (firstSelect.current) firstSelect.current = false;
    const el = panelRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.top > window.innerHeight - 120) {
      el.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' });
    }
  }, [selected]);

  const zone = ZONES.find((z) => z.id === selected) || null;

  return (
    <div className={clsx('grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:items-start lg:gap-8', className)}>
      <div className="fd-blueprint noise-border relative overflow-hidden rounded-[28px] p-2 sm:p-4">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_50%_at_50%_0%,rgb(225_29_46/0.12),transparent_70%)]" aria-hidden="true" />
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="relative block h-auto w-full select-none"
          role="group"
          aria-label="Mapa de la finca. Toca o selecciona una zona para ver su información."
        >
          <defs>
            <pattern id={`hatch-${uid}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="6" stroke="rgb(242 237 228 / 0.13)" strokeWidth="2" />
            </pattern>
            <radialGradient id={`water-${uid}`} cx="50%" cy="45%" r="60%">
              <stop offset="0%" stopColor="rgb(139 92 246 / 0.30)" />
              <stop offset="70%" stopColor="rgb(139 92 246 / 0.10)" />
              <stop offset="100%" stopColor="rgb(139 92 246 / 0.04)" />
            </radialGradient>
            <linearGradient id={`floor-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgb(242 237 228 / 0.035)" />
              <stop offset="100%" stopColor="rgb(242 237 228 / 0.01)" />
            </linearGradient>
          </defs>

          {/* Lindero de la finca con la portada de entrada */}
          <g aria-hidden="true" fill="none">
            <path
              d="M196 40 H26 Q8 40 8 58 V454 Q8 472 26 472 H374 Q392 472 392 454 V58 Q392 40 374 40 H240"
              stroke="rgb(242 237 228 / 0.16)"
              strokeWidth="1.2"
              strokeDasharray="5 5"
            />
            <rect x="190" y="34" width="6" height="12" fill="rgb(242 237 228 / 0.5)" />
            <rect x="240" y="34" width="6" height="12" fill="rgb(242 237 228 / 0.5)" />
            {/* Camino principal: entrada → parqueadero → casa */}
            <path d="M218 22 V68" stroke={RED} strokeOpacity="0.85" strokeWidth="1.6" strokeDasharray="3 5" className="fd-dash-flow" />
            <path d="M233 140 V166 H160 V340 H172" stroke="rgb(242 237 228 / 0.22)" strokeWidth="1.2" strokeDasharray="3 5" />
            <path d="M160 166 H140 V138" stroke="rgb(242 237 228 / 0.22)" strokeWidth="1.2" strokeDasharray="3 5" />
            <circle cx="218" cy="14" r="2.5" fill={RED} />
            <circle cx="218" cy="14" r="2.5" fill={RED} className="fd-pulse-dot" />
          </g>

          {/* Árboles y detalles de paisaje */}
          <g aria-hidden="true" fill="none" stroke="rgb(34 229 132 / 0.22)" strokeWidth="1">
            {[
              [36, 420, 11],
              [64, 446, 8],
              [104, 428, 13],
              [140, 452, 7],
              [356, 128, 10],
              [374, 156, 7],
              [30, 222, 7],
              [338, 452, 8],
              [300, 446, 6],
            ].map(([x, y, r]) => (
              <g key={`${x}-${y}`}>
                <circle cx={x} cy={y} r={r} />
                <path d={`M${x - r * 0.45} ${y} H${x + r * 0.45} M${x} ${y - r * 0.45} V${y + r * 0.45}`} strokeOpacity="0.6" />
              </g>
            ))}
          </g>

          {/* Rosa de los vientos */}
          <g aria-hidden="true" transform="translate(354 82)">
            <circle r="15" fill="none" stroke="rgb(242 237 228 / 0.2)" />
            <path d="M0 -12 L4 2 L0 -1 L-4 2 Z" fill={RED} />
            <path d="M0 12 L4 -2 L0 1 L-4 -2 Z" fill="rgb(242 237 228 / 0.3)" />
            <text y="-19" textAnchor="middle" fontSize="8" fontFamily="Inter, sans-serif" fontWeight="700" fill="rgb(242 237 228 / 0.55)">
              N
            </text>
          </g>

          {/* Estructura de la casa */}
          <g aria-hidden="true">
            <rect x="172" y="196" width="212" height="196" fill={`url(#floor-${uid})`} stroke="rgb(242 237 228 / 0.55)" strokeWidth="1.6" />
            {/* Pasillo */}
            <path d="M212 266 H344" stroke="rgb(242 237 228 / 0.1)" strokeDasharray="2 4" />
            {/* Puerta de la casa (lado de la piscina) */}
            <path d="M172 330 V352" stroke="#08080d" strokeWidth="3" />
            <path d="M172 330 A 22 22 0 0 0 150 352" fill="none" stroke="rgb(242 237 228 / 0.25)" strokeWidth="0.8" />
            {/* Puertas de las habitaciones al pasillo */}
            {[
              [210, 250],
              [252, 250],
              [328, 250],
            ].map(([x, y]) => (
              <path key={x} d={`M${x} ${y} A 11 11 0 0 0 ${x + 11} ${y + 11}`} fill="none" stroke="rgb(242 237 228 / 0.25)" strokeWidth="0.8" />
            ))}
            {/* Muebles: sala */}
            <rect x="186" y="352" width="54" height="16" rx="5" fill="none" stroke="rgb(242 237 228 / 0.16)" />
            <rect x="200" y="330" width="26" height="12" rx="2" fill="none" stroke="rgb(242 237 228 / 0.12)" />
            {/* Muebles: cocina */}
            <path d="M292 372 H372 V300" fill="none" stroke="rgb(242 237 228 / 0.16)" strokeWidth="6" strokeOpacity="0.5" />
            <circle cx="352" cy="372" r="3" fill="none" stroke="rgb(242 237 228 / 0.25)" />
            <circle cx="338" cy="372" r="3" fill="none" stroke="rgb(242 237 228 / 0.25)" />
            {/* División sala / cocina */}
            <path d="M278 296 V378" stroke="rgb(242 237 228 / 0.18)" strokeDasharray="4 4" />
          </g>

          {/* Zonas interactivas */}
          {ZONES.map((z) => {
            const info = MAP_ZONES[z.info] || { name: z.id };
            const room = z.room ? roomsByNumber[z.room] : null;
            const isSel = selected === z.id;
            const c = center(z.shape);
            const label = room ? roomAriaLabel(room.name || info.name, room, known) : info.name;
            const onKeyDown = (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                select(z.id);
              }
            };

            let fill = 'transparent';
            if (z.water) fill = `url(#water-${uid})`;
            if (z.blocked) fill = `url(#hatch-${uid})`;
            if (room && known) fill = `${statusColor(room, known)}14`;
            if (isSel) fill = 'rgb(225 29 46 / 0.2)';

            const baseStroke = z.hit
              ? 'transparent'
              : z.water
                ? 'rgb(167 139 250 / 0.75)'
                : z.id === 'parqueadero' || z.id === 'salon'
                  ? 'rgb(242 237 228 / 0.55)'
                  : 'rgb(242 237 228 / 0.38)';

            return (
              <g
                key={z.id}
                className="fd-zone"
                role="button"
                tabIndex={0}
                aria-label={label}
                aria-pressed={isSel}
                onClick={() => select(z.id)}
                onKeyDown={onKeyDown}
              >
                {/* Halo de neón cuando está seleccionada */}
                {isSel && !z.hit && <Shape shape={z.shape} fill="none" stroke={RED} strokeOpacity="0.28" strokeWidth="7" />}
                {z.water && !isSel && <Shape shape={z.shape} fill="none" stroke="rgb(139 92 246 / 0.25)" strokeWidth="5" />}
                <Shape
                  shape={z.shape}
                  className="fd-zone-shape"
                  fill={fill}
                  stroke={isSel ? RED : baseStroke}
                  strokeOpacity={isSel ? 1 : 0.9}
                  strokeWidth={isSel ? 1.8 : z.water ? 1.4 : 1.1}
                  pointerEvents="all"
                />
                <Shape
                  shape={{ ...z.shape, ...(z.shape.t === 'circle' ? { r: z.shape.r + 4 } : { x: z.shape.x - 3, y: z.shape.y - 3, w: z.shape.w + 6, h: z.shape.h + 6, rx: (z.shape.rx || 0) + 3 }) }}
                  className="fd-zone-focus"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                  strokeDasharray="4 3"
                />

                {/* Rótulos */}
                {z.id === 'entrada' && (
                  <text x={218} y={30} textAnchor="middle" className="fd-zone-label" fontSize="11" fontFamily="Inter, sans-serif" fontWeight="700" letterSpacing="2.2" fill={isSel ? '#fff' : BONE}>
                    ENTRADA
                  </text>
                )}
                {z.id === 'parqueadero' && (
                  <g pointerEvents="none">
                    {Array.from({ length: 8 }, (_, i) => (
                      <path key={i} d={`M${158 + 18.75 * (i + 1)} 68 v20 M${158 + 18.75 * (i + 1)} 140 v-20`} stroke="rgb(242 237 228 / 0.2)" />
                    ))}
                    <path d="M166 104 H300" stroke="rgb(245 192 74 / 0.35)" strokeDasharray="6 5" />
                    <text x={233} y={108} textAnchor="middle" className="fd-zone-label" fontSize="11" fontFamily="Inter, sans-serif" fontWeight="700" letterSpacing="1.6" fill={isSel ? '#fff' : BONE}>
                      PARQUEADERO
                    </text>
                  </g>
                )}
                {z.id === 'salon' && (
                  <g pointerEvents="none">
                    <text x={81} y={96} textAnchor="middle" className="fd-zone-label" fontSize="15" fontFamily="Anton, Impact, sans-serif" letterSpacing="1.5" fill={isSel ? '#fff' : BONE}>
                      SALÓN
                    </text>
                    <text x={81} y={110} textAnchor="middle" fontSize="7.5" fontFamily="Inter, sans-serif" fontWeight="600" letterSpacing="1.2" fill="rgb(255 122 26 / 0.85)">
                      DJS · PISTA
                    </text>
                    {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                      <rect
                        key={i}
                        x={57 + i * 6.4}
                        y={116}
                        width={3.4}
                        height={14}
                        rx={1}
                        fill={i % 3 === 0 ? RED : i % 3 === 1 ? '#ff7a1a' : '#8b5cf6'}
                        fillOpacity="0.75"
                        className="fd-eq-bar"
                        style={{ animationDelay: `${(i * 137) % 900}ms`, animationDuration: `${700 + ((i * 211) % 500)}ms` }}
                      />
                    ))}
                  </g>
                )}
                {z.id === 'jacuzzi' && (
                  <g pointerEvents="none">
                    <circle cx={80} cy={178} r={14} fill="none" stroke="rgb(167 139 250 / 0.6)" className="fd-ripple" />
                    <text x={110} y={182} className="fd-zone-label" fontSize="10.5" fontFamily="Inter, sans-serif" fontWeight="700" letterSpacing="1.4" fill={isSel ? '#fff' : BONE}>
                      PISCINA PEQUEÑA
                    </text>
                  </g>
                )}
                {z.id === 'piscina' && (
                  <g pointerEvents="none">
                    <circle cx={86} cy={318} r={52} fill="none" stroke="rgb(167 139 250 / 0.5)" className="fd-ripple" />
                    <circle cx={86} cy={318} r={52} fill="none" stroke="rgb(167 139 250 / 0.5)" className="fd-ripple" style={{ animationDelay: '-2.7s' }} />
                    <text x={86} y={323} textAnchor="middle" className="fd-zone-label" fontSize="16" fontFamily="Anton, Impact, sans-serif" letterSpacing="2" fill={isSel ? '#fff' : BONE}>
                      PISCINA
                    </text>
                  </g>
                )}
                {z.id === 'casa' && (
                  <text x={278} y={189} textAnchor="middle" className="fd-zone-label" fontSize="10" fontFamily="Inter, sans-serif" fontWeight="700" letterSpacing="2.4" fill={isSel ? '#fff' : 'rgb(242 237 228 / 0.7)'}>
                    LA CASA
                  </text>
                )}
                {z.blocked && (
                  <text x={c.x} y={c.y + 6} textAnchor="middle" fontSize="18" fontFamily="Inter, sans-serif" fontWeight="300" fill={isSel ? '#fff' : 'rgb(242 237 228 / 0.4)'} pointerEvents="none">
                    ×
                  </text>
                )}
                {z.room && (
                  <g pointerEvents="none">
                    <text x={c.x} y={c.y + 8} textAnchor="middle" className="fd-zone-label" fontSize="22" fontFamily="Anton, Impact, sans-serif" fill={isSel ? '#fff' : BONE}>
                      {z.room}
                    </text>
                    {known && room?.status === 'available' && (
                      <circle cx={z.shape.x + z.shape.w - 7} cy={z.shape.y + 7} r={2.6} fill={statusColor(room, known)} className="fd-pulse-dot" />
                    )}
                    <circle cx={z.shape.x + z.shape.w - 7} cy={z.shape.y + 7} r={2.6} fill={statusColor(room, known)} />
                  </g>
                )}
                {(z.id === 'bano' || z.id === 'bano3') && (
                  <text x={c.x} y={c.y + 3.5} textAnchor="middle" className="fd-zone-label" fontSize="9.5" fontFamily="Inter, sans-serif" fontWeight="700" letterSpacing="0.6" fill={isSel ? '#fff' : 'rgb(242 237 228 / 0.8)'} pointerEvents="none">
                    BAÑO
                  </text>
                )}
                {(z.id === 'sala' || z.id === 'cocina') && (
                  <text x={c.x} y={z.shape.y + 40} textAnchor="middle" className="fd-zone-label" fontSize="13" fontFamily="Inter, sans-serif" fontWeight="700" letterSpacing="1.8" fill={isSel ? '#fff' : BONE} pointerEvents="none">
                    {z.id === 'sala' ? 'SALA' : 'COCINA'}
                  </text>
                )}
              </g>
            );
          })}

          {/* Puerta entre la habitación 3 y su baño privado */}
          <g aria-hidden="true" pointerEvents="none">
            <path d="M352 250 H368" stroke="#08080d" strokeWidth="2.4" />
            <path d="M352 250 A 16 16 0 0 0 368 266" fill="none" stroke="rgb(242 237 228 / 0.3)" strokeWidth="0.8" />
          </g>

          {/* Cajetín del plano */}
          <g aria-hidden="true" fontFamily="Inter, sans-serif">
            <rect x="172" y="408" width="212" height="52" fill="rgb(7 7 10 / 0.6)" stroke="rgb(242 237 228 / 0.25)" />
            <path d="M172 428 H384 M300 428 V460" stroke="rgb(242 237 228 / 0.18)" />
            <text x="180" y="422" fontSize="10" fontFamily="Anton, Impact, sans-serif" letterSpacing="1.4" fill={BONE}>
              FINCA · PEREIRA · PLANO DE LA NOCHE
            </text>
            <text x="180" y="442" fontSize="7.5" fontWeight="600" letterSpacing="1" fill="rgb(242 237 228 / 0.6)">
              FIESTA DE DISFRACES
            </text>
            <text x="180" y="453" fontSize="7.5" fontWeight="600" letterSpacing="1" fill="rgb(255 77 94 / 0.85)">
              31 · 10 · 2026
            </text>
            <text x="342" y="442" textAnchor="middle" fontSize="7.5" fontWeight="600" letterSpacing="1" fill="rgb(242 237 228 / 0.6)">
              SIN ESCALA
            </text>
            <text x="342" y="453" textAnchor="middle" fontSize="7.5" fontWeight="600" letterSpacing="1" fill="rgb(242 237 228 / 0.45)">
              HOJA 01
            </text>
          </g>
        </svg>
      </div>

      <div ref={panelRef} className="lg:sticky lg:top-24">
        <ZonePanel zone={zone} config={config} roomsByNumber={roomsByNumber} known={known} />
        <Legend />
      </div>
    </div>
  );
}

function Legend() {
  const items = [
    { color: ROOM_STATUS.available.color, label: 'Disponible' },
    { color: ROOM_STATUS.held.color, label: 'Apartada' },
    { color: ROOM_STATUS.booked.color, label: 'Reservada' },
  ];
  return (
    <ul className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-fog" aria-label="Convenciones del mapa">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: i.color }} aria-hidden="true" />
          {i.label}
        </li>
      ))}
      <li className="flex items-center gap-2">
        <span className="text-base leading-none text-fog/80" aria-hidden="true">
          ×
        </span>
        No se alquila
      </li>
    </ul>
  );
}

function ZonePanel({ zone, config, roomsByNumber, known }) {
  if (!zone) {
    return (
      <div className="rounded-3xl border border-white/[0.08] bg-crypt/70 p-6" aria-live="polite">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-blood-light">
          <MousePointerClick className="h-5 w-5" strokeWidth={1.6} />
        </span>
        <h3 className="mt-5 font-display text-3xl uppercase leading-none text-bone">Toca una zona</h3>
        <p className="mt-3 text-[15px] leading-relaxed text-fog">
          Explora la finca: el salón con los DJs, las piscinas y la casa con las habitaciones en alquiler, con su disponibilidad en vivo.
        </p>
      </div>
    );
  }

  const info = MAP_ZONES[zone.info] || { name: zone.id, description: '' };
  const Icon = ZONE_ICONS[zone.info] || House;
  const room = zone.room ? roomsByNumber[zone.room] : null;
  const salesOpen = config.event?.salesOpen !== false;
  const parking = config.parking || {};
  const phase = config.event?.phase;
  const [viewing, setViewing] = useState(false);

  return (
    <div className="animate-fade-up rounded-3xl border border-blood/30 bg-[linear-gradient(160deg,rgb(225_29_46/0.12),rgb(21_21_28/0.9)_50%)] p-6" aria-live="polite" key={zone.id}>
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-blood/35 bg-blood/12 text-blood-light">
          <Icon className="h-5 w-5" strokeWidth={1.6} />
        </span>
        {room && <RoomStatusBadge status={room.status} known={known} />}
      </div>
      <h3 className="mt-5 font-display text-[2.1rem] uppercase leading-none text-bone">{room?.name || info.name}</h3>
      {info.description && <p className="mt-3 text-[15px] leading-relaxed text-fog">{info.description}</p>}

      {zone.id === 'parqueadero' && (
        <ul className="mt-5 grid grid-cols-3 gap-2">
          {[
            { icon: Car, label: 'Carro', value: parking.carro },
            { icon: Motorbike, label: 'Moto', value: parking.moto },
            { icon: HardHat, label: 'Casco', value: parking.casco },
          ].map(({ icon: I, label, value }) => (
            <li key={label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-center">
              <I className="mx-auto h-5 w-5 text-gold" strokeWidth={1.6} />
              <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-fog">{label}</p>
              <p className="mt-0.5 font-display text-xl text-bone">{formatCOP(value)}</p>
            </li>
          ))}
        </ul>
      )}

      {room && (
        <>
          <RoomThumb number={room.number} className="mt-5 h-36 w-full rounded-2xl border border-white/10" />
          <dl className="mt-4 grid grid-cols-1 gap-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-fog">
                <Users className="h-3.5 w-3.5" /> Camas y personas
              </dt>
              <dd className="mt-1 text-sm text-bone">
                {room.beds ? `${room.beds} · ` : ''}
                <span className="font-semibold">{roomPeopleText(room)}</span>
              </dd>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fog">Precio</dt>
              <dd className="mt-1">
                <RoomPriceLine room={room} phase={phase} size="sm" />
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-fog">
            Incluye la entrada de todo el grupo{room.privateBathroom ? ' · baño privado' : ''} · se alquila completa, no por cama.
          </p>
          <button
            type="button"
            onClick={() => setViewing(true)}
            className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.04] text-sm font-semibold uppercase tracking-[0.1em] text-bone transition hover:bg-white/[0.08]"
          >
            Ver habitación
          </button>
          <RoomHelpNote contact={config.contact} room={room} className="mt-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3" />
          <RoomViewModal
            room={room}
            phase={phase}
            contact={config.contact}
            open={viewing}
            onClose={() => setViewing(false)}
            buyTo={salesOpen && room.status === 'available' ? `/comprar?tipo=habitacion&hab=${room.number}` : null}
          />
          <div className="mt-3">
            {salesOpen && (room.status === 'available' || !known) ? (
              <Link
                to={`/comprar?tipo=habitacion&hab=${room.number}`}
                className="flex h-13 items-center justify-center gap-2 rounded-2xl bg-blood font-semibold text-white shadow-[0_0_30px_-8px_rgb(225_29_46/0.9)] transition hover:bg-blood-light"
              >
                Reservar {room.name || `Habitación ${room.number}`}
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <p className="flex h-13 items-center justify-center rounded-2xl border border-dashed border-white/12 text-sm font-semibold text-fog">
                {salesOpen ? (ROOM_STATUS[room.status] || ROOM_STATUS.blocked).label : 'Ventas en línea cerradas'}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
