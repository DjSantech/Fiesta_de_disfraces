import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { CircleCheckBig, Minus, Plus, Search, ShoppingCart, Trash2 } from 'lucide-react';
import { Button, EmptyState, Input, Modal, PageSpinner, useToast } from '../../ui';
import { formatCOP } from '../../../lib/format';
import { POS_METHOD_LABEL, PRODUCT_CATEGORY_LABEL } from '../../../lib/labels';
import { CATEGORY_COLOR, LOW_STOCK, MAX_ITEMS, MAX_QTY, MoneyInput, barApi } from './barUtils';
import { LoadError, PayMethodPicker } from '../door/shared/OpsUi';
import { useBodyScrollLock, useSingleFlight, useStickyTop, useWakeLock } from '../door/shared/hooks';
import { errorMessage } from '../door/shared/errors';

function ProductTile({ product, inCart, onAdd }) {
  const remaining = product.stock === null || product.stock === undefined ? null : product.stock - inCart;
  return (
    <button
      type="button"
      onClick={() => onAdd(product)}
      className="relative flex min-h-[6.5rem] flex-col justify-between overflow-hidden rounded-2xl border border-white/[0.08] bg-crypt p-3 pl-4 text-left transition active:scale-[0.97] active:bg-tomb"
    >
      <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: CATEGORY_COLOR[product.category] }} aria-hidden="true" />
      <span className={clsx('line-clamp-2 text-[15px] font-semibold leading-tight text-bone', inCart > 0 && 'pr-9')}>{product.name}</span>
      <span className="mt-2 flex flex-wrap items-end justify-between gap-1">
        <span className="text-lg font-extrabold tabular-nums text-bone">{formatCOP(product.price)}</span>
        {remaining !== null && (
          <span
            className={clsx(
              'rounded-full px-2 text-xs font-bold leading-5',
              remaining <= 0 ? 'bg-danger/20 text-danger-light' : remaining <= LOW_STOCK ? 'bg-gold/15 text-gold' : 'bg-white/[0.06] text-fog',
            )}
          >
            {remaining <= 0 ? 'Agotado' : remaining <= LOW_STOCK ? `Quedan ${remaining}` : `Stock ${remaining}`}
          </span>
        )}
      </span>
      {inCart > 0 && (
        <span className="absolute right-2 top-2 min-w-8 rounded-full bg-pumpkin px-2 text-center text-sm font-extrabold leading-7 text-white">×{inCart}</span>
      )}
    </button>
  );
}

/** Carrito + cobro (en hoja inferior en celular, panel lateral en tablet). */
function CartPanel({ lines, total, setQty, clear, method, setMethod, note, setNote, received, setReceived, onCharge, busy, compact }) {
  const count = lines.reduce((n, l) => n + l.qty, 0);
  const courtesy = method === 'cortesia';
  const due = courtesy ? 0 : total;
  const rec = Number(received || 0);
  const bills = [...new Set([Math.ceil(due / 10000) * 10000, 20000, 50000, 100000])].filter((b) => b >= due && b > 0).slice(0, 3);

  if (!lines.length) return <EmptyState icon={ShoppingCart} title="Carrito vacío" description="Toca un producto para agregarlo." className={compact ? 'py-8' : ''} />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-fog">{count} productos</p>
        <button type="button" onClick={clear} className="flex h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-danger-light hover:bg-danger/10">
          <Trash2 className="h-4 w-4" /> Vaciar
        </button>
      </div>
      <ul className="flex flex-col divide-y divide-white/[0.06]">
        {lines.map((l) => (
          <li key={l.productId} className="flex items-center gap-2 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-bone">{l.name}</p>
              <p className="text-sm tabular-nums text-fog">
                {formatCOP(l.price)} · <span className="text-bone">{formatCOP(l.price * l.qty)}</span>
              </p>
            </div>
            <button type="button" aria-label="Quitar uno" onClick={() => setQty(l.productId, l.qty - 1)} className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-tomb text-bone">
              {l.qty === 1 ? <Trash2 className="h-5 w-5 text-danger-light" /> : <Minus className="h-5 w-5" />}
            </button>
            <span className="w-8 text-center text-lg font-extrabold tabular-nums">{l.qty}</span>
            <button type="button" aria-label="Agregar uno" onClick={() => setQty(l.productId, l.qty + 1)} className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-tomb text-bone">
              <Plus className="h-5 w-5" />
            </button>
          </li>
        ))}
      </ul>
      <PayMethodPicker value={method} onChange={setMethod} />
      {method === 'efectivo' && (
        <div className="flex flex-col gap-2 rounded-2xl bg-tomb/50 p-3">
          <p className="text-sm font-medium text-bone/90">Calcular cambio (opcional)</p>
          <div className="flex flex-wrap gap-2">
            {bills.map((b) => (
              <button key={b} type="button" onClick={() => setReceived(String(b))} className={clsx('h-11 rounded-xl border px-3 text-sm font-bold', rec === b ? 'border-pumpkin bg-pumpkin/15 text-bone' : 'border-white/10 text-fog')}>
                {formatCOP(b)}
              </button>
            ))}
          </div>
          <MoneyInput aria-label="Recibido" placeholder="Recibido" value={received} onChange={setReceived} inputClassName="h-12 text-lg" />
          {rec > 0 && (
            <p className={clsx('text-xl font-extrabold tabular-nums', rec >= due ? 'text-toxic' : 'text-danger-light')}>
              {rec >= due ? `Cambio ${formatCOP(rec - due)}` : `Faltan ${formatCOP(due - rec)}`}
            </p>
          )}
        </div>
      )}
      <Input label="Nota (opcional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={120} />
      <div className="flex items-baseline justify-between">
        <span className="text-fog">Total{courtesy ? ` · cortesía (valor ${formatCOP(total)})` : ''}</span>
        <span className="text-3xl font-extrabold tabular-nums text-bone">{formatCOP(due)}</span>
      </div>
      <Button size="xl" block loading={busy} onClick={onCharge} className="text-lg font-extrabold">
        COBRAR {formatCOP(due)}
      </Button>
    </div>
  );
}

function SaleDone({ sale, change, onClose }) {
  useBodyScrollLock(true);
  const ref = useRef(onClose);
  ref.current = onClose;
  useEffect(() => {
    const t = setTimeout(() => ref.current(), 2600);
    return () => clearTimeout(t);
  }, []);
  return createPortal(
    <div role="alertdialog" aria-modal="true" onClick={() => ref.current()} className="fixed inset-0 z-[60] flex cursor-pointer flex-col items-center justify-center gap-3 bg-toxic px-6 text-center text-ink transition duration-150 starting:opacity-0">
      <CircleCheckBig className="h-16 w-16" strokeWidth={2.4} />
      <p className="font-display text-6xl uppercase">Venta #{sale.number}</p>
      <p className="text-5xl font-extrabold tabular-nums">{formatCOP(sale.total)}</p>
      <p className="text-xl font-bold">
        {POS_METHOD_LABEL[sale.paymentMethod]}
        {sale.paymentMethod === 'cortesia' ? ` · valor ${formatCOP(sale.courtesyValue)}` : ''}
      </p>
      {change > 0 && <p className="text-2xl font-extrabold">Cambio {formatCOP(change)}</p>}
      <p className="mt-6 text-base font-semibold opacity-80">Toca para la siguiente venta</p>
    </div>,
    document.body,
  );
}

export default function PosTab({ products, cart, setCart, onSold }) {
  useWakeLock(true);
  const toast = useToast();
  const top = useStickyTop();
  const [cat, setCat] = useState('all');
  const [q, setQ] = useState('');
  const [sheet, setSheet] = useState(false);
  const [method, setMethod] = useState('efectivo');
  const [note, setNote] = useState('');
  const [received, setReceived] = useState('');
  const [done, setDone] = useState(null);
  const [busy, run] = useSingleFlight();

  const list = products.data?.items || [];
  const byId = useMemo(() => new Map(list.map((p) => [p.id, p])), [list]);
  const categories = Object.keys(PRODUCT_CATEGORY_LABEL).filter((c) => list.some((p) => p.category === c));
  const term = q.trim().toLowerCase();
  const shown = list.filter((p) => (cat === 'all' || p.category === cat) && (!term || p.name.toLowerCase().includes(term)));
  const lines = cart.filter((i) => byId.has(i.productId)).map((i) => ({ ...i, name: byId.get(i.productId).name, price: byId.get(i.productId).price }));
  const total = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const count = lines.reduce((n, l) => n + l.qty, 0);
  const qtyOf = (id) => cart.find((i) => i.productId === id)?.qty || 0;

  const setQty = (id, qty) => {
    if (qty > MAX_QTY) return toast.info(`Máximo ${MAX_QTY} unidades por producto.`);
    setCart((c) => (qty <= 0 ? c.filter((i) => i.productId !== id) : c.some((i) => i.productId === id) ? c.map((i) => (i.productId === id ? { ...i, qty } : i)) : [...c, { productId: id, qty }]));
  };
  const add = (p) => {
    if (!cart.some((i) => i.productId === p.id) && cart.length >= MAX_ITEMS) return toast.info(`Máximo ${MAX_ITEMS} productos distintos por venta.`);
    setQty(p.id, qtyOf(p.id) + 1);
  };

  const charge = () =>
    run(async () => {
      if (!lines.length) return;
      try {
        const data = await barApi.sell({ items: lines.map((l) => ({ productId: l.productId, qty: l.qty })), paymentMethod: method, ...(note.trim() ? { note: note.trim() } : {}) });
        const rec = Number(received || 0);
        setDone({ sale: data.sale, change: method === 'efectivo' && rec > data.sale.total ? rec - data.sale.total : 0 });
        (data.warnings || []).forEach((w) => toast.info(w, { duration: 6000 }));
        setCart([]);
        setSheet(false);
        setMethod('efectivo');
        setNote('');
        setReceived('');
        onSold?.();
      } catch (err) {
        toast.error(errorMessage(err));
      }
    });

  if (products.loading && !products.data) return <PageSpinner label="Cargando productos…" />;
  if (!products.data) return <LoadError error={products.error} onRetry={products.reload} />;

  const panelProps = { lines, total, setQty, clear: () => setCart([]), method, setMethod, note, setNote, received, setReceived, onCharge: charge, busy };

  return (
    <div className="md:grid md:grid-cols-[minmax(0,1fr)_340px] md:items-start md:gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
      <section className="flex flex-col gap-3 pb-28 md:pb-0">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar producto" leading={<Search className="h-5 w-5" />} aria-label="Buscar producto" enterKeyHint="search" />
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
          {[['all', 'Todos'], ...categories.map((c) => [c, PRODUCT_CATEGORY_LABEL[c]])].map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => setCat(v)}
              className={clsx('flex h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition', cat === v ? 'border-bone bg-bone text-ink' : 'border-white/10 bg-crypt text-fog')}
            >
              {v !== 'all' && <span className="h-2.5 w-2.5 rounded-full" style={{ background: CATEGORY_COLOR[v] }} />}
              {label}
            </button>
          ))}
        </div>
        {shown.length ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2.5">
            {shown.map((p) => (
              <ProductTile key={p.id} product={p} inCart={qtyOf(p.id)} onAdd={add} />
            ))}
          </div>
        ) : (
          <EmptyState title="Sin productos" description={term ? `Nada coincide con «${q}».` : 'Crea productos en la pestaña Productos.'} />
        )}
      </section>

      <aside className="hidden md:block">
        <div className="sticky overflow-y-auto rounded-2xl border border-white/[0.08] bg-crypt p-4" style={{ top: top + 16, maxHeight: `calc(100dvh - ${top + 32}px)` }}>
          <CartPanel {...panelProps} compact />
        </div>
      </aside>

      {count > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-night/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur md:hidden">
          <button type="button" onClick={() => setSheet(true)} className="flex h-16 w-full items-center gap-3 rounded-2xl bg-pumpkin px-4 text-white shadow-[0_0_28px_-8px_rgb(255_106_0/0.85)]">
            <span className="flex h-9 min-w-9 items-center justify-center rounded-full bg-white/20 px-2 text-base font-extrabold">{count}</span>
            <span className="text-2xl font-extrabold tabular-nums">{formatCOP(total)}</span>
            <span className="ml-auto text-lg font-extrabold">Cobrar →</span>
          </button>
        </div>
      )}
      <Modal open={sheet && count > 0} onClose={() => setSheet(false)} title="Cobrar">
        <CartPanel {...panelProps} />
      </Modal>
      {done && <SaleDone sale={done.sale} change={done.change} onClose={() => setDone(null)} />}
    </div>
  );
}
