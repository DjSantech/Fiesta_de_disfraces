import { Suspense } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import {
  BedDouble,
  DoorOpen,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Martini,
  Receipt,
  Settings,
  Ticket,
  UserCog,
  Wallet,
} from 'lucide-react';
import { ROLE_LABEL, useAuth } from '../../lib/auth';
import { PageSpinner } from '../ui';

const ADMIN_LINKS = [
  { to: '/staff/admin', label: 'Resumen', icon: LayoutDashboard, end: true },
  { to: '/staff/admin/compras', label: 'Compras', icon: Receipt },
  { to: '/staff/admin/entradas', label: 'Entradas', icon: Ticket },
  { to: '/staff/admin/habitaciones', label: 'Habitaciones', icon: BedDouble },
  { to: '/staff/admin/invitados', label: 'Invitados', icon: ListChecks },
  { to: '/staff/admin/gastos', label: 'Gastos', icon: Wallet },
  { to: '/staff/admin/ajustes', label: 'Ajustes', icon: Settings },
  { to: '/staff/admin/usuarios', label: 'Usuarios', icon: UserCog },
];

const OPS_LINKS = [
  { to: '/staff/puerta', label: 'Portería', icon: DoorOpen, roles: ['admin', 'puerta'] },
  { to: '/staff/barra', label: 'Barra', icon: Martini, roles: ['admin', 'barra'] },
];

function linksFor(role) {
  const ops = OPS_LINKS.filter((l) => l.roles.includes(role));
  return role === 'admin' ? [...ADMIN_LINKS, ...ops] : ops;
}

/** Layout de todas las pantallas del staff: barra superior + navegación por rol + contenido. */
export default function StaffLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const links = linksFor(user?.role);

  const handleLogout = () => {
    logout();
    navigate('/staff/login', { replace: true });
  };

  return (
    <div className="min-h-dvh bg-ink text-bone">
      <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-ink/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4">
          <Link to="/staff" className="flex items-center gap-2">
            <span className="font-display text-xl tracking-wide text-pumpkin">FD</span>
            <span className="text-sm font-semibold text-bone">Staff</span>
          </Link>
          <div className="flex min-w-0 items-center gap-3">
            <div className="hidden min-w-0 text-right sm:block">
              <p className="truncate text-sm font-medium leading-tight">{user?.name}</p>
              <p className="text-xs leading-tight text-smoke">{ROLE_LABEL[user?.role]}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm text-fog transition hover:bg-white/5 hover:text-bone"
            >
              <LogOut className="h-4 w-4" />
              <span>Salir</span>
            </button>
          </div>
        </div>
        {links.length > 1 && (
          <nav className="mx-auto max-w-7xl overflow-x-auto px-2 [scrollbar-width:none]" aria-label="Secciones">
            <ul className="flex min-w-max gap-1 pb-2">
              {links.map(({ to, label, icon: Icon, end }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    end={end}
                    className={({ isActive }) =>
                      clsx(
                        'flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium transition',
                        isActive ? 'bg-pumpkin/15 text-bone ring-1 ring-pumpkin/50' : 'text-fog hover:bg-white/5 hover:text-bone',
                      )
                    }
                  >
                    <Icon className="h-4 w-4" strokeWidth={1.75} />
                    {label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </header>
      <main className="mx-auto w-full max-w-7xl px-4 py-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <Suspense fallback={<PageSpinner />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
