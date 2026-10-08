import { forwardRef } from 'react';
import { Input } from '../../ui';
import { formatNumber } from '../../../lib/format';

function digitsToNumber(raw, maxDigits) {
  const digits = String(raw).replace(/\D/g, '').slice(0, maxDigits);
  return digits === '' ? null : Number(digits);
}

/**
 * Valor en pesos: muestra "20.000" mientras escribes y entrega un entero (o null si está vacío).
 * <MoneyInput label="Precio" value={20000} onChange={(n) => …} />
 */
export const MoneyInput = forwardRef(function MoneyInput({ value, onChange, maxDigits = 10, ...props }, ref) {
  const display = value === null || value === undefined || value === '' ? '' : formatNumber(value);
  return (
    <Input
      ref={ref}
      {...props}
      leading="$"
      inputMode="numeric"
      autoComplete="off"
      inputClassName="tabular-nums"
      value={display}
      onChange={(e) => onChange?.(digitsToNumber(e.target.value, maxDigits))}
    />
  );
});

/**
 * Entero sin separadores (aforo, porcentaje, capacidad). Entrega número o null.
 * <IntegerInput label="Descuento" suffix="%" max={100} value={25} onChange={…} />
 */
export const IntegerInput = forwardRef(function IntegerInput({ value, onChange, max, suffix, maxDigits = 6, ...props }, ref) {
  const display = value === null || value === undefined || value === '' ? '' : String(value);
  return (
    <Input
      ref={ref}
      {...props}
      inputMode="numeric"
      autoComplete="off"
      inputClassName="tabular-nums"
      trailing={suffix ? <span className="pr-1 text-sm text-fog">{suffix}</span> : props.trailing}
      value={display}
      onChange={(e) => {
        let n = digitsToNumber(e.target.value, maxDigits);
        if (n !== null && max !== undefined) n = Math.min(n, max);
        onChange?.(n);
      }}
    />
  );
});
