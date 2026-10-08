import { useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { ArrowRight, Bath, BedDouble, Eye, Map as MapIcon, TicketCheck, Users } from 'lucide-react';
import { ROOMS_COPY } from '../../../config/event';
import { ROOM_STATUS, RoomHelpNote, RoomPriceLine, RoomRowMini, RoomStatusBadge, RoomThumb, RoomViewModal, roomPeopleText } from '../rooms';
import { Cobweb } from '../decor';
import { Reveal, SectionHeading } from '../ui';

function RoomCard({ room, known, salesOpen, index, phase, onView }) {
  const available = room.status === 'available';
  const canBook = salesOpen && (available || !known);
  const big = !!room.privateBathroom;

  return (
    <Reveal
      as="li"
      delay={index * 0.08}
      className={clsx(
        'relative flex flex-col overflow-hidden rounded-[28px] p-6 sm:p-7',
        big
          ? 'noise-border bg-[linear-gradient(165deg,rgb(255_179_64/0.12),rgb(21_21_28/0.94)_42%)] shadow-[0_30px_80px_-36px_rgb(255_179_64/0.5)]'
          : 'border border-white/[0.08] bg-crypt/70',
      )}
    >
      <Cobweb corner={index % 2 ? 'tl' : 'tr'} className={clsx('absolute top-0 h-20 w-20', index % 2 ? 'left-0' : 'right-0')} opacity={0.2} />
      <div className="-mx-6 -mt-6 mb-5 sm:-mx-7 sm:-mt-7">
        <RoomThumb number={room.number} className="h-40 w-full" />
      </div>
      <div className="flex items-center justify-between gap-3">
        <RoomRowMini highlight={room.number} />
        <RoomStatusBadge status={room.status} known={known} short />
      </div>

      <div className="mt-6 flex items-baseline gap-3">
        <h3 className="font-display text-[2.4rem] uppercase leading-none text-bone">{room.name || `Habitación ${room.number}`}</h3>
      </div>
      {big && <p className="mt-1 font-serif text-xl italic text-ember">La grande</p>}

      <ul className="mt-5 flex flex-col gap-2.5 text-sm text-fog">
        {room.beds && (
          <li className="flex items-center gap-2.5">
            <BedDouble className="h-4 w-4 text-pumpkin-light" strokeWidth={1.75} />
            <span className="font-semibold text-bone">{room.beds}</span>
          </li>
        )}
        <li className="flex items-center gap-2.5">
          <Users className="h-4 w-4 text-pumpkin-light" strokeWidth={1.75} />
          <span className="font-semibold text-bone">{roomPeopleText(room)}</span>
        </li>
        {room.privateBathroom && (
          <li className="flex items-center gap-2.5">
            <Bath className="h-4 w-4 text-pumpkin-light" strokeWidth={1.75} />
            <span className="font-semibold text-bone">Baño privado</span> al lado
          </li>
        )}
        <li className="flex items-center gap-2.5">
          <TicketCheck className="h-4 w-4 text-pumpkin-light" strokeWidth={1.75} />
          Entrada incluida para todo el grupo
        </li>
      </ul>

      <div className="mt-6 flex items-end justify-between gap-3 border-t border-white/[0.07] pt-5">
        <RoomPriceLine room={room} phase={phase} />
      </div>

      <div className="mt-6 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => onView(room.number)}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.04] text-sm font-semibold uppercase tracking-[0.1em] text-bone transition hover:bg-white/[0.08]"
        >
          <Eye className="h-4 w-4 text-pumpkin-light" />
          Ver habitación
        </button>
        {canBook ? (
          <Link
            to={`/comprar?tipo=habitacion&hab=${room.number}`}
            className={clsx(
              'flex h-13 w-full items-center justify-center gap-2 rounded-2xl font-semibold transition',
              big ? 'bg-pumpkin text-white shadow-[0_0_30px_-8px_rgb(255_106_0/0.9)] hover:bg-pumpkin-light' : 'border border-white/15 bg-white/[0.05] text-bone hover:border-pumpkin/50 hover:bg-pumpkin/15',
            )}
          >
            Reservar {room.name || `Habitación ${room.number}`}
            <ArrowRight className="h-4 w-4" />
          </Link>
        ) : (
          <p className="flex h-13 w-full items-center justify-center rounded-2xl border border-dashed border-white/12 text-sm font-semibold text-fog">
            {salesOpen ? (ROOM_STATUS[room.status] || ROOM_STATUS.blocked).label : 'Ventas en línea cerradas'}
          </p>
        )}
      </div>
    </Reveal>
  );
}

export default function RoomsSection({ config, known }) {
  const rooms = config.rooms || [];
  const [includes, perGroup] = ROOMS_COPY.includes.split(' · ');
  const contact = config.contact || {};
  const phase = config.event?.phase;
  const [viewing, setViewing] = useState(null);
  const viewRoom = rooms.find((r) => r.number === viewing);

  return (
    <section id="habitaciones" aria-labelledby="habitaciones-title" className="relative scroll-mt-16 overflow-hidden bg-ink py-24 sm:py-32">
      <div className="pointer-events-none absolute -left-40 bottom-0 h-[30rem] w-[30rem] rounded-full bg-ember/[0.07] blur-3xl" aria-hidden="true" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading id="habitaciones-title" index="03" overline="Habitaciones" title={<>Duerme en<br />la finca</>} accent="Tu grupo, tu cuarto, la noche entera.">
          <div className="mt-6 flex flex-wrap gap-2">
            {[includes, perGroup].filter(Boolean).map((t) => (
              <span key={t} className="rounded-full border border-white/12 bg-white/[0.04] px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-bone/90">
                {t}
              </span>
            ))}
          </div>
        </SectionHeading>

        <ul className="mt-12 grid gap-4 lg:grid-cols-3 lg:gap-5">
          {rooms.map((room, i) => (
            <RoomCard key={room.number} room={room} known={known} salesOpen={config.event.salesOpen !== false} index={i} phase={phase} onView={setViewing} />
          ))}
        </ul>

        <RoomViewModal
          room={viewRoom}
          phase={phase}
          contact={contact}
          open={!!viewRoom}
          onClose={() => setViewing(null)}
          buyTo={viewRoom && config.event?.salesOpen !== false && viewRoom.status === 'available' ? `/comprar?tipo=habitacion&hab=${viewRoom.number}` : null}
        />

        <Reveal delay={0.1} className="mt-6 flex flex-col gap-4 rounded-3xl border border-white/[0.08] bg-crypt/50 p-5 sm:p-6">
          <RoomHelpNote contact={contact} />
          <div className="flex flex-col gap-2 sm:flex-row">
            <a
              href="#mapa"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/12 px-4 text-sm font-semibold text-bone transition hover:bg-white/[0.06]"
            >
              <MapIcon className="h-4 w-4 text-pumpkin-light" />
              Ver en el mapa
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
