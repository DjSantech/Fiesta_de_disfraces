import { useCallback, useEffect, useRef, useState } from 'react';
import { Search, UserPlus } from 'lucide-react';
import { Badge, Button, Card, Input, Modal, Spinner } from '../../ui';
import { formatTime, maskCedula } from '../../../lib/format';
import { POS_METHOD_LABEL, TICKET_STATUS_LABEL, TICKET_STATUS_TONE } from '../../../lib/labels';
import QrCamera from './QrCamera';
import ResultScreen from './ResultScreen';
import { categoryLabel, doorApi, formatCodeTyping, normalizeTicketInput, ticketTypeLabel } from './doorUtils';
import { signal as feedback } from './feedback';
import { useDebounced, useWakeLock } from './shared/hooks';
import { errorMessage, withTimeout } from './shared/errors';

/** Buscar persona que perdió el QR: GET /api/door/lookup. */
export function LookupSheet({ open, onClose, onCheckin, onSell }) {
  const [q, setQ] = useState('');
  const dq = useDebounced(q.trim(), 400);
  const [state, setState] = useState({ data: null, loading: false, error: null });

  useEffect(() => {
    if (!open || dq.length < 3) {
      setState({ data: null, loading: false, error: null });
      return undefined;
    }
    const ctrl = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null }));
    doorApi
      .lookup(dq, ctrl.signal)
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((error) => error?.name !== 'AbortError' && setState({ data: null, loading: false, error }));
    return () => ctrl.abort();
  }, [dq, open]);

  const close = () => {
    setQ('');
    onClose();
  };
  const d = state.data;
  const empty = d && !d.tickets.length && !d.guests.length && !d.entries.length;
  const sellPrefill = () => (/^[\d.\s-]+$/.test(dq) ? { cedula: dq.replace(/\D/g, '') } : { name: dq });

  return (
    <Modal open={open} onClose={close} title="Buscar persona" description="Por cédula, celular o nombre (mínimo 3 caracteres)" size="lg">
      <div className="flex flex-col gap-4">
        <Input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cédula, celular o nombre"
          leading={<Search className="h-5 w-5" />}
          inputClassName="h-14 text-lg"
          enterKeyHint="search"
          autoComplete="off"
          trailing={state.loading ? <Spinner /> : null}
        />
        {state.error && <p className="text-sm text-danger-light">{errorMessage(state.error)}</p>}
        {d?.tickets.map((t) => (
          <Card key={t.id} padding="sm" className="flex flex-col gap-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-lg font-bold leading-tight text-bone">{t.holderName}</p>
                <p className="text-sm text-fog">
                  {ticketTypeLabel(t)} · {t.cedulaLast4 ? `CC ••••${t.cedulaLast4}` : 'sin cédula'} · <span className="font-mono">{t.code}</span>
                </p>
              </div>
              <Badge tone={TICKET_STATUS_TONE[t.status]}>{TICKET_STATUS_LABEL[t.status]}</Badge>
            </div>
            {t.status === 'valid' && (
              <Button variant="success" size="lg" block onClick={() => onCheckin(t)}>
                Hacer check-in
              </Button>
            )}
            {t.status === 'used' && (
              <p className="text-sm text-fog">
                Ingresó {formatTime(t.checkedInAt)}
                {t.checkedInByName ? ` · registró ${t.checkedInByName}` : ''}
              </p>
            )}
          </Card>
        ))}
        {d?.guests.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-smoke">Lista de invitados (sin entrada)</p>
            {d.guests.map((g) => (
              <Card key={g.id} padding="sm" className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-bone">{g.name}</p>
                  <p className="text-sm text-fog">
                    {g.cedulaLast4 ? `CC ••••${g.cedulaLast4} · ` : ''}
                    {g.discountPercent === 100 ? 'Cortesía' : g.discountPercent != null ? `${g.discountPercent}% de descuento` : 'Regla general de invitados'}
                  </p>
                </div>
                <Button size="lg" variant="secondary" onClick={() => onSell({ name: g.name, category: 'invitado' })}>
                  Vender
                </Button>
              </Card>
            ))}
          </div>
        )}
        {d?.entries.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-smoke">Ingresos registrados</p>
            {d.entries.map((e) => (
              <Card key={e.id} padding="sm" className={e.voided ? 'opacity-50' : ''}>
                <p className="font-bold text-bone">{e.name}</p>
                <p className="text-sm text-fog">
                  {categoryLabel(e.category)} · {formatTime(e.createdAt)} · {e.source === 'ticket' ? 'con QR' : 'venta en puerta'}
                  {e.cedula ? ` · CC ${maskCedula(e.cedula)}` : ''} · {POS_METHOD_LABEL[e.paymentMethod]}
                  {e.voided ? ' · ANULADA' : ''}
                </p>
              </Card>
            ))}
          </div>
        )}
        {empty && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <p className="text-fog">Sin resultados para «{dq}».</p>
            <Button size="lg" onClick={() => onSell(sellPrefill())}>
              <UserPlus className="h-5 w-5" />
              Vender entrada en puerta
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default function ScanTab({ config, onChanged, onSell }) {
  useWakeLock(true);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState(null);
  const [lookupOpen, setLookupOpen] = useState(false);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const lastRef = useRef({ value: '', at: 0 });
  const busyRef = useRef(false);

  const verify = useCallback(async (value) => {
    if (!value || busyRef.current) return;
    busyRef.current = true;
    setChecking(true);
    try {
      const data = await withTimeout((s) => doorApi.scan(value, s), 9000);
      feedback(data.result === 'valid' ? 'ok' : 'bad');
      setResult({ status: data.result, ticket: data.ticket, entry: data.entry, value });
    } catch (err) {
      if (err?.status !== 401) {
        feedback('warn');
        setResult({ status: 'error', value, error: err });
      }
    } finally {
      busyRef.current = false;
      setChecking(false);
    }
  }, []);

  const handleScan = useCallback(
    (data) => {
      const now = Date.now();
      const last = lastRef.current;
      // Mismo QR frente a la cámara: se ignora durante 3 s desde la última vez que se vio.
      if (data === last.value && now - last.at < 3000) {
        last.at = now;
        return;
      }
      lastRef.current = { value: data, at: now };
      verify(data);
    },
    [verify],
  );

  const closeResult = useCallback(() => {
    setResult((r) => {
      if (r && r.status !== 'not_found' && r.status !== 'error') setCode('');
      return null;
    });
    lastRef.current = { ...lastRef.current, at: Date.now() };
  }, []);

  const submitCode = (e) => {
    e.preventDefault();
    const raw = code.trim();
    if (!raw.includes('/') && raw.replace(/[^0-9A-Z]/gi, '').length !== 8) {
      setCodeError('El código tiene 8 caracteres: FD-XXXX-XXXX');
      return;
    }
    setCodeError('');
    verify(normalizeTicketInput(raw));
  };

  const paused = checking || Boolean(result) || lookupOpen;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,28rem)_minmax(0,1fr)] lg:items-start">
      <QrCamera paused={paused} onScan={handleScan} className="mx-auto w-full max-w-md lg:max-w-none">
        {checking && (
          <div className="absolute inset-0 flex items-center justify-center rounded-[inherit] bg-black/55">
            <span className="flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-lg font-bold text-bone">
              <Spinner className="h-5 w-5 text-toxic" /> Verificando…
            </span>
          </div>
        )}
      </QrCamera>

      <div className="mx-auto flex w-full max-w-md flex-col gap-3 lg:max-w-none">
        <Card padding="sm">
          <form onSubmit={submitCode} className="flex flex-col gap-2" noValidate>
            <label htmlFor="door-code" className="text-sm font-medium text-bone/90">
              ¿No lee el QR? Escribe el código
            </label>
            <div className="flex gap-2">
              <Input
                id="door-code"
                className="min-w-0 flex-1"
                value={code}
                onChange={(e) => {
                  setCode(formatCodeTyping(e.target.value));
                  setCodeError('');
                }}
                leading={<span className="font-mono text-lg text-fog">FD-</span>}
                placeholder="XXXX-XXXX"
                inputClassName="h-14 pl-[3.6rem] font-mono text-xl uppercase tracking-[0.12em]"
                autoCapitalize="characters"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="go"
                error={codeError}
              />
              <Button type="submit" size="lg" className="h-14" loading={checking} disabled={!code.trim()}>
                Verificar
              </Button>
            </div>
          </form>
        </Card>
        <Button variant="secondary" size="lg" block className="h-14" onClick={() => setLookupOpen(true)}>
          <Search className="h-5 w-5" />
          Buscar persona (perdió el QR)
        </Button>
      </div>

      <LookupSheet
        open={lookupOpen}
        onClose={() => setLookupOpen(false)}
        onCheckin={(ticket) => {
          setLookupOpen(false);
          setResult({ status: ticket.status === 'valid' ? 'valid' : ticket.status, ticket, entry: null, value: ticket.code });
        }}
        onSell={(prefill) => {
          setLookupOpen(false);
          onSell?.(prefill);
        }}
      />

      {result && (
        <ResultScreen
          key={`${result.value}-${result.status}`}
          result={result}
          config={config}
          onClose={closeResult}
          onChanged={onChanged}
          onRetry={() => {
            const v = result.value;
            setResult(null);
            verify(v);
          }}
        />
      )}
    </div>
  );
}
