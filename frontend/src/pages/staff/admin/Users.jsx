import { useState } from 'react';
import { Pencil, Plus, Trash2, UserCog } from 'lucide-react';
import { Badge, Button, EmptyState, Input, Modal, PageSpinner, Segmented, Switch, useToast } from '../../../components/ui';
import { staffApi } from '../../../lib/api';
import { useAuth } from '../../../lib/auth';
import { useFetch } from '../../../lib/useFetch';
import { formatRelative } from '../../../lib/format';
import { ROLE_LABEL } from '../../../lib/labels';
import PageHeader from '../../../components/staff/admin/PageHeader';
import ErrorState from '../../../components/staff/admin/ErrorState';
import ConfirmDialog from '../../../components/staff/admin/ConfirmDialog';
import { ROLE_TONE } from '../../../components/staff/admin/utils';

const ROLE_OPTIONS = [
  { value: 'puerta', label: 'Portería', hint: 'Escanea y vende en puerta' },
  { value: 'barra', label: 'Barra', hint: 'Punto de venta' },
  { value: 'admin', label: 'Administrador', hint: 'Acceso total' },
];

function randomPassword() {
  const abc = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (b) => abc[b % abc.length]).join('');
}

function UserForm({ user, isSelf, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ username: '', name: user?.name || '', password: '', role: user?.role || 'puerta', active: user?.active ?? true });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: null }));
  };

  const submit = async (e) => {
    e.preventDefault();
    const err = {};
    if (!user && !/^[a-z0-9._-]{3,30}$/.test(form.username)) err.username = 'De 3 a 30: minúsculas, números, punto, guion.';
    if (form.name.trim().length < 2) err.name = 'Escribe el nombre.';
    if ((!user || form.password) && form.password.length < 8) err.password = 'Mínimo 8 caracteres.';
    if (Object.keys(err).length) return setErrors(err);
    let body;
    if (user) {
      body = { name: form.name.trim() };
      if (!isSelf) Object.assign(body, { role: form.role, active: form.active });
      if (form.password) body.password = form.password;
    } else {
      body = { username: form.username, name: form.name.trim(), password: form.password, role: form.role };
    }
    setSaving(true);
    try {
      await staffApi(user ? `/api/admin/users/${user.id}` : '/api/admin/users', { method: user ? 'PUT' : 'POST', body });
      toast.success(user ? 'Usuario actualizado.' : 'Usuario creado.');
      onSaved();
    } catch (ex) {
      setErrors(ex.code === 'USERNAME_TAKEN' ? { username: ex.message } : ex.details?.fields || {});
      toast.error(ex.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={user ? `Editar @${user.username}` : 'Crear usuario'}
      footer={
        <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button type="submit" form="user-form" loading={saving}>Guardar</Button>
        </div>
      }
    >
      <form id="user-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
        {!user && (
          <Input label="Usuario" required autoCapitalize="none" autoComplete="off" value={form.username}
            onChange={(e) => set('username', e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))} error={errors.username} hint="Con este entra al panel." />
        )}
        <Input label="Nombre" required value={form.name} onChange={(e) => set('name', e.target.value)} error={errors.name} placeholder="Ej.: Puerta 1" />
        <Input
          label={user ? 'Nueva contraseña (opcional)' : 'Contraseña'}
          type="text"
          autoComplete="new-password"
          value={form.password}
          onChange={(e) => set('password', e.target.value)}
          error={errors.password}
          hint="Mínimo 8 caracteres. Compártela por privado."
          trailing={<button type="button" className="h-9 rounded-lg px-2 text-xs font-semibold text-pumpkin-light hover:bg-white/5" onClick={() => set('password', randomPassword())}>Generar</button>}
        />
        {!isSelf && (
          <div className="flex flex-col gap-1.5">
            <p className="text-sm font-medium text-bone/90">Rol</p>
            <Segmented options={ROLE_OPTIONS} value={form.role} onChange={(v) => set('role', v)} minWidth={130} ariaLabel="Rol" />
          </div>
        )}
        {user && !isSelf && (
          <div className="rounded-2xl border border-white/8 bg-tomb/40 p-4">
            <Switch label="Activo" description="Si lo desactivas no podrá iniciar sesión." checked={form.active} onChange={(v) => set('active', v)} />
          </div>
        )}
        {isSelf && <p className="text-xs text-smoke">Es tu cuenta: no puedes cambiar tu rol ni desactivarte.</p>}
      </form>
    </Modal>
  );
}

export default function Users() {
  const toast = useToast();
  const { user: me } = useAuth();
  const list = useFetch((signal) => staffApi('/api/admin/users', { signal }), []);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const remove = async () => {
    try {
      await staffApi(`/api/admin/users/${deleting.id}`, { method: 'DELETE' });
      toast.success('Usuario eliminado.');
      setDeleting(null);
      list.reload({ silent: true });
    } catch (err) {
      toast.error(err.message);
      throw err;
    }
  };

  const items = list.data?.items || [];
  return (
    <div>
      <PageHeader
        title="Usuarios"
        description="Cuentas del staff: portería, barra y administradores."
        actions={<Button onClick={() => setEditing('new')}><Plus className="h-4 w-4" />Crear usuario</Button>}
      />
      {!list.data ? (
        list.error ? <ErrorState error={list.error} onRetry={list.reload} /> : <PageSpinner label="Cargando usuarios…" />
      ) : items.length === 0 ? (
        <EmptyState icon={UserCog} title="Sin usuarios" />
      ) : (
        <ul className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
          {items.map((u) => {
            const self = u.id === me?.id;
            return (
              <li key={u.id} className="flex items-start justify-between gap-3 rounded-2xl border border-white/8 bg-crypt/80 p-4">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-bone">{u.name}{self && <span className="ml-2 text-xs font-normal text-smoke">(tú)</span>}</p>
                  <p className="font-mono text-xs text-fog">@{u.username}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge tone={ROLE_TONE[u.role]}>{ROLE_LABEL[u.role] || u.role}</Badge>
                    {!u.active && <Badge tone="neutral">Inactivo</Badge>}
                  </div>
                  <p className="mt-2 text-xs text-smoke">{u.lastLoginAt ? `Último acceso ${formatRelative(u.lastLoginAt)}` : 'Nunca ha entrado'}</p>
                </div>
                <div className="-mr-2 -mt-2 flex">
                  <Button variant="ghost" size="icon" className="h-11 w-11" onClick={() => setEditing(u)} aria-label={`Editar a ${u.name}`}><Pencil className="h-4 w-4" /></Button>
                  {!self && (
                    <Button variant="ghost" size="icon" className="h-11 w-11" onClick={() => setDeleting(u)} aria-label={`Eliminar a ${u.name}`}><Trash2 className="h-4 w-4" /></Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {editing && (
        <UserForm
          user={editing === 'new' ? null : editing}
          isSelf={editing !== 'new' && editing.id === me?.id}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); list.reload({ silent: true }); }}
        />
      )}
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        icon={Trash2}
        title="¿Eliminar usuario?"
        confirmLabel="Eliminar"
        description={deleting && <><strong className="text-bone">{deleting.name}</strong> (@{deleting.username}) ya no podrá entrar al panel.</>}
      />
    </div>
  );
}
