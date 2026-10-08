import { forwardRef } from 'react';
import clsx from 'clsx';
import Spinner from './Spinner';

const VARIANTS = {
  primary:
    'bg-pumpkin text-white hover:bg-pumpkin-light active:bg-pumpkin-dark shadow-[0_0_28px_-8px_rgb(255_106_0/0.85)] disabled:shadow-none',
  secondary: 'border border-ash bg-white/[0.03] text-bone hover:border-bone/40 hover:bg-white/[0.07]',
  ghost: 'text-fog hover:bg-white/[0.06] hover:text-bone',
  danger: 'border border-danger/40 bg-danger/10 text-danger-light hover:bg-danger/20',
  success: 'bg-toxic text-ink hover:brightness-110',
  ember: 'bg-ember text-ink hover:brightness-110',
};

const SIZES = {
  sm: 'h-9 gap-1.5 rounded-lg px-3 text-sm',
  md: 'h-11 gap-2 rounded-xl px-5 text-sm',
  lg: 'h-13 gap-2 rounded-xl px-6 text-base',
  xl: 'h-16 gap-3 rounded-2xl px-8 text-lg',
  icon: 'h-10 w-10 rounded-xl',
};

/**
 * <Button variant="primary|secondary|ghost|danger|success|ember" size="sm|md|lg|xl|icon" loading block>
 * Para enlaces: <Button as={Link} to="/comprar">…</Button>
 */
const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', loading = false, block = false, as: Comp = 'button', className, children, disabled, type, ...props },
  ref,
) {
  const isNativeButton = Comp === 'button';
  return (
    <Comp
      ref={ref}
      type={isNativeButton ? type || 'button' : undefined}
      disabled={isNativeButton ? disabled || loading : undefined}
      aria-disabled={!isNativeButton && disabled ? true : undefined}
      aria-busy={loading || undefined}
      className={clsx(
        'inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap font-semibold transition duration-150',
        'disabled:cursor-not-allowed disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        block && 'w-full',
        className,
      )}
      {...props}
    >
      {loading && <Spinner className="h-4 w-4" label="Procesando" />}
      {children}
    </Comp>
  );
});

export default Button;
