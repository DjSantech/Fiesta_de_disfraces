import { Search, X } from 'lucide-react';
import { Input } from '../../ui';

/** Buscador con lupa y botón para limpiar. */
export default function SearchInput({ value, onChange, placeholder = 'Buscar…', label, className, ...props }) {
  return (
    <Input
      label={label}
      aria-label={label ? undefined : placeholder}
      className={className}
      type="text"
      inputMode="search"
      enterKeyHint="search"
      autoComplete="off"
      autoCorrect="off"
      spellCheck={false}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      leading={<Search className="h-4 w-4" />}
      trailing={
        value ? (
          <button
            type="button"
            onClick={() => onChange('')}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-fog transition hover:bg-white/5 hover:text-bone"
            aria-label="Limpiar búsqueda"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null
      }
      {...props}
    />
  );
}
