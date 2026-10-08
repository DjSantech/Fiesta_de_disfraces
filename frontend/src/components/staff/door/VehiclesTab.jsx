import { useCallback, useEffect, useMemo, useState } from 'react';
import { Car, HardHat, Motorbike, Search, Undo2 } from 'lucide-react';
import { Button, Card, EmptyState, Input, PageSpinner, Segmented } from '../../ui';
import { formatTime } from '../../../lib/format';
import { useFetch } from '../../../lib/useFetch';
import { compareTags, doorApi } from './doorUtils';
import { useEntryActions } from './LogTab';
import { LoadError, RefreshLine } from './shared/OpsUi';

/** Placas y cascos sin devolver, para cuando la gente se va. Filtra en el cliente (placa, ficha o nombre). */
export default function VehiclesTab({ active, onChanged }) {
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const { data, error, loading, reload, setData } = useFetch(
    async (signal) => {
      const [v, h] = await Promise.all([
        doorApi.entries({ vehicle: 'any', limit: 200 }, signal),
        doorApi.entries({ helmet: 'stored', limit: 200 }, signal),
      ]);
      const map = new Map();
      [...v.items, ...h.items].forEach((e) => !e.voided && map.set(e.id, e));
      return { items: [...map.values()], at: Date.now() };
    },
    [],
    { interval: active ? 30000 : undefined },
  );

  useEffect(() => {
    if (active) reload({ silent: true });
  }, [active, reload]);

  const onUpdated = useCallback((entry) => setData((d) => d && { ...d, items: d.items.map((i) => (i.id === entry.id ? entry : i)) }), [setData]);
  const actions = useEntryActions({ onUpdated, onChanged });

  const items = data?.items || [];
  const counts = {
    carro: items.filter((e) => e.vehicle?.type === 'carro').length,
    moto: items.filter((e) => e.vehicle?.type === 'moto').length,
    helmets: items.filter((e) => e.helmet?.stored && !e.helmet.returned).length,
  };
  const shown = useMemo(() => {
    const term = q.trim().toUpperCase().replace(/[\s-]/g, '');
    let list = items.filter((e) =>
      filter === 'all' ? e.vehicle?.type || (e.helmet?.stored && !e.helmet.returned) : filter === 'helmets' ? e.helmet?.stored && !e.helmet.returned : e.vehicle?.type === filter,
    );
    if (term)
      list = list.filter(
        (e) => (e.vehicle?.plate || '').includes(term) || String(e.helmet?.tag || '').toUpperCase() === term || e.name.toUpperCase().includes(q.trim().toUpperCase()),
      );
    return [...list].sort((a, b) =>
      filter === 'helmets' ? compareTags(a.helmet?.tag, b.helmet?.tag) : String(a.vehicle?.plate || 'ZZZ').localeCompare(String(b.vehicle?.plate || 'ZZZ')),
    );
  }, [items, filter, q]);

  return (
    <div className="flex flex-col gap-3">
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Placa, ficha o nombre"
        leading={<Search className="h-5 w-5" />}
        inputClassName="h-14 text-lg uppercase placeholder:normal-case"
        autoCapitalize="characters"
        autoComplete="off"
        aria-label="Buscar placa o ficha"
      />
      <Segmented
        value={filter}
        onChange={setFilter}
        columns={4}
        ariaLabel="Filtro"
        options={[
          { value: 'all', label: 'Todo' },
          { value: 'carro', label: 'Carros', hint: String(counts.carro) },
          { value: 'moto', label: 'Motos', hint: String(counts.moto) },
          { value: 'helmets', label: 'Cascos', hint: String(counts.helmets) },
        ]}
      />
      <RefreshLine loadedAt={data?.at} onRefresh={() => reload({ silent: true })} refreshing={loading} />
      {loading && !data ? (
        <PageSpinner label="Cargando vehículos…" />
      ) : error && !data ? (
        <LoadError error={error} onRetry={reload} />
      ) : !shown.length ? (
        <EmptyState icon={Car} title="Nada por aquí" description={q ? `Sin coincidencias para «${q}».` : 'No hay vehículos ni cascos guardados.'} />
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {shown.map((e) => {
            const Icon = e.vehicle?.type === 'moto' ? Motorbike : Car;
            const pendingHelmet = e.helmet?.stored && !e.helmet.returned;
            return (
              <Card key={e.id} padding="sm" className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  {e.vehicle?.type ? (
                    <>
                      <Icon className="h-7 w-7 shrink-0 text-fog" />
                      <span className="font-mono text-2xl font-bold tracking-[0.12em] text-bone">{e.vehicle.plate || '—'}</span>
                    </>
                  ) : (
                    <HardHat className="h-7 w-7 shrink-0 text-fog" />
                  )}
                  {pendingHelmet && (
                    <span className="ml-auto rounded-xl bg-gold/15 px-3 py-1 font-mono text-xl font-bold text-gold">Ficha {e.helmet.tag || '—'}</span>
                  )}
                </div>
                <p className="text-sm text-fog">
                  {e.name} · entró {formatTime(e.createdAt)}
                </p>
                {pendingHelmet && (
                  <Button variant="success" size="lg" block loading={actions.returningId === e.id} onClick={() => actions.returnHelmet(e)}>
                    <Undo2 className="h-5 w-5" /> Devolver casco
                  </Button>
                )}
              </Card>
            );
          })}
        </div>
      )}
      {actions.modals(null)}
    </div>
  );
}
