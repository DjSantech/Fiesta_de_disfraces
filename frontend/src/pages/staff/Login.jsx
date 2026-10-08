import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, LockKeyhole } from 'lucide-react';
import { ROLE_HOME, useAuth } from '../../lib/auth';
import { Button, Card, Input, PageSpinner } from '../../components/ui';

// Solo se permite volver a rutas internas del staff (evita redirecciones abiertas).
function safeNext(next) {
  return typeof next === 'string' && next.startsWith('/staff/') && !next.startsWith('//') ? next : null;
}

export default function Login() {
  const { user, loading, login } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const next = safeNext(params.get('next'));

  if (loading) return <PageSpinner label="Verificando sesión…" />;
  if (user) return <Navigate to={next || ROLE_HOME[user.role] || '/staff'} replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const u = await login(username.trim().toLowerCase(), password);
      navigate(next || ROLE_HOME[u.role] || '/staff', { replace: true });
    } catch (err) {
      setError(err.status === 401 ? 'Usuario o contraseña incorrectos.' : err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-ink px-4 py-10">
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{ background: 'radial-gradient(60% 45% at 50% 0%, rgb(225 29 46 / 0.18), transparent 70%)' }}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-smoke">Acceso staff</p>
          <h1 className="mt-2 font-display text-4xl uppercase tracking-wide text-bone">
            Fiesta de <span className="text-blood">Disfraces</span>
          </h1>
        </div>
        <Card padding="lg" className="bg-crypt/90">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            <Input
              label="Usuario"
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
            <Input
              label="Contraseña"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              trailing={
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="rounded p-1 text-fog hover:text-bone"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
            />
            {error && (
              <p className="rounded-xl border border-blood/30 bg-blood/10 px-3 py-2 text-sm text-blood-light" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" block loading={submitting} disabled={!username || !password}>
              <LockKeyhole className="h-4 w-4" />
              Entrar
            </Button>
          </form>
        </Card>
        <p className="mt-6 text-center text-sm text-smoke">
          <Link to="/" className="hover:text-bone">
            ← Volver a la web
          </Link>
        </p>
      </div>
    </div>
  );
}
