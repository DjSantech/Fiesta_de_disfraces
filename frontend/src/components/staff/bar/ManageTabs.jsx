import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { Ban, Boxes, Pencil, Plus, Trash2 } from 'lucide-react';
import { Badge, Button, Card, EmptyState, Input, Modal, PageSpinner, Select, Stat, Switch, useToast } from '../../ui';
import { fieldError } from '../../../lib/api';
import { useFetch } from '../../../lib/useFetch';
import { formatCOP, formatNumber, formatTime } from '../../../lib/format';
import { POS_METHOD_LABEL, PRODUCT_CATEGORY_LABEL, toOptions } from '../../../lib/labels';
import { CATEGORY_COLOR, LOW_STOCK, MoneyInput, barApi } from './barUtils';
import { LoadError, LoadMore, Overline, ReasonModal, RefreshLine } from '../door/shared/OpsUi';
import { usePagedList, useSingleFlight } from '../door/shared/hooks';
import { errorMessage } from '../door/shared/errors';

const num = (v) => (v === '' || v === null || v === undefined ? null : Number(v));

function ProductModal({ product, onClose, onSaved }) {
  const toast = useToast();
  const isNew = !product.id;
  const [f, setF] = useState({
    name: product.name || '',
    category: product.category || 'cocteles',
    price: product.price ?? '',
    cost: product.cost ?? '',
    stock: product.stock ?? '',
    active: product.active ?? true,
    sortOrder: product.sortOrder ?? 0,
  });
  const [err, setErr] = useState(null);
  const [busy, run] = useSingleFlight();
  const set = (p) => setF((x) => ({ ...x, ...p }));

  const save = () =>
    run(async () => {
      if (f.name.trim().length < 2 || f.price === '') {
        setErr({ details: { fields: { ...(f.name.trim().length < 2 && { name: 'Mínimo 2 caracteres' }), ...(f.price === '' && { price: 'Escribe el precio' }) } } });
        return;
      }
      const body = { name: f.name.trim(), category: f.category, price: Number(f.price), active: f.active, sortOrder: Number(f.sortOrder) || 0 };
      if (!isNew || f.cost !== '') body.cost = num(f.cost);
      if (!isNew || f.stock !== '') body.stock = num(f.stock);
      try {
        const data = isNew ? await barApi.createProduct(body) : await barApi.updateProduct(product.id, body);
        toast.success(isNew ? 'Producto creado' : 'Producto guardado');
        onSaved(data.product);
      } catch (e) {
        setErr(e);
        toast.error(errorMessage(e));
      }
    });

  return (
    <Modal
      open
      onClose={busy ? undefined : onClose}
      title={isNew ? 'Nuevo producto' : `Editar · ${product.name}`}
      footer={
        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" size="lg" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button size="lg" onClick={save} loading={busy}>Guardar</Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Input label="Nombre" required maxLength={60} value={f.name} onChange={(e) => set({ name: e.target.value })} error={fieldError(err, 'name')} />
        <Select label="Categoría" options={toOptions(PRODUCT_CATEGORY_LABEL)} value={f.category} onChange={(e) => set({ category: e.target.value })} error={fieldError(err, 'category')} />
        <div className="grid grid-cols-2 gap-3">
          <MoneyInput label="Precio" required value={f.price} onChange={(v) => set({ price: v })} error={fieldError(err, 'price')} />
          <MoneyInput label="Costo" hint="Opcional" value={f.cost} onChange={(v) => set({ cost: v })} error={fieldError(err, 'cost')} />
          <Input label="Stock" hint="Vacío = sin control" inputMode="numeric" value={f.stock} onChange={(e) => set({ stock: e.target.value.replace(/[^\d-]/g, '') })} error={fieldError(err, 'stock')} />
          <Input label="Orden" hint="Menor sale primero" inputMode="numeric" value={f.sortOrder} onChange={(e) => set({ sortOrder: e.target.value.replace(/\D/g, '') })} />
        </div>
        <Switch label="Activo" description="Aparece en el punto de venta" checked={f.active} onChange={(v) => set({ active: v })} className="min-h-12 [&>label]:flex-1" />
      </div>
    </Modal>
  );
}

function StockModal({ product, onClose, onSaved }) {
  const toast = useToast();
  const [value, setValue] = useState(String(product.stock ?? ''));
  const [busy, run] = useSingleFlight();
  const n = Number(value || 0);
  const save = (stock) =>
    run(async () => {
      try {
        const data = await barApi.updateProduct(product.id, { stock });
        toast.success('Stock actualizado');
        onSaved(data.product);
      } catch (e) {
        toast.error(errorMessage(e));
      }
    });
  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={`Stock · ${product.name}`}
      description={`Actual: ${product.stock ?? 'sin control'}`}
      footer={<Button size="lg" block loading={busy} onClick={() => save(value === '' ? null : n)}>Guardar</Button>}
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-5 gap-2">
          {[-1, 1, 6, 12, 24].map((d) => (
            <Button key={d} variant="secondary" size="lg" className="px-0" onClick={() => setValue(String(n + d))}>{d > 0 ? `+${d}` : d}</Button>
          ))}
        </div>
        <Input label="Nuevo stock" inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value.replace(/[^\d-]/g, ''))} inputClassName="h-14 text-2xl font-bold" />
        <Button variant="ghost" onClick={() => save(null)} disabled={busy}>Quitar control de inventario</Button>
      </div>
    </Modal>
  );
}

export function ProductsTab({ active, onChanged }) {
  const toast = useToast();
  const { data, error, loading, reload, setData } = useFetch((s) => barApi.products(true, s), []);
  const [editing, setEditing] = useState(null);
  const [stockOf, setStockOf] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, run] = useSingleFlight();
  useEffect(() => {
    if (active) reload({ silent: true });
  }, [active, reload]);

  const saved = (p) => {
    setData((d) => ({ items: d.items.some((i) => i.id === p.id) ? d.items.map((i) => (i.id === p.id ? p : i)) : [...d.items, p] }));
    setEditing(null);
    setStockOf(null);
    onChanged?.();
  };
  const remove = () =>
    run(async () => {
      try {
        await barApi.deleteProduct(deleting.id);
        setData((d) => ({ items: d.items.filter((i) => i.id !== deleting.id) }));
        toast.success('Producto eliminado');
        setDeleting(null);
        onChanged?.();
      } catch (e) {
        toast.error(errorMessage(e));
      }
    });

  if (loading && !data) return <PageSpinner label="Cargando productos…" />;
  if (!data) return <LoadError error={error} onRetry={reload} />;
  const groups = Object.keys(PRODUCT_CATEGORY_LABEL).map((c) => [c, data.items.filter((p) => p.category === c)]).filter(([, l]) => l.length);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-fog">{data.items.length} productos</p>
        <Button size="lg" onClick={() => setEditing({})}><Plus className="h-5 w-5" /> Nuevo producto</Button>
      </div>
      {!groups.length && <EmptyState icon={Boxes} title="Sin productos" description="Crea el primero." />}
      {groups.map(([c, items]) => (
        <section key={c} className="flex flex-col gap-2">
          <p className="flex items-center gap-2 font-semibold text-bone">
            <span className="h-3 w-3 rounded-full" style={{ background: CATEGORY_COLOR[c] }} /> {PRODUCT_CATEGORY_LABEL[c]}
            <span className="text-sm font-normal text-smoke">{items.length}</span>
          </p>
          <div className="grid gap-2 lg:grid-cols-2">
            {items.map((p) => (
              <Card key={p.id} padding="sm" className={clsx('flex flex-col gap-2', !p.active && 'opacity-60')}>
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 font-bold text-bone">{p.name} {!p.active && <Badge className="ml-1">Inactivo</Badge>}</p>
                  <p className="shrink-0 text-lg font-extrabold tabular-nums">{formatCOP(p.price)}</p>
                </div>
                <p className="text-sm text-fog">
                  {p.cost !== null && p.cost !== undefined ? `Costo ${formatCOP(p.cost)} · ganancia ${formatCOP(p.price - p.cost)} · ` : 'Sin costo · '}
                  {formatNumber(p.soldQty)} vendidos
                </p>
                <div className="flex gap-2">
                  <Button variant="secondary" size="lg" className={clsx('flex-1', p.stock !== null && p.stock <= LOW_STOCK && 'text-gold')} onClick={() => setStockOf(p)}>
                    {p.stock === null || p.stock === undefined ? 'Sin control' : `Stock ${p.stock}`}
                  </Button>
                  <Button variant="secondary" size="lg" onClick={() => setEditing(p)} aria-label="Editar"><Pencil className="h-4 w-4" /> Editar</Button>
                  <Button variant="danger" size="lg" onClick={() => setDeleting(p)} aria-label="Eliminar"><Trash2 className="h-4 w-4" /></Button>
                </div>
              </Card>
            ))}
          </div>
        </section>
      ))}
      {editing && <ProductModal product={editing} onClose={() => setEditing(null)} onSaved={saved} />}
      {stockOf && <StockModal product={stockOf} onClose={() => setStockOf(null)} onSaved={saved} />}
      <Modal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        size="sm"
        title={`¿Eliminar ${deleting?.name}?`}
        description="Deja de aparecer en la barra. Sus ventas se conservan."
        footer={
          <div className="grid grid-cols-2 gap-3">
            <Button variant="secondary" size="lg" onClick={() => setDeleting(null)}>Cancelar</Button>
            <Button size="lg" loading={busy} onClick={remove}>Eliminar</Button>
          </div>
        }
      />
    </div>
  );
}

export function SalesTab({ active, onChanged }) {
  const toast = useToast();
  const [includeVoided, setIncludeVoided] = useState(false);
  const [voiding, setVoiding] = useState(null);
  const list = usePagedList((page, limit, s) => barApi.sales(page, limit, includeVoided, s), [includeVoided], { limit: 30 });
  useEffect(() => {
    if (active) list.reload({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const confirmVoid = async (reason) => {
    try {
      const data = await barApi.voidSale(voiding.id, reason);
      list.updateItem(data.sale);
      toast.success(`Venta #${voiding.number} anulada · stock devuelto`);
      setVoiding(null);
      onChanged?.();
    } catch (e) {
      toast.error(errorMessage(e));
      throw e;
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <Switch checked={includeVoided} onChange={setIncludeVoided} label="Incluir anuladas" className="min-h-12 [&>label]:flex-1" />
      <RefreshLine loadedAt={list.loadedAt} onRefresh={() => list.reload({ silent: true })} refreshing={list.loading} />
      {list.loading && !list.items.length ? (
        <PageSpinner label="Cargando ventas…" />
      ) : list.error && !list.items.length ? (
        <LoadError error={list.error} onRetry={list.reload} />
      ) : !list.items.length ? (
        <EmptyState title="Aún no hay ventas" />
      ) : (
        <div className="grid gap-2 lg:grid-cols-2">
          {list.items.map((s) => (
            <Card key={s.id} padding="sm" className={clsx('flex flex-col gap-1.5', s.voided && 'opacity-55')}>
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-display text-2xl text-bone">#{s.number}</p>
                <p className="text-sm text-fog">{formatTime(s.createdAt)} · {s.createdBy?.name}</p>
              </div>
              <p className="text-sm text-bone/90">{s.items.map((i) => `${i.qty}× ${i.name}`).join(' · ')}</p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xl font-extrabold tabular-nums">{formatCOP(s.total)}</span>
                <Badge tone={s.paymentMethod === 'cortesia' ? 'violet' : 'neutral'}>{POS_METHOD_LABEL[s.paymentMethod]}</Badge>
                {s.paymentMethod === 'cortesia' && <span className="text-xs text-fog">valor {formatCOP(s.courtesyValue)}</span>}
                {s.voided && <Badge tone="red">Anulada</Badge>}
                {!s.voided && (
                  <Button variant="danger" size="md" className="ml-auto h-12" onClick={() => setVoiding(s)}><Ban className="h-4 w-4" /> Anular</Button>
                )}
              </div>
              {s.voided && s.voidReason && <p className="text-sm text-danger-light">Motivo: {s.voidReason}</p>}
            </Card>
          ))}
        </div>
      )}
      <LoadMore list={list} />
      <ReasonModal
        open={Boolean(voiding)}
        onClose={() => setVoiding(null)}
        title={`Anular venta #${voiding?.number ?? ''}`}
        description="El stock de sus productos se devuelve."
        confirmLabel="Anular venta"
        quickReasons={['Error al cobrar', 'Venta duplicada', 'El cliente devolvió']}
        onConfirm={confirmVoid}
      />
    </div>
  );
}

function Bar({ label, value, sub, share, color }) {
  return (
    <div className="py-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 text-bone">{label}</span>
        <span className="shrink-0 font-bold tabular-nums">{value}</span>
      </div>
      {sub && <p className="text-xs text-fog">{sub}</p>}
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div className="h-full rounded-full" style={{ width: `${Math.round((share || 0) * 100)}%`, background: color || '#ff6a00' }} />
      </div>
    </div>
  );
}

export function SummaryTab() {
  const { data: s, error, loading, reload } = useFetch((sig) => barApi.summary(sig), [], { interval: 30000 });
  const [at, setAt] = useState(null);
  useEffect(() => {
    if (s) setAt(Date.now());
  }, [s]);
  if (loading && !s) return <PageSpinner label="Cargando resumen…" />;
  if (!s) return <LoadError error={error} onRetry={reload} />;
  const total = s.total || 0;
  const withCost = s.byProduct.filter((p) => p.profit !== null && p.profit !== undefined);
  return (
    <div className="flex flex-col gap-4">
      <RefreshLine loadedAt={at} onRefresh={() => reload({ silent: true })} />
      <Card className="bg-gradient-to-br from-crypt to-tomb">
        <Overline>Total vendido</Overline>
        <p className="mt-2 text-5xl font-extrabold tabular-nums">{formatCOP(total)}</p>
        <p className="mt-1 text-sm text-fog">{formatNumber(s.count)} ventas · promedio {formatCOP(s.count ? total / s.count : 0)}</p>
      </Card>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {['efectivo', 'nequi', 'breb', 'tarjeta'].map((k) => (
          <Stat key={k} label={POS_METHOD_LABEL[k]} value={formatCOP(s.byMethod?.[k])} tone={k === 'efectivo' ? 'green' : 'neutral'} />
        ))}
        <Stat label="Cortesías" value={formatNumber(s.courtesy?.count)} hint={`Valor ${formatCOP(s.courtesy?.value)}`} tone="violet" className="col-span-2 lg:col-span-1" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card padding="sm">
          <Overline className="mb-1">Por categoría</Overline>
          {s.byCategory.map((c) => (
            <Bar key={c.category} label={PRODUCT_CATEGORY_LABEL[c.category]} value={formatCOP(c.revenue)} sub={`${formatNumber(c.qty)} und.`} share={total ? c.revenue / total : 0} color={CATEGORY_COLOR[c.category]} />
          ))}
        </Card>
        <Card padding="sm">
          <Overline className="mb-1">Por producto</Overline>
          {withCost.length > 0 && (
            <p className="mb-1 text-sm text-fog">Ganancia (productos con costo): <b className="text-toxic">{formatCOP(withCost.reduce((a, p) => a + p.profit, 0))}</b></p>
          )}
          {[...s.byProduct].sort((a, b) => b.revenue - a.revenue).map((p) => (
            <Bar
              key={p.productId}
              label={p.name}
              value={formatCOP(p.revenue)}
              sub={`${formatNumber(p.qty)} und.${p.profit !== null && p.profit !== undefined ? ` · costo ${formatCOP(p.cost)} · ganancia ${formatCOP(p.profit)}` : ''}`}
              share={total ? p.revenue / total : 0}
              color={CATEGORY_COLOR[p.category]}
            />
          ))}
        </Card>
      </div>
    </div>
  );
}
