import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, KeyRound, SearchX } from 'lucide-react';
import { Button, Input } from '../../components/ui';
import { api } from '../../lib/api';
import { formatDateTime, whatsappLink } from '../../lib/format';
import { ORDER_KIND_LABEL, ORDER_STATUS_LABEL } from '../../lib/labels';
import PublicLayout, { PageAtmosphere, PageContainer } from '../../components/public/PublicLayout';
import { Notice } from '../../components/public/ui';
import { usePublicConfig } from '../../components/public/usePublicConfig';
import { describeError } from '../../components/public/utils/errors';
import { isValidCedula, isValidPhone, normalizeCedula, normalizePhone } from '../../components/public/utils/validation';

export default function Recover() {
  const { config } = usePublicConfig();
  const [cedula, setCedula] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    document.title = 'Recuperar mi entrada · Fiesta de Disfraces';
  }, []);

  async function submit(e) {
    e.preventDefault();
    const errs = {};
    if (!isValidCedula(cedula)) errs.cedula = 'Revisa tu cédula.';
    if (!isValidPhone(phone)) errs.phone = 'Celular de 10 dígitos que empiece por 3.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    setError(null);
    try {
      const d = await api('/api/public/recover', { method: 'POST', body: { cedula: normalizeCedula(cedula), phone: normalizePhone(phone) } });
      setResult(d.orders || []);
    } catch (err) {
      if (err.details?.fields) setErrors(err.details.fields);
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <PublicLayout>
      <PageAtmosphere intensity="soft" />
      <PageContainer size="sm">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-blood/40 bg-blood/10 text-blood-light">
          <KeyRound className="h-6 w-6" strokeWidth={1.6} />
        </span>
        <h1 className="mt-6 font-display text-[length:clamp(2.6rem,12vw,4rem)] uppercase leading-[0.9] text-bone">Recupera tu entrada</h1>
        <p className="mt-3 text-[15px] text-fog">Escribe la cédula y el celular que usaste al comprar.</p>
        <form onSubmit={submit} noValidate className="mt-8 flex flex-col gap-4">
          <Input label="Cédula" inputMode="numeric" value={cedula} onChange={(e) => setCedula(e.target.value)} error={errors.cedula} required />
          <Input label="Celular" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} error={errors.phone} required placeholder="300 123 4567" />
          <Button type="submit" size="lg" block loading={busy}>Buscar mis compras</Button>
        </form>
        {error && <Notice className="mt-5" title={error.title}>{error.message}</Notice>}
        {result && result.length > 0 && (
          <ul className="mt-8 flex flex-col gap-2">
            {result.map((o) => (
              <li key={o.token}>
                <Link to={`/orden/${o.token}`} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-crypt/70 p-4 transition hover:border-blood/40">
                  <span>
                    <span className="block font-semibold text-bone">{ORDER_KIND_LABEL[o.kind]} · {ORDER_STATUS_LABEL[o.status]}</span>
                    <span className="text-xs text-fog">{formatDateTime(o.createdAt)}</span>
                  </span>
                  <ArrowRight className="h-5 w-5 text-blood-light" />
                </Link>
              </li>
            ))}
          </ul>
        )}
        {result && result.length === 0 && (
          <Notice tone="neutral" icon={SearchX} className="mt-8" title="No encontramos compras con esos datos">
            Revisa que sean los mismos que usaste al comprar o{' '}
            <a className="font-semibold text-blood-light underline" href={whatsappLink(config.contact.whatsapp, 'Hola, no encuentro mi entrada de la Fiesta de Disfraces.')} target="_blank" rel="noopener noreferrer">
              escríbele a {config.contact.adminName || 'DJ Santech'}
            </a>
            .
          </Notice>
        )}
      </PageContainer>
    </PublicLayout>
  );
}
