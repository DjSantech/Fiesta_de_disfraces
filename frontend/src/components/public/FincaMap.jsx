import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import {
  ArrowRight,
  Bath,
  BedDouble,
  Car,
  Disc3,
  Droplets,
  Gamepad2,
  HardHat,
  House,
  Martini,
  Motorbike,
  MousePointerClick,
  Sofa,
  SquareParking,
  Users,
  Utensils,
  Waves,
} from 'lucide-react';
import { MAP_ZONES } from '../../config/event';
import { formatCOP } from '../../lib/format';
import { ROOM_STATUS, RoomHelpNote, RoomPriceLine, RoomStatusBadge, RoomThumb, RoomViewModal, roomPeopleText } from './rooms';

// Plano nocturno de la finca, fiel al boceto del organizador (docs/mapa-finca-v3.png), recompuesto en vertical
// para celular conservando las adyacencias: [Barra de cócteles | DJ] sobre [Salón de juegos | Jacuzzi], la Piscina
// al lado, el Parqueadero pegado a la casa y la Casa con sus dos filas (1·2·baño·3 / comedor·baño·4) y la sala al centro.

const W = 400;
const H = 556;

const BONE = '#f2ede4';
const RED = '#ff8a3d';

/** Zonas tocables. `id` es la clave en MAP_ZONES; `room` enlaza con config.rooms[].number. */
const ZONES = [
  { id: 'barraCocteles', shape: { t: 'rect', x: 16, y: 20, w: 84, h: 64, rx: 6 } },
  { id: 'dj', shape: { t: 'rect', x: 100, y: 20, w: 150, h: 64, rx: 6 } },
  { id: 'salonJuegos', shape: { t: 'rect', x: 16, y: 92, w: 112, h: 68, rx: 6 } },
  { id: 'jacuzzi', shape: { t: 'rect', x: 128, y: 92, w: 122, h: 68, rx: 6 }, water: true },
  { id: 'piscina', shape: { t: 'circle', cx: 323, cy: 118, r: 50 }, water: true },
  { id: 'parqueadero', shape: { t: 'rect', x: 16, y: 176, w: 234, h: 56, rx: 4 } },
  { id: 'casa', shape: { t: 'rect', x: 138, y: 241, w: 124, h: 19, rx: 9.5 } },
  // Fila superior de la casa
  { id: 'room1', room: 1, shape: { t: 'rect', x: 24, y: 260, w: 92, h: 74 } },
  { id: 'room2', room: 2, shape: { t: 'rect', x: 116, y: 260, w: 88, h: 74 } },
  { id: 'bano', shape: { t: 'rect', x: 204, y: 260, w: 46, h: 74 } },
  { id: 'room3', room: 3, shape: { t: 'rect', x: 250, y: 260, w: 126, h: 74 } },
  // Sala al centro
  { id: 'sala', shape: { t: 'rect', x: 24, y: 334, w: 352, h: 52 } },
  // Fila inferior de la casa
  { id: 'comedorCocina', shape: { t: 'rect', x: 24, y: 386, w: 180, h: 80 } },
  { id: 'bano2', shape: { t: 'rect', x: 204, y: 386, w: 44, h: 80 } },
  { id: 'room4', room: 4, shape: { t: 'rect', x: 248, y: 386, w: 128, h: 80 } },
];

const ZONE_ICONS = {
  barraCocteles: Martini,
  dj: Disc3,
  salonJuegos: Gamepad2,
  jacuzzi: Droplets,
  piscina: Waves,
  parqueadero: SquareParking,
  casa: House,
  room1: BedDouble,
  room2: BedDouble,
  room3: BedDouble,
  room4: BedDouble,
  bano: Bath,
  bano2: Bath,
  sala: Sofa,
  comedorCocina: Utensils,
};

const SANS = 'Inter, sans-serif';
const DISPLAY = 'Anton, Impact, sans-serif';

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

/** Rótulo dentro del plano de cada zona (el texto es decorativo: el botón ya tiene aria-label). */
function ZoneLabel({ z, sel, room, known, ink, soft }) {
  const c = center(z.shape);
  const common = { className: 'fd-zone-label', fontFamily: SANS, fontWeight: 700, pointerEvents: 'none' };
  switch (z.id) {
    case 'barraCocteles':
      return (
        <g textAnchor="middle" {...common} fontSize="10.5" letterSpacing="0.6" fill={ink}>
          <text x={c.x} y={c.y - 2} className="fd-zone-label">BARRA DE</text>
          <text x={c.x} y={c.y + 12} className="fd-zone-label">CÓCTELES</text>
        </g>
      );
    case 'dj':
      return (
        <g pointerEvents="none">
          <text x={150} y={63} textAnchor="middle" className="fd-zone-label" fontSize="34" fontFamily={DISPLAY} letterSpacing="2" fill={ink}>
            DJ
          </text>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <rect
              key={i}
              x={196 + i * 8}
              y={38}
              width={4.4}
              height={26}
              rx={1.2}
              fill={i % 3 === 0 ? RED : i % 3 === 1 ? '#ffb340' : '#8b5cf6'}
              fillOpacity="0.8"
              className="fd-eq-bar"
              style={{ animationDelay: `${(i * 137) % 900}ms`, animationDuration: `${700 + ((i * 211) % 500)}ms` }}
            />
          ))}
        </g>
      );
    case 'salonJuegos':
      return (
        <g textAnchor="middle" {...common} fontSize="12" letterSpacing="0.8" fill={ink}>
          <text x={c.x} y={c.y - 3} className="fd-zone-label">SALÓN DE</text>
          <text x={c.x} y={c.y + 13} className="fd-zone-label">JUEGOS</text>
        </g>
      );
    case 'jacuzzi':
      return (
        <g pointerEvents="none">
          <circle cx={152} cy={126} r={13} fill="none" stroke="rgb(167 139 250 / 0.85)" strokeWidth="1.2" />
          <circle cx={152} cy={126} r={13} fill="none" stroke="rgb(167 139 250 / 0.6)" className="fd-ripple" />
          <text x={174} y={130.5} className="fd-zone-label" fontSize="12" fontFamily={SANS} fontWeight="700" letterSpacing="1" fill={ink}>
            JACUZZI
          </text>
        </g>
      );
    case 'piscina':
      return (
        <g pointerEvents="none">
          <circle cx={323} cy={118} r={38} fill="none" stroke="rgb(167 139 250 / 0.5)" className="fd-ripple" />
          <circle cx={323} cy={118} r={38} fill="none" stroke="rgb(167 139 250 / 0.5)" className="fd-ripple" style={{ animationDelay: '-2.7s' }} />
          <text x={323} y={124} textAnchor="middle" className="fd-zone-label" fontSize="18" fontFamily={DISPLAY} letterSpacing="2" fill={ink}>
            PISCINA
          </text>
        </g>
      );
    case 'parqueadero':
      return (
        <g pointerEvents="none">
          {Array.from({ length: 8 }, (_, i) => {
            const x = 16 + (234 / 9) * (i + 1);
            return <path key={i} d={`M${x} 176 v14 M${x} 232 v-14`} stroke="rgb(242 237 228 / 0.2)" />;
          })}
          <text x={c.x} y={c.y + 4.5} textAnchor="middle" className="fd-zone-label" fontSize="13" fontFamily={SANS} fontWeight="700" letterSpacing="2" fill={ink}>
            PARQUEADERO
          </text>
        </g>
      );
    case 'casa':
      return (
        <text x={c.x} y={c.y + 4} textAnchor="middle" className="fd-zone-label" fontSize="11" fontFamily={SANS} fontWeight="700" letterSpacing="2.6" fill={sel ? '#fff' : soft} pointerEvents="none">
          LA CASA
        </text>
      );
    case 'bano':
    case 'bano2':
      return (
        <text x={c.x} y={c.y + 4} textAnchor="middle" className="fd-zone-label" fontSize="10.5" fontFamily={SANS} fontWeight="700" letterSpacing="0.4" fill={soft} pointerEvents="none">
          BAÑO
        </text>
      );
    case 'sala':
      return (
        <text x={c.x} y={c.y + 8} textAnchor="middle" className="fd-zone-label" fontSize="24" fontFamily={DISPLAY} letterSpacing="4" fill={ink} pointerEvents="none">
          SALA
        </text>
      );
    case 'comedorCocina':
      return (
        <g textAnchor="middle" {...common} fontSize="12" letterSpacing="0.8" fill={ink}>
          <text x={c.x} y={c.y - 3} className="fd-zone-label">COMEDOR</text>
          <text x={c.x} y={c.y + 13} className="fd-zone-label">Y COCINA</text>
        </g>
      );
    default:
      break;
  }
  if (z.room) {
    const { x, y, w } = z.shape;
    const st = known ? room?.status : null;
    const statusText = st === 'booked' ? 'OCUPADA' : st === 'held' ? 'APARTADA' : null;
    const cx = x + w / 2;
    return (
      <g pointerEvents="none">
        <text x={cx} y={y + 19} textAnchor="middle" className="fd-zone-label" fontSize="11" fontFamily={SANS} fontWeight="700" letterSpacing="1.6" fill={soft}>
          HAB.
        </text>
        <text x={cx} y={y + (statusText ? 46 : 52)} textAnchor="middle" className="fd-zone-label" fontSize="28" fontFamily={DISPLAY} fill={ink}>
          {z.room}
        </text>
        {statusText && (
          <text x={cx} y={y + 65} textAnchor="middle" fontSize="10.5" fontFamily={SANS} fontWeight="700" letterSpacing="1.4" fill={statusColor(room, known)}>
            {statusText}
          </text>
        )}
        {known && room?.status === 'available' && <circle cx={x + w - 8} cy={y + 8} r={3} fill={statusColor(room, known)} className="fd-pulse-dot" />}
        <circle cx={x + w - 8} cy={y + 8} r={3} fill={statusColor(room, known)} />
        {room?.privateBathroom && (
          <text x={cx} y={y + (statusText ? 65 : 66)} textAnchor="middle" fontSize="10" fontFamily={SANS} fontWeight="600" letterSpacing="0.3" fill="rgb(255 179 64 / 0.9)" display={statusText ? 'none' : undefined}>
            BAÑO PRIVADO
          </text>
        )}
      </g>
    );
  }
  return null;
}

export default function FincaMap({ config, known = true, className }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const [selected, setSelected] = useState(null);
  const panelRef = useRef(null);
  const roomsByNumber = useMemo(() => Object.fromEntries((config.rooms || []).map((r) => [r.number, r])), [config.rooms]);

  const select = (id) => setSelected((cur) => (cur === id ? cur : id));

  // En celular, si el panel quedó fuera de pantalla, lo acerca suavemente.
  useEffect(() => {
    if (!selected) return;
    const el = panelRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.top > window.innerHeight - 120) {
      el.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' });
    }
  }, [selected]);

  const zone = ZONES.find((z) => z.id === selected) || null;

  return (
    <div className={clsx('grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-start lg:gap-8', className)}>
      <div className="fd-blueprint noise-border relative mx-auto w-full max-w-[560px] overflow-hidden rounded-[28px] p-2 sm:p-4 lg:max-w-none">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_50%_at_50%_0%,rgb(255_106_0/0.12),transparent_70%)]" aria-hidden="true" />
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="relative mx-auto block h-auto w-full max-w-[520px] select-none"
          role="group"
          aria-label="Mapa de la finca. Toca o selecciona una zona para ver su información."
        >
          <defs>
            <pattern id={`hatch-${uid}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="6" stroke="rgb(255 77 94 / 0.22)" strokeWidth="2" />
            </pattern>
            <radialGradient id={`water-${uid}`} cx="50%" cy="45%" r="60%">
              <stop offset="0%" stopColor="rgb(139 92 246 / 0.30)" />
              <stop offset="70%" stopColor="rgb(139 92 246 / 0.10)" />
              <stop offset="100%" stopColor="rgb(139 92 246 / 0.04)" />
            </radialGradient>
            <linearGradient id={`floor-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgb(242 237 228 / 0.04)" />
              <stop offset="100%" stopColor="rgb(242 237 228 / 0.01)" />
            </linearGradient>
            <radialGradient id={`lawn-${uid}`} cx="50%" cy="50%" r="65%">
              <stop offset="0%" stopColor="rgb(34 229 132 / 0.14)" />
              <stop offset="100%" stopColor="rgb(34 229 132 / 0.03)" />
            </radialGradient>
          </defs>

          {/* Lindero de la finca */}
          <rect x="8" y="8" width="384" height="480" rx="18" fill="none" stroke="rgb(242 237 228 / 0.16)" strokeWidth="1.2" strokeDasharray="5 5" aria-hidden="true" />

          {/* Anotaciones del paisaje (no son botones) */}
          <g aria-hidden="true">
            {/* Zona verde: césped suave junto al parqueadero */}
            <path
              d="M268 196 C266 182 286 176 308 180 C334 174 372 178 380 198 C388 216 372 232 346 230 C322 236 286 234 272 222 C264 214 266 204 268 196 Z"
              fill={`url(#lawn-${uid})`}
              stroke="rgb(34 229 132 / 0.35)"
              strokeWidth="1"
              strokeDasharray="3 4"
            />
            <text x="324" y="209" textAnchor="middle" fontSize="14" fontWeight="600" fontFamily="'Cormorant Garamond', Georgia, serif" fontStyle="italic" letterSpacing="0.4" fill="rgb(120 240 175 / 0.9)">
              {MAP_ZONES.zonaVerde.name.toLowerCase()}
            </text>
            {[
              [282, 190, 5],
              [372, 190, 5],
              [356, 224, 6],
            ].map(([x, y, r]) => (
              <g key={`${x}-${y}`} fill="none" stroke="rgb(34 229 132 / 0.4)" strokeWidth="1">
                <circle cx={x} cy={y} r={r} />
                <path d={`M${x - r * 0.45} ${y} H${x + r * 0.45} M${x} ${y - r * 0.45} V${y + r * 0.45}`} strokeOpacity="0.6" />
              </g>
            ))}
            {/* Vista a toda Pereira, inclinado como en el boceto */}
            <g transform="translate(323 36) rotate(12)">
              <text textAnchor="middle" fontSize="15" fontWeight="600" fontFamily="'Cormorant Garamond', Georgia, serif" fontStyle="italic" letterSpacing="0.3" fill="rgb(255 179 64 / 0.95)">
                {MAP_ZONES.vista.name.toLowerCase()}
              </text>
              <path d="M-52 8 Q0 14 52 8" fill="none" stroke="rgb(255 179 64 / 0.35)" strokeWidth="1" strokeDasharray="2 4" />
            </g>
          </g>

          {/* Estructura de la casa */}
          <g aria-hidden="true">
            <path d="M138 250 H34 Q16 250 16 268 V456 Q16 474 34 474 H366 Q384 474 384 456 V268 Q384 250 366 250 H262" fill={`url(#floor-${uid})`} stroke="rgb(242 237 228 / 0.55)" strokeWidth="1.6" />
          </g>

          {/* Zonas interactivas */}
          {ZONES.map((z) => {
            const info = MAP_ZONES[z.id] || { name: z.id };
            const room = z.room ? roomsByNumber[z.room] : null;
            const isSel = selected === z.id;
            const label = room ? roomAriaLabel(room.name || info.name, room, known) : info.name;
            const taken = !!room && known && room.status === 'booked';
            const onKeyDown = (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                select(z.id);
              }
            };

            let fill = 'transparent';
            if (z.water) fill = `url(#water-${uid})`;
            if (z.id === 'casa') fill = 'rgb(8 8 13 / 0.9)';
            if (room && known) fill = taken ? `url(#hatch-${uid})` : `${statusColor(room, known)}14`;
            if (isSel) fill = 'rgb(255 106 0 / 0.2)';

            let baseStroke = 'rgb(242 237 228 / 0.38)';
            if (z.water) baseStroke = 'rgb(167 139 250 / 0.75)';
            else if (['barraCocteles', 'dj', 'salonJuegos', 'parqueadero'].includes(z.id)) baseStroke = 'rgb(242 237 228 / 0.55)';
            else if (z.id === 'casa') baseStroke = 'rgb(242 237 228 / 0.55)';
            if (taken) baseStroke = 'rgb(255 77 94 / 0.7)';

            const ink = isSel ? '#fff' : taken ? 'rgb(242 237 228 / 0.55)' : BONE;
            const soft = isSel ? '#fff' : 'rgb(242 237 228 / 0.78)';
            const focusShape = z.shape.t === 'circle' ? { ...z.shape, r: z.shape.r + 4 } : { ...z.shape, x: z.shape.x - 3, y: z.shape.y - 3, w: z.shape.w + 6, h: z.shape.h + 6, rx: (z.shape.rx || 0) + 3 };

            return (
              <g key={z.id} className="fd-zone" role="button" tabIndex={0} aria-label={label} aria-pressed={isSel} onClick={() => select(z.id)} onKeyDown={onKeyDown}>
                {/* Halo de neón cuando está seleccionada */}
                {isSel && <Shape shape={z.shape} fill="none" stroke={RED} strokeOpacity="0.28" strokeWidth="7" />}
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
                <Shape shape={focusShape} className="fd-zone-focus" fill="none" stroke="#ffffff" strokeWidth="1.5" strokeDasharray="4 3" />
                <ZoneLabel z={z} sel={isSel} room={room} known={known} ink={ink} soft={soft} />
              </g>
            );
          })}

          {/* Cajetín del plano */}
          <g aria-hidden="true" fontFamily={SANS}>
            <g transform="translate(62 520)">
              <circle r="16" fill="none" stroke="rgb(242 237 228 / 0.2)" />
              <path d="M0 -13 L4 2 L0 -1 L-4 2 Z" fill={RED} />
              <path d="M0 13 L4 -2 L0 1 L-4 -2 Z" fill="rgb(242 237 228 / 0.3)" />
              <text y="-20" textAnchor="middle" fontSize="9" fontWeight="700" fill="rgb(242 237 228 / 0.55)">
                N
              </text>
            </g>
            <rect x="172" y="496" width="212" height="52" fill="rgb(7 7 10 / 0.6)" stroke="rgb(242 237 228 / 0.25)" />
            <path d="M172 516 H384 M300 516 V548" stroke="rgb(242 237 228 / 0.18)" />
            <text x="180" y="510" fontSize="10" fontFamily={DISPLAY} letterSpacing="1.4" fill={BONE}>
              FINCA · PEREIRA · PLANO DE LA NOCHE
            </text>
            <text x="180" y="530" fontSize="7.5" fontWeight="600" letterSpacing="1" fill="rgb(242 237 228 / 0.6)">
              FIESTA DE DISFRACES
            </text>
            <text x="180" y="541" fontSize="7.5" fontWeight="600" letterSpacing="1" fill="rgb(255 77 94 / 0.85)">
              31 · 10 · 2026
            </text>
            <text x="342" y="530" textAnchor="middle" fontSize="7.5" fontWeight="600" letterSpacing="1" fill="rgb(242 237 228 / 0.6)">
              SIN ESCALA
            </text>
            <text x="342" y="541" textAnchor="middle" fontSize="7.5" fontWeight="600" letterSpacing="1" fill="rgb(242 237 228 / 0.45)">
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
    { color: ROOM_STATUS.booked.color, label: 'Ocupada' },
  ];
  return (
    <ul className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-fog" aria-label="Estado de las habitaciones">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: i.color }} aria-hidden="true" />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

function ZonePanel({ zone, config, roomsByNumber, known }) {
  const [viewing, setViewing] = useState(false);

  if (!zone) {
    return (
      <div className="rounded-3xl border border-white/[0.08] bg-crypt/70 p-6" aria-live="polite">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-pumpkin-light">
          <MousePointerClick className="h-5 w-5" strokeWidth={1.6} />
        </span>
        <h3 className="mt-5 font-display text-3xl uppercase leading-none text-bone">Toca una zona</h3>
        <p className="mt-3 text-[15px] leading-relaxed text-fog">
          Explora la finca: la barra y el DJ, el salón de juegos, el jacuzzi, la piscina y la casa con las habitaciones en alquiler, con su disponibilidad en vivo.
        </p>
      </div>
    );
  }

  const info = MAP_ZONES[zone.id] || { name: zone.id, description: '' };
  const Icon = ZONE_ICONS[zone.id] || House;
  const room = zone.room ? roomsByNumber[zone.room] : null;
  const salesOpen = config.event?.salesOpen !== false;
  const parking = config.parking || {};
  const phase = config.event?.phase;
  const taken = !!room && known && room.status === 'booked';

  return (
    <div className="animate-fade-up rounded-3xl border border-pumpkin/30 bg-[linear-gradient(160deg,rgb(255_106_0/0.12),rgb(21_21_28/0.9)_50%)] p-6" aria-live="polite" key={zone.id}>
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-pumpkin/35 bg-pumpkin/12 text-pumpkin-light">
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
          <RoomThumb number={room.number} className={clsx('mt-5 h-36 w-full rounded-2xl border border-white/10', taken && 'grayscale-[0.7] brightness-[0.65]')} />
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
          {!taken && <RoomHelpNote contact={config.contact} room={room} className="mt-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3" />}
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
                className="flex h-13 items-center justify-center gap-2 rounded-2xl bg-pumpkin font-semibold text-white shadow-[0_0_30px_-8px_rgb(255_106_0/0.9)] transition hover:bg-pumpkin-light"
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
