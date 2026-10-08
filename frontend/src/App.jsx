import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import { PageSpinner } from './components/ui';
import RequireRole from './components/staff/RequireRole';
import StaffLayout from './components/staff/StaffLayout';

// Web pública
const Home = lazy(() => import('./pages/public/Home'));
const Buy = lazy(() => import('./pages/public/Buy'));
const PaymentResult = lazy(() => import('./pages/public/PaymentResult'));
const MockCheckout = lazy(() => import('./pages/public/MockCheckout'));
const OrderStatus = lazy(() => import('./pages/public/OrderStatus'));
const Ticket = lazy(() => import('./pages/public/Ticket'));
const Recover = lazy(() => import('./pages/public/Recover'));
const NotFound = lazy(() => import('./pages/public/NotFound'));

// Staff
const Login = lazy(() => import('./pages/staff/Login'));
const StaffHome = lazy(() => import('./pages/staff/StaffHome'));
const Dashboard = lazy(() => import('./pages/staff/admin/Dashboard'));
const Orders = lazy(() => import('./pages/staff/admin/Orders'));
const Tickets = lazy(() => import('./pages/staff/admin/Tickets'));
const Rooms = lazy(() => import('./pages/staff/admin/Rooms'));
const Guests = lazy(() => import('./pages/staff/admin/Guests'));
const Expenses = lazy(() => import('./pages/staff/admin/Expenses'));
const Settings = lazy(() => import('./pages/staff/admin/Settings'));
const Users = lazy(() => import('./pages/staff/admin/Users'));
const Door = lazy(() => import('./pages/staff/door/Door'));
const Bar = lazy(() => import('./pages/staff/bar/Bar'));

// Al cambiar de página vuelve arriba (salvo enlaces con #ancla).
function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (!hash) window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Suspense fallback={<PageSpinner />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/comprar" element={<Buy />} />
          <Route path="/pago/resultado" element={<PaymentResult />} />
          <Route path="/pago/simulado" element={<MockCheckout />} />
          <Route path="/orden/:token" element={<OrderStatus />} />
          <Route path="/entrada/:token" element={<Ticket />} />
          <Route path="/recuperar" element={<Recover />} />

          <Route path="/staff/login" element={<Login />} />
          <Route
            path="/staff"
            element={
              <RequireRole>
                <StaffLayout />
              </RequireRole>
            }
          >
            <Route index element={<StaffHome />} />
            <Route path="admin" element={<RequireRole roles={['admin']} />}>
              <Route index element={<Dashboard />} />
              <Route path="compras" element={<Orders />} />
              <Route path="entradas" element={<Tickets />} />
              <Route path="habitaciones" element={<Rooms />} />
              <Route path="invitados" element={<Guests />} />
              <Route path="gastos" element={<Expenses />} />
              <Route path="ajustes" element={<Settings />} />
              <Route path="usuarios" element={<Users />} />
            </Route>
            <Route
              path="puerta"
              element={
                <RequireRole roles={['admin', 'puerta']}>
                  <Door />
                </RequireRole>
              }
            />
            <Route
              path="barra"
              element={
                <RequireRole roles={['admin', 'barra']}>
                  <Bar />
                </RequireRole>
              }
            />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
