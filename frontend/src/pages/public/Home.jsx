import { useEffect, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { MARQUEE } from '../../config/event';
import PublicLayout from '../../components/public/PublicLayout';
import Intro, { markIntroSeen, shouldShowIntro } from '../../components/public/Intro';
import Jumpscare, { jumpscareArmed } from '../../components/public/Jumpscare';
import PromoVideo from '../../components/public/PromoVideo';
import PromotersSection from '../../components/public/home/PromotersSection';
import Hero from '../../components/public/home/Hero';
import Highlights from '../../components/public/home/Highlights';
import NightSection from '../../components/public/home/NightSection';
import PricesSection from '../../components/public/home/PricesSection';
import RoomsSection from '../../components/public/home/RoomsSection';
import { FaqSection, FinalCta, InfoSection, MapSection, SponsorsSection } from '../../components/public/home/MoreSections';
import { SectionBreak } from '../../components/public/decor';
import LastOrderNotice from '../../components/public/LastOrderNotice';
import { WhatsAppGroupFab } from '../../components/public/WhatsAppButton';
import { Marquee } from '../../components/public/ui';
import { usePublicConfig } from '../../components/public/usePublicConfig';
import { dayMonth } from '../../components/public/utils/dates';

export default function Home() {
  const { config, source } = usePublicConfig({ refreshInterval: 60000 });
  const [introOpen, setIntroOpen] = useState(() => shouldShowIntro());
  // Orden: susto → video de la fiesta → web. Sin susto (apagado o ya visto) sale la intro normal.
  const [scareOpen, setScareOpen] = useState(() => shouldShowIntro() && jumpscareArmed(config.jumpscare));
  const [videoOpen, setVideoOpen] = useState(false);
  const overlay = introOpen || scareOpen || videoOpen;
  const known = source !== 'fallback';

  useEffect(() => {
    document.title = 'Fiesta de Disfraces · Pereira · 31 de octubre';
    if (window.location.hash) {
      const id = window.location.hash.slice(1);
      setTimeout(() => document.getElementById(id)?.scrollIntoView(), 80);
    }
  }, []);

  const phaseText = config.event.phase === 'preventa' ? `Preventa hasta el ${dayMonth(config.event.presaleEndsAt)}` : 'Venta general abierta';

  return (
    <PublicLayout header="home" footer="full">
      <AnimatePresence>
        {scareOpen && <Jumpscare
            key="susto"
            enabled={config.jumpscare !== false}
            onDone={(seen) => {
              setScareOpen(false);
              if (seen) {
                markIntroSeen(); // tras susto + video va directo a la web, también al recargar
                setIntroOpen(false);
                setVideoOpen(true);
              }
            }}
          />}
      </AnimatePresence>
      <AnimatePresence>{videoOpen && <PromoVideo key="video" onDone={() => setVideoOpen(false)} />}</AnimatePresence>
      <AnimatePresence>{introOpen && !scareOpen && <Intro key="intro" onDone={() => setIntroOpen(false)} />}</AnimatePresence>
      <Hero config={config} ready={!overlay} />
      <Highlights />
      <Marquee items={[phaseText, ...MARQUEE]} />
      <NightSection />
      <SectionBreak />
      <PricesSection config={config} />
      <RoomsSection config={config} known={known} />
      <SectionBreak variant="pumpkin" />
      <MapSection config={config} known={known} />
      <InfoSection config={config} />
      <SectionBreak />
      <FaqSection />
      <SponsorsSection />
      <PromotersSection />
      <FinalCta config={config} />
      {!overlay && <LastOrderNotice />}
      {!overlay && <WhatsAppGroupFab />}
    </PublicLayout>
  );
}
