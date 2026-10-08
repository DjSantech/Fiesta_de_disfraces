import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { Pencil, Plus, Trash2, Wallet } from 'lucide-react';
import { Badge, Button, Card, EmptyState, Input, Modal, PageSpinner, Select, Switch, Tabs, Textarea, useToast } from '../../../components/ui';
import { staffApi } from '../../../lib/api';
import { useFetch } from '../../../lib/useFetch';
import { formatCOP, formatDate } from '../../../lib/format';
import { EXPENSE_CATEGORY_LABEL, toOptions } from '../../../lib/labels';
import PageHeader, { SectionTitle } from '../../../components/staff/admin/PageHeader';
import ErrorState from '../../../components/staff/admin/ErrorState';
import CoverageCard from '../../../components/staff/admin/CoverageCard';
import ConfirmDialog from '../../../components/staff/admin/ConfirmDialog';
import ExportMenu from '../../../components/staff/admin/ExportMenu';
import { BarList } from '../../../components/staff/admin/Charts';
import { MoneyInput } from '../../../components/staff/admin/NumberInput';
import { bogotaDateToIso, isoToBogotaDate, todayBogota } from '../../../components/staff/admin/utils';

const CATEGORY_OPTIONS = toOptions(EXPENSE_CATEGORY_LABEL);

function ExpenseForm({ expense, onClose, onSaved, onDelete }) {
  const toast = useToast();
  const [form, setForm] = useState({
    concept: expense?.concept || '',
    category: expense?.category || 'finca',
    amount: expense?.amount ?? null,
    paid: Boolean(expense?.paid),
    dueDate: isoToBogotaDate(expense?.dueDate),
    responsible: expense?.responsible || '',
    notes: expense?.notes || '',
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: null }));
  };

  const submit = async (e) => {
    e.preventDefault();
    const err = {};
    if (form.concept.trim().length < 2) err.concept = 'Escribe el concepto.';
    if (form.amount === null) err.amount = 'Escribe el monto.';
    if (Object.keys(err).length) return setErrors(err);
    const body = {
      concept: form.concept.trim(),
      category: form.category,
      amount: form.amount,
      paid: form.paid,
      dueDate: bogotaDateToIso(form.dueDate),
      responsible: form.responsible.trim(),
      notes: form.notes.trim(),
    };
    setSaving(true);
    try {
      await staffApi(expense ? `/api/admin/expenses/${expense.id}` : '/api/admin/expenses', { method: expense ? 'PUT' : 'POST', body });
      toast.success(expense ? 'Gasto actualizado.' : 'Gasto agregado.');
      onSaved();
    } catch (ex) {
      setErrors(ex.details?.fields || {});
      toast.error(ex.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={expense ? 'Editar gasto' : 'Agregar gasto'}
      footer={
        <div className="flex items-center justify-between gap-2">
          {expense ? (
            <Button variant="ghost" onClick={onDelete} disabled={saving}><Trash2 className="h-4 w-4" />Eliminar</Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
            <Button type="submit" form="expense-form" loading={saving}>Guardar</Button>
          </div>
        </div>
      }
    >
      <form id="expense-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Input label="Concepto" required value={form.concept} onChange={(e) => set('concept', e.target.value)} error={errors.concept} placeholder="Ej.: Alquiler de la finca" />
        <div className="grid grid-cols-2 gap-3">
          <Select label="Categoría" value={form.category} onChange={(e) => set('category', e.target.value)} options={CATEGORY_OPTIONS} error={errors.category} />
          <MoneyInput label="Monto" value={form.amount} onChange={(n) => set('amount', n)} error={errors.amount} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Fecha límite" type="date" value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} error={errors.dueDate} />
          <Input label="Responsable" value={form.responsible} onChange={(e) => set('responsible', e.target.value)} error={errors.responsible} />
        </div>
        <div className="rounded-2xl border border-white/8 bg-tomb/40 p-4">
          <Switch label="Ya está pagado" checked={form.paid} onChange={(v) => set('paid', v)} />
        </div>
        <Textarea label="Notas" rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value.slice(0, 500))} error={errors.notes} />
      </form>
    </Modal>
  );
}

export default function Expenses() {
  const toast = useToast();
  const list = useFetch((signal) => staffApi('/api/admin/expenses', { signal }), []);
  const dash = useFetch((signal) => staffApi('/api/admin/dashboard', { signal }), []);
  const [filter, setFilter] = useState('all');
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const today = todayBogota();

  const reloadAll = () => {
    list.reload({ silent: true });
    dash.reload({ silent: true });
  };

  const items = useMemo(() => {
    const arr = [...(list.data?.items || [])].sort(
      (a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999') || (a.createdAt || '').localeCompare(b.createdAt || ''),
    );
    return arr.filter((x) => filter === 'all' || (filter === 'paid' ? x.paid : !x.paid));
  }, [list.data, filter]);

  const togglePaid = async (x) => {
    list.setData((d) => ({ ...d, items: d.items.map((i) => (i.id === x.id ? { ...i, paid: !x.paid } : i)) }));
    try {
      await staffApi(`/api/admin/expenses/${x.id}`, { method: 'PUT', body: { paid: !x.paid } });
      reloadAll();
    } catch (err) {
      toast.error(err.message);
      list.reload({ silent: true });
    }
  };

  const remove = async () => {
    try {
      await staffApi(`/api/admin/expenses/${deleting.id}`, { method: 'DELETE' });
      toast.success('Gasto eliminado.');
      setDeleting(null);
      setEditing(null);
      reloadAll();
    } catch (err) {
      toast.error(err.message);
      throw err;
    }
  };

  const totals = list.data?.totals;
  const byCat = totals
    ? Object.entries(totals.byCategory || {})
        .filter(([, v]) => v > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => ({ key: k, label: EXPENSE_CATEGORY_LABEL[k] || k, value: v, color: 'bg-ember' }))
    : [];

  return (
    <div>
      <PageHeader
        title="Gastos a librar"
        description="Todo lo que cuesta la fiesta. Cuando los ingresos los cubren, los gastos quedan librados."
        actions={
          <>
            <Button onClick={() => setEditing('new')}><Plus className="h-4 w-4" />Agregar gasto</Button>
            <ExportMenu options={[{ dataset: 'expenses', slug: 'gastos', label: 'Gastos' }]} label="Exportar CSV" />
          </>
        }
      />
      {!list.data ? (
        list.error ? <ErrorState error={list.error} onRetry={list.reload} /> : <PageSpinner label="Cargando gastos…" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-12">
          <div className="flex flex-col gap-4 lg:col-span-5">
            {dash.data && (
              <CoverageCard
                income={dash.data.income.total}
                expenses={dash.data.expenses.total}
                coveredPercent={dash.data.balance.coveredPercent}
                net={dash.data.balance.net}
              />
            )}
            <Card className="flex flex-col gap-4">
              <SectionTitle icon={Wallet}>Totales</SectionTitle>
              <div className="grid grid-cols-3 gap-2">
                {[['Total', totals.total, 'text-bone'], ['Pagados', totals.paid, 'text-toxic'], ['Pendientes', totals.pending, 'text-gold']].map(([l, v, c]) => (
                  <div key={l} className="min-w-0"><p className="text-xs text-smoke">{l}</p><p className={clsx('truncate font-semibold tabular-nums', c)}>{formatCOP(v)}</p></div>
                ))}
              </div>
              <BarList items={byCat} emptyText="Sin gastos todavía" />
            </Card>
          </div>
          <div className="flex flex-col gap-3 lg:col-span-7">
            <Tabs
              value={filter}
              onChange={setFilter}
              ariaLabel="Filtrar gastos"
              tabs={[{ value: 'all', label: 'Todos' }, { value: 'pending', label: 'Pendientes' }, { value: 'paid', label: 'Pagados' }]}
            />
            {items.length === 0 ? (
              <EmptyState icon={Wallet} title="Sin gastos aquí" description="Registra alquiler, sonido, DJs, decoración…" />
            ) : (
              <ul className="flex flex-col gap-2.5">
                {items.map((x) => {
                  const due = isoToBogotaDate(x.dueDate);
                  const overdue = !x.paid && due && due < today;
                  return (
                    <li key={x.id} className="rounded-2xl border border-white/8 bg-crypt/80 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <button type="button" onClick={() => setEditing(x)} className="min-w-0 flex-1 text-left">
                          <p className="font-semibold text-bone">{x.concept}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-fog">
                            <Badge>{EXPENSE_CATEGORY_LABEL[x.category] || x.category}</Badge>
                            {x.responsible && <span>{x.responsible}</span>}
                            {due && <span className={overdue ? 'font-semibold text-danger-light' : ''}>{overdue ? 'Venció' : 'Vence'} {formatDate(x.dueDate)}</span>}
                          </div>
                          {x.notes && <p className="mt-1.5 line-clamp-2 text-xs text-smoke">{x.notes}</p>}
                        </button>
                        <div className="flex shrink-0 flex-col items-end gap-2">
                          <p className="text-lg font-bold tabular-nums text-bone">{formatCOP(x.amount)}</p>
                          <div className="flex items-center gap-2">
                            <span className={clsx('text-xs font-medium', x.paid ? 'text-toxic' : 'text-gold')}>{x.paid ? 'Pagado' : 'Pendiente'}</span>
                            <Switch checked={x.paid} onChange={() => togglePaid(x)} />
                            <Button variant="ghost" size="icon" className="h-11 w-11" onClick={() => setEditing(x)} aria-label="Editar"><Pencil className="h-4 w-4" /></Button>
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
      {editing && (
        <ExpenseForm
          expense={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); reloadAll(); }}
          onDelete={() => setDeleting(editing)}
        />
      )}
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        icon={Trash2}
        title="¿Eliminar este gasto?"
        confirmLabel="Eliminar"
        description={deleting && <><strong className="text-bone">{deleting.concept}</strong> · {formatCOP(deleting.amount)}</>}
      />
    </div>
  );
}
