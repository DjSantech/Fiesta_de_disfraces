import { useMemo, useState } from 'react';
import { ClipboardPaste, ListChecks, Pencil, Plus, SearchX, Trash2 } from 'lucide-react';
import { Badge, Button, EmptyState, Input, Modal, PageSpinner, Tabs, Textarea, useToast } from '../../../components/ui';
import { staffApi } from '../../../lib/api';
import { useFetch } from '../../../lib/useFetch';
import PageHeader from '../../../components/staff/admin/PageHeader';
import ErrorState from '../../../components/staff/admin/ErrorState';
import SearchInput from '../../../components/staff/admin/SearchInput';
import ConfirmDialog from '../../../components/staff/admin/ConfirmDialog';
import OrderDetailModal from '../../../components/staff/admin/OrderDetailModal';
import { IntegerInput } from '../../../components/staff/admin/NumberInput';
import { InstagramLink } from '../../../components/staff/admin/Contact';
import { formatPhone, normalizeSearch } from '../../../components/staff/admin/utils';

const FIELDS = ['name', 'cedula', 'phone', 'instagram', 'discountPercent', 'note'];

function GuestForm({ guest, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({
    name: guest?.name || '',
    cedula: guest?.cedula || '',
    phone: guest?.phone || '',
    instagram: guest?.instagram || '',
    discountPercent: guest?.discountPercent ?? null,
    note: guest?.note || '',
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
    if (form.name.trim().length < 2) err.name = 'Escribe el nombre.';
    if (!form.cedula.trim() && !form.phone.trim() && !form.instagram.trim()) err.cedula = 'Pon al menos cédula, celular o Instagram.';
    if (Object.keys(err).length) return setErrors(err);
    const body = {
      name: form.name.trim(),
      cedula: form.cedula.trim() || null,
      phone: form.phone.trim() || null,
      instagram: form.instagram.trim().replace(/^@/, '') || null,
      discountPercent: form.discountPercent,
      note: form.note.trim(),
    };
    setSaving(true);
    try {
      const res = await staffApi(guest ? `/api/admin/guests/${guest.id}` : '/api/admin/guests', { method: guest ? 'PUT' : 'POST', body });
      toast.success(guest ? 'Invitado actualizado.' : 'Invitado agregado.');
      onSaved(res.guest);
    } catch (ex) {
      setErrors(Object.fromEntries(FIELDS.map((f) => [f, ex.details?.fields?.[f]])));
      toast.error(ex.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={guest ? 'Editar invitado' : 'Agregar invitado'}
      description="Si al comprar coincide la cédula, el celular o el Instagram, se aplica el descuento solo."
      footer={
        <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button type="submit" form="guest-form" loading={saving}>Guardar</Button>
        </div>
      }
    >
      <form id="guest-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Input label="Nombre" required value={form.name} onChange={(e) => set('name', e.target.value)} error={errors.name} autoComplete="off" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Input label="Cédula" value={form.cedula} onChange={(e) => set('cedula', e.target.value)} error={errors.cedula} autoComplete="off" />
          <Input label="Celular" type="tel" inputMode="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} error={errors.phone} autoComplete="off" />
          <Input label="Instagram" leading="@" autoCapitalize="none" value={form.instagram} onChange={(e) => set('instagram', e.target.value.replace(/^@/, ''))} error={errors.instagram} autoComplete="off" />
        </div>
        <IntegerInput
          label="Descuento propio % (opcional)"
          suffix="%"
          max={100}
          maxDigits={3}
          placeholder="Vacío = regla general"
          value={form.discountPercent}
          onChange={(n) => set('discountPercent', n)}
          error={errors.discountPercent}
          hint="Vacío = regla general de Ajustes. 100 = Cortesía (entrada gratis)."
        />
        <Textarea label="Nota" rows={2} value={form.note} onChange={(e) => set('note', e.target.value)} error={errors.note} />
      </form>
    </Modal>
  );
}

function BulkModal({ onClose, onDone }) {
  const toast = useToast();
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);
  const lines = text.split('\n').filter((l) => l.trim()).length;

  const submit = async () => {
    setSaving(true);
    try {
      const res = await staffApi('/api/admin/guests/bulk', { method: 'POST', body: { text } });
      setResult(res);
      onDone();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Pegar lista de invitados"
      footer={
        <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
          {result ? (
            <>
              <Button variant="secondary" onClick={() => { setResult(null); setText(''); }}>Pegar otra lista</Button>
              <Button onClick={onClose}>Listo</Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
              <Button onClick={submit} loading={saving} disabled={!lines}>Agregar {lines || ''}</Button>
            </>
          )}
        </div>
      }
    >
      {result ? (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl border border-toxic/25 bg-toxic/5 p-3"><p className="text-2xl font-bold text-toxic">{result.created}</p><p className="text-xs text-fog">creados</p></div>
            <div className="rounded-xl border border-white/10 bg-white/4 p-3"><p className="text-2xl font-bold text-bone">{result.skipped}</p><p className="text-xs text-fog">omitidos (ya estaban)</p></div>
            <div className="rounded-xl border border-danger/25 bg-danger/5 p-3"><p className="text-2xl font-bold text-danger-light">{result.errors?.length || 0}</p><p className="text-xs text-fog">con error</p></div>
          </div>
          {result.errors?.length > 0 && (
            <ul className="flex flex-col gap-1.5 text-sm">
              {result.errors.map((e) => (
                <li key={e.line} className="text-fog"><span className="font-semibold text-danger-light">Línea {e.line}:</span> {e.message}</li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-fog">
            Una persona por línea, en este orden: <strong className="text-bone">nombre, cédula, celular, instagram</strong>. Separa con coma, punto y
            coma o tabulación (sirve pegar columnas de Excel). Deja vacío lo que no tengas, pero cada persona necesita cédula, celular o Instagram.
          </p>
          <pre className="overflow-x-auto rounded-xl border border-white/8 bg-tomb/60 p-3 text-xs text-fog">{`Ana Ruiz, 1088111222, 3001112233, @anaruiz
Pedro Gil, , 3109998877,
Sofía Marín, , , @sofimarin`}</pre>
          <Textarea aria-label="Lista" rows={9} textareaClassName="font-mono text-sm" value={text} onChange={(e) => setText(e.target.value)} placeholder="Pega aquí la lista…" hint={`${lines} ${lines === 1 ? 'línea' : 'líneas'}`} />
        </div>
      )}
    </Modal>
  );
}

export default function Guests() {
  const toast = useToast();
  const list = useFetch((signal) => staffApi('/api/admin/guests', { signal }), []);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [editing, setEditing] = useState(null); // guest | 'new'
  const [bulk, setBulk] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [orderId, setOrderId] = useState(null);

  const all = useMemo(() => list.data?.items || [], [list.data]);
  const items = useMemo(() => {
    const q = normalizeSearch(search);
    return all.filter((g) => {
      if (filter === 'used' && !g.redeemed) return false;
      if (filter === 'free' && g.redeemed) return false;
      if (!q) return true;
      return [g.name, g.cedula, g.phone, g.instagram, g.note].some((v) => normalizeSearch(v).includes(q.replace(/^@/, '')));
    });
  }, [all, search, filter]);
  const usedCount = all.filter((g) => g.redeemed).length;

  const remove = async () => {
    try {
      await staffApi(`/api/admin/guests/${deleting.id}`, { method: 'DELETE' });
      toast.success('Invitado eliminado.');
      setDeleting(null);
      list.reload({ silent: true });
    } catch (err) {
      toast.error(err.message);
      throw err;
    }
  };

  const discount = (g) =>
    g.discountPercent !== null && g.discountPercent !== undefined ? (
      <Badge tone={g.discountPercent === 100 ? 'violet' : 'orange'}>{g.discountPercent === 100 ? 'Cortesía (100%)' : `${g.discountPercent}%`}</Badge>
    ) : (
      <span className="text-sm text-fog">Regla general</span>
    );

  const status = (g) =>
    g.redeemed ? (
      g.redeemedOrderId ? (
        <button type="button" onClick={() => setOrderId(g.redeemedOrderId)} className="min-h-9"><Badge tone="green" dot>Ya usó su descuento</Badge></button>
      ) : <Badge tone="green" dot>Ya usó su descuento</Badge>
    ) : <Badge>Sin usar</Badge>;

  const actions = (g) => (
    <div className="flex shrink-0 items-center gap-1">
      <Button variant="ghost" size="icon" className="h-11 w-11" onClick={() => setEditing(g)} aria-label={`Editar a ${g.name}`}><Pencil className="h-4 w-4" /></Button>
      <Button variant="ghost" size="icon" className="h-11 w-11" onClick={() => setDeleting(g)} aria-label={`Eliminar a ${g.name}`}><Trash2 className="h-4 w-4" /></Button>
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Invitados"
        description="Lista con descuento: si la cédula, el celular o el Instagram coinciden al comprar, el descuento se aplica solo (una vez)."
        actions={
          <>
            <Button onClick={() => setEditing('new')}><Plus className="h-4 w-4" />Agregar invitado</Button>
            <Button variant="secondary" onClick={() => setBulk(true)}><ClipboardPaste className="h-4 w-4" />Pegar lista</Button>
          </>
        }
      />
      {!list.data ? (
        list.error ? <ErrorState error={list.error} onRetry={list.reload} /> : <PageSpinner label="Cargando invitados…" />
      ) : (
        <div className="flex flex-col gap-3">
          <Tabs
            value={filter}
            onChange={setFilter}
            ariaLabel="Filtrar invitados"
            tabs={[
              { value: 'all', label: 'Todos', badge: all.length },
              { value: 'free', label: 'Sin usar' },
              { value: 'used', label: 'Ya usaron', badge: usedCount },
            ]}
          />
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar nombre, cédula, celular o @instagram" />
          {items.length === 0 ? (
            all.length ? (
              <EmptyState icon={SearchX} title="Sin resultados" />
            ) : (
              <EmptyState icon={ListChecks} title="La lista está vacía" description="Agrega invitados uno a uno o pega una lista completa." action={<Button onClick={() => setBulk(true)}><ClipboardPaste className="h-4 w-4" />Pegar lista</Button>} />
            )
          ) : (
            <>
              <div className="hidden overflow-hidden rounded-2xl border border-white/8 bg-crypt/60 lg:block">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-white/8 bg-white/2 text-[11px] uppercase tracking-wider text-smoke">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Nombre</th><th className="px-3 py-3 font-semibold">Cédula</th><th className="px-3 py-3 font-semibold">Celular</th>
                      <th className="px-3 py-3 font-semibold">Instagram</th><th className="px-3 py-3 font-semibold">Descuento</th><th className="px-3 py-3 font-semibold">Estado</th><th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {items.map((g) => (
                      <tr key={g.id}>
                        <td className="px-4 py-2"><p className="font-medium text-bone">{g.name}</p>{g.note && <p className="text-xs text-smoke">{g.note}</p>}</td>
                        <td className="px-3 py-2 font-mono text-[13px] text-fog">{g.cedula || '—'}</td>
                        <td className="px-3 py-2 tabular-nums text-fog">{formatPhone(g.phone) || '—'}</td>
                        <td className="px-3 py-2">{g.instagram ? <InstagramLink user={g.instagram} /> : <span className="text-smoke">—</span>}</td>
                        <td className="px-3 py-2">{discount(g)}</td>
                        <td className="px-3 py-2">{status(g)}</td>
                        <td className="px-4 py-2">{actions(g)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ul className="flex flex-col gap-2.5 lg:hidden">
                {items.map((g) => (
                  <li key={g.id} className="rounded-2xl border border-white/8 bg-crypt/80 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-bone">{g.name}</p>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-fog">
                          {g.cedula && <span className="font-mono">CC {g.cedula}</span>}
                          {g.phone && <span>{formatPhone(g.phone)}</span>}
                          {g.instagram && <InstagramLink user={g.instagram} />}
                        </div>
                      </div>
                      <div className="-mr-2 -mt-2">{actions(g)}</div>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">{discount(g)}{status(g)}</div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
      {editing && (
        <GuestForm
          guest={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); list.reload({ silent: true }); }}
        />
      )}
      {bulk && <BulkModal onClose={() => setBulk(false)} onDone={() => list.reload({ silent: true })} />}
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        icon={Trash2}
        title="¿Eliminar de la lista?"
        confirmLabel="Eliminar"
        description={deleting && <>Se quita a <strong className="text-bone">{deleting.name}</strong> de la lista de invitados.{deleting.redeemed && ' Ya usó su descuento: su compra no cambia.'}</>}
      />
      {orderId && <OrderDetailModal orderId={orderId} onClose={() => setOrderId(null)} />}
    </div>
  );
}
