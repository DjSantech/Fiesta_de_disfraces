import { Link } from 'react-router-dom';
import { Button } from '../../components/ui';
import PublicLayout, { PageAtmosphere, PageContainer } from '../../components/public/PublicLayout';

export default function NotFound() {
  return (
    <PublicLayout>
      <PageAtmosphere />
      <PageContainer className="flex min-h-[80dvh] flex-col items-center justify-center text-center">
        <p className="fd-text-stroke font-display text-[length:clamp(8rem,45vw,16rem)] leading-none [-webkit-text-stroke:2px_rgb(225_29_46/0.7)]">
          4<span className="animate-flicker">0</span>4
        </p>
        <h1 className="mt-2 font-display text-4xl uppercase text-bone">Te perdiste en la niebla</h1>
        <p className="mt-3 text-fog">Esta puerta no lleva a ningún lado.</p>
        <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
          <Button as={Link} to="/" size="lg">Volver al inicio</Button>
          <Button as={Link} to="/recuperar" variant="secondary">Recuperar mi entrada</Button>
        </div>
      </PageContainer>
    </PublicLayout>
  );
}
