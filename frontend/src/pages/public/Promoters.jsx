import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { BarChart3, Link2, LogIn, Megaphone, QrCode, Share2, UserPlus } from 'lucide-react';
import { Button, Input, Segmented } from '../../components/ui';
import PublicLayout, { PageAtmosphere, PageContainer } from '../../components/public/PublicLayout';
import { Notice, Overline } from '../../components/public/ui';
import { promoterApi, promoterToken } from '../../lib/promoter';
import { isValidPhone, normalizePhone } from '../../components/public/utils/validation';

const PERKS = [
  { icon: Link2, text: 'Un link solo tuyo para compartir' },
  { icon: QrCode, text: 'Tu QR para mostrar o imprimir' },
  { icon: Share2, text: 'Botón para mandarlo por WhatsApp' },
  { icon: BarChart3, text: 'Visitas, clics y compras pagadas con tu link' },
];

const MODES = [
  { value: 'register', label: 'Registrarme', icon: UserPlus },
  { value: 'login', label: 'Ya tengo cuenta', icon: LogIn },
];

/** /promotores: qué es + registro + login. Con sesión abierta va directo al panel. */
export default function Promoters() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('register');
  const [form, setForm] = useState({ name: '', phone: '', password: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = 'Promotores · Fiesta de Disfraces';
  }, []);

  if (promoterToken.get()) return <Navigate to="/promotores/panel" replace />;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    const errs = {};
    if (mode === 'register' && form.name.trim().length < 3) errs.name = 'Escribe tu nombre (mínimo 3 letras).';
    if (!isValidPhone(form.phone)) errs.phone = 'Celular de 10 dígitos que empiece por 3.';
    if (mode === 'register' ? form.password.length < 6 : !form.password) errs.password = mode === 'register' ? 'Mínimo 6 caracteres.' : 'Escribe tu contraseña.';
    setErrors(errs);
    setError(null);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const body = { phone: normalizePhone(form.phone), password: form.password };
      if (mode === 'register') body.name = form.name.trim();
      const data = await promoterApi(`/api/promoters/${mode}`, { method: 'POST', body });
      promoterToken.set(data.token);
      navigate('/promotores/panel', { replace: true });
    } catch (err) {
      if (err.details?.fields) setErrors(err.details.fields);
      setError(err.status === 429 ? 'Hiciste demasiados intentos. Espera unos minutos y vuelve a intentar.' : err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <PublicLayout>
      <PageAtmosphere />
      <PageContainer size="lg">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-pumpkin/40 bg-pumpkin/10 text-pumpkin-light">
          <Megaphone className="h-6 w-6" strokeWidth={1.6} />
        </span>
        <Overline className="mt-6">Promotores</Overline>
        <h1 className="mt-3 font-display text-[length:clamp(2.6rem,12vw,4.75rem)] uppercase leading-[0.9] text-bone">
          Gana dinero <span className="fd-title-pumpkin">vendiendo boletas</span>
        </h1>
        <p className="mt-3 font-serif text-2xl italic leading-tight text-fog">Comparte tu propio link y vende entradas.</p>

        <ul className="mt-7 grid gap-2.5 sm:grid-cols-2">
          {PERKS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-crypt/70 px-4 py-3 text-sm text-bone/90">
              <Icon className="h-5 w-5 shrink-0 text-pumpkin-light" strokeWidth={1.6} />
              {text}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm leading-relaxed text-fog">
          Cada persona que entra con tu link y compra queda a tu nombre. Lo que ganas por entrada lo acuerdas directamente con DJ Santech.
        </p>

        <div className="mt-10 rounded-[24px] border border-white/[0.08] bg-crypt/85 p-5 sm:p-7">
          <Segmented
            options={MODES}
            value={mode}
            onChange={(v) => {
              setMode(v);
              setErrors({});
              setError(null);
            }}
            columns={2}
            ariaLabel="Registro o ingreso"
          />
          <form onSubmit={submit} noValidate className="mt-6 flex flex-col gap-4">
            {mode === 'register' && (
              <Input label="Tu nombre" autoComplete="name" value={form.name} onChange={set('name')} error={errors.name} required placeholder="Nombre y apellido" />
            )}
            <Input
              label="Celular"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={form.phone}
              onChange={set('phone')}
              error={errors.phone}
              required
              placeholder="300 123 4567"
              hint={mode === 'register' ? 'Es tu usuario para entrar.' : undefined}
            />
            <Input
              label="Contraseña"
              type="password"
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              value={form.password}
              onChange={set('password')}
              error={errors.password}
              required
              hint={mode === 'register' ? 'Mínimo 6 caracteres.' : undefined}
            />
            {error && <Notice title="No se pudo continuar">{error}</Notice>}
            <Button type="submit" size="lg" block loading={busy}>
              {mode === 'register' ? 'Crear mi link de promotor' : 'Entrar a mi panel'}
            </Button>
          </form>
        </div>
      </PageContainer>
    </PublicLayout>
  );
}
