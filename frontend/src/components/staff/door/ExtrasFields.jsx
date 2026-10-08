import clsx from 'clsx';
import { Input, Segmented, Switch } from '../../ui';
import { formatCOP } from '../../../lib/format';
import { normalizePlate } from './doorUtils';

/**
 * Vehículo (Sin vehículo / Carro / Moto + placa) y casco (Switch + ficha).
 * value: { vehicleType: ''|'carro'|'moto', plate, helmet: boolean, tag }
 * Con `showReturned`, agrega el interruptor "Casco devuelto" (edición de una entrada).
 */
export default function ExtrasFields({ value, onChange, config, errors = {}, showReturned = false, className }) {
  const set = (patch) => onChange({ ...value, ...patch });
  const parking = config?.parking || {};

  const vehicleOptions = [
    { value: '', label: 'Sin vehículo' },
    { value: 'carro', label: 'Carro', hint: parking.carro ? `+${formatCOP(parking.carro)}` : undefined },
    { value: 'moto', label: 'Moto', hint: parking.moto ? `+${formatCOP(parking.moto)}` : undefined },
  ];

  return (
    <div className={clsx('flex flex-col gap-4', className)}>
      <div>
        <p className="mb-2 text-sm font-medium text-bone/90">Vehículo</p>
        <Segmented
          options={vehicleOptions}
          value={value.vehicleType}
          onChange={(v) => set({ vehicleType: v })}
          columns={3}
          ariaLabel="Vehículo"
          className="[&>button]:min-h-14"
        />
      </div>

      <Switch
        checked={value.helmet}
        onChange={(v) => set({ helmet: v, ...(v ? {} : { returned: false }) })}
        label="Guardar casco"
        description={parking.casco ? `Se entrega una ficha · +${formatCOP(parking.casco)}` : 'Se entrega una ficha'}
        className="min-h-14 rounded-xl border border-white/10 bg-tomb/60 px-4 [&>label]:flex-1 [&>label]:py-2"
      />

      {(value.vehicleType || value.helmet) && (
        <div className="grid grid-cols-2 gap-3">
          {value.vehicleType ? (
            <Input
              label="Placa"
              required
              value={value.plate}
              onChange={(e) => set({ plate: normalizePlate(e.target.value).slice(0, 8) })}
              placeholder={value.vehicleType === 'moto' ? 'ABC12D' : 'ABC123'}
              autoCapitalize="characters"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="next"
              error={errors.plate}
              inputClassName="h-14 font-mono text-xl uppercase tracking-[0.12em]"
            />
          ) : (
            <span />
          )}
          {value.helmet ? (
            <Input
              label="Ficha del casco"
              value={value.tag}
              onChange={(e) => set({ tag: e.target.value.slice(0, 20) })}
              placeholder="N.º"
              inputMode="numeric"
              autoComplete="off"
              enterKeyHint="done"
              error={errors.tag}
              inputClassName="h-14 font-mono text-xl tracking-[0.12em]"
            />
          ) : (
            <span />
          )}
        </div>
      )}

      {showReturned && value.helmet && (
        <Switch
          checked={Boolean(value.returned)}
          onChange={(v) => set({ returned: v })}
          label="Casco devuelto"
          description="Actívalo cuando la persona recoja su casco"
          className="min-h-14 rounded-xl border border-white/10 bg-tomb/60 px-4 [&>label]:flex-1 [&>label]:py-2"
        />
      )}
    </div>
  );
}
