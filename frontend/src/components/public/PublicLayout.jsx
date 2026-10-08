import { LazyMotion, MotionConfig, domAnimation } from 'motion/react';
import clsx from 'clsx';
import SiteHeader from './SiteHeader';
import SiteFooter from './SiteFooter';
import './public.css';

/**
 * Layout común de la web pública: grano de película, header fijo y footer.
 * <PublicLayout header="home|page" headerRight={…} footer="full|compact|none">…</PublicLayout>
 */
export default function PublicLayout({ header = 'page', headerRight, hideHeaderCta = false, footer = 'compact', className, children }) {
  return (
    <LazyMotion features={domAnimation}>
      <MotionConfig reducedMotion="user">
        <div className="relative isolate min-h-dvh overflow-x-clip bg-ink text-bone">
          <a
            href="#contenido"
            className="sr-only z-[90] rounded-lg bg-blood px-4 py-2 text-sm font-semibold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
          >
            Saltar al contenido
          </a>
          <div className="grain-overlay" aria-hidden="true" />
          <SiteHeader variant={header} right={headerRight} hideCta={hideHeaderCta} />
          <main id="contenido" tabIndex={-1} className={clsx('relative outline-none', className)}>
            {children}
          </main>
          {footer !== 'none' && <SiteFooter compact={footer === 'compact'} />}
        </div>
      </MotionConfig>
    </LazyMotion>
  );
}

/** Contenedor estándar para páginas internas (compra, orden, entrada…). */
export function PageContainer({ size = 'md', className, children }) {
  return (
    <div
      className={clsx(
        'relative mx-auto w-full px-4 pb-20 pt-24 sm:px-6 sm:pt-28',
        size === 'sm' && 'max-w-md',
        size === 'md' && 'max-w-xl',
        size === 'lg' && 'max-w-3xl',
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Fondo atmosférico para páginas internas (luz roja arriba + niebla). */
export function PageAtmosphere({ intensity = 'normal' }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[70vh] overflow-hidden" aria-hidden="true">
      <div className={clsx('fd-hero-glow absolute inset-0', intensity === 'soft' && 'opacity-60')} />
      <div className="fog-layer opacity-70" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-linear-to-b from-transparent to-ink" />
    </div>
  );
}
