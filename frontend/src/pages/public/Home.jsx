import { useEffect, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { MARQUEE } from '../../config/event';
import PublicLayout from '../../components/public/PublicLayout';
import Intro, { shouldShowIntro } from '../../components/public/Intro';
import Hero from '../../components/public/home/Hero';
import NightSection from '../../components/public/home/NightSection';
import PricesSection from '../../components/public/home/PricesSection';
import RoomsSection from '../../components/public/home/RoomsSection';
import { FaqSection, FinalCta, InfoSection, MapSection, SponsorsSection } from '../../components/public/home/MoreSections';
import LastOrderNotice from '../../components/public/LastOrderNotice';
import { Marquee } from '../../components/public/ui';
import { usePublicConfig } from '../../components/public/usePublicConfig';
import { dayMonth } from '../../components/public/utils/dates';

export default function Home() {
  const { config, source } = usePublicConfig({ refreshInterval: 60000 });
  const [introOpen, setIntroOpen] = useState(() => shouldShowIntro());
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
      <AnimatePresence>{introOpen && <Intro key="intro" onDone={() => setIntroOpen(false)} />}</AnimatePresence>
      <Hero config={config} ready={!introOpen} />
      <Marquee items={[phaseText, ...MARQUEE]} />
      <NightSection />
      <PricesSection config={config} />
      <RoomsSection config={config} known={known} />
      <MapSection config={config} known={known} />
      <InfoSection config={config} />
      <FaqSection />
      <SponsorsSection />
      <FinalCta config={config} />
      {!introOpen && <LastOrderNotice />}
    </PublicLayout>
  );
}
