import { forwardRef, useId } from 'react';
import clsx from 'clsx';
import { Check } from 'lucide-react';

/** Envoltura con label, ayuda y error. La usan Input/Select/Textarea, o úsala sola. */
export function Field({ label, hint, error, htmlFor, required, className, children }) {
  return (
    <div className={clsx('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={htmlFor} className="text-sm font-medium text-bone/90">
          {label}
          {required && <span className="text-blood-light"> *</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-xs font-medium text-blood-light" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-smoke">{hint}</p>
      ) : null}
    </div>
  );
}

const controlBase =
  'w-full rounded-xl border bg-tomb/70 text-bone placeholder:text-smoke transition focus:outline-none focus:ring-2 disabled:opacity-50';
const controlState = (error) =>
  error
    ? 'border-blood/70 focus:border-blood focus:ring-blood/30'
    : 'border-white/10 hover:border-white/20 focus:border-blood-light/70 focus:ring-blood/25';

/**
 * <Input label="Cédula" error={msg} hint="Sin puntos" leading="@" trailing={<Icon/>} {...inputProps} />
 */
export const Input = forwardRef(function Input(
  { label, hint, error, id, className, inputClassName, required, leading, trailing, ...props },
  ref,
) {
  const autoId = useId();
  const inputId = id || autoId;
  return (
    <Field label={label} hint={hint} error={error} htmlFor={inputId} required={required} className={className}>
      <div className="relative">
        {leading && (
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-fog">{leading}</span>
        )}
        <input
          ref={ref}
          id={inputId}
          required={required}
          aria-invalid={error ? true : undefined}
          className={clsx(controlBase, controlState(error), 'h-12 px-4', leading && 'pl-10', trailing && 'pr-11', inputClassName)}
          {...props}
        />
        {trailing && <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-fog">{trailing}</span>}
      </div>
    </Field>
  );
});

/**
 * <Select label="Categoría" options={[{ value, label }]} placeholder="Elige…" {...selectProps} />
 */
export const Select = forwardRef(function Select(
  { label, hint, error, id, className, selectClassName, required, options = [], placeholder, children, ...props },
  ref,
) {
  const autoId = useId();
  const selectId = id || autoId;
  return (
    <Field label={label} hint={hint} error={error} htmlFor={selectId} required={required} className={className}>
      <select
        ref={ref}
        id={selectId}
        required={required}
        aria-invalid={error ? true : undefined}
        className={clsx(controlBase, controlState(error), 'h-12 appearance-none bg-no-repeat px-4 pr-10', selectClassName)}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23a3a0ad' stroke-width='2'><path d='m6 9 6 6 6-6'/></svg>\")",
          backgroundPosition: 'right 0.9rem center',
        }}
        {...props}
      >
        {placeholder !== undefined && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
        {children}
      </select>
    </Field>
  );
});

export const Textarea = forwardRef(function Textarea(
  { label, hint, error, id, className, textareaClassName, required, rows = 4, ...props },
  ref,
) {
  const autoId = useId();
  const textareaId = id || autoId;
  return (
    <Field label={label} hint={hint} error={error} htmlFor={textareaId} required={required} className={className}>
      <textarea
        ref={ref}
        id={textareaId}
        rows={rows}
        required={required}
        aria-invalid={error ? true : undefined}
        className={clsx(controlBase, controlState(error), 'px-4 py-3 leading-relaxed', textareaClassName)}
        {...props}
      />
    </Field>
  );
});

/**
 * <Checkbox checked onChange={(e) => …} label={<>Acepto la <a>política</a></>} error={msg} />
 */
export const Checkbox = forwardRef(function Checkbox({ label, error, id, className, checked, ...props }, ref) {
  const autoId = useId();
  const boxId = id || autoId;
  return (
    <div className={clsx('flex flex-col gap-1', className)}>
      <label htmlFor={boxId} className="group flex cursor-pointer items-start gap-3 text-sm leading-snug text-fog">
        <span className="relative mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
          <input
            ref={ref}
            id={boxId}
            type="checkbox"
            checked={checked}
            aria-invalid={error ? true : undefined}
            className="peer absolute inset-0 h-5 w-5 cursor-pointer appearance-none rounded-md border border-white/25 bg-tomb transition checked:border-blood checked:bg-blood focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blood-light"
            {...props}
          />
          <Check className="pointer-events-none relative h-3.5 w-3.5 text-white opacity-0 peer-checked:opacity-100" strokeWidth={3} />
        </span>
        <span className="group-hover:text-bone/90">{label}</span>
      </label>
      {error && (
        <p className="pl-8 text-xs font-medium text-blood-light" role="alert">
          {error}
        </p>
      )}
    </div>
  );
});
