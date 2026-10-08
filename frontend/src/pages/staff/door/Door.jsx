import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Banknote, Car, ClipboardList, ScanQrCode, Wallet } from 'lucide-react';
import { PageSpinner, Tabs } from '../../../components/ui';
import { useAuth } from '../../../lib/auth';
import { useFetch } from '../../../lib/useFetch';
import ScanTab from '../../../components/staff/door/ScanTab';
import SellTab from '../../../components/staff/door/SellTab';
import LogTab from '../../../components/staff/door/LogTab';
import VehiclesTab from '../../../components/staff/door/VehiclesTab';
import CashTab, { DoorStatsBar } from '../../../components/staff/door/CashTab';
import { doorApi } from '../../../components/staff/door/doorUtils';
import { unlockAudio } from '../../../components/staff/door/feedback';
import { ConnectionBanner, LoadError, OPS_TABS_CLASS } from '../../../components/staff/door/shared/OpsUi';
import { useStickyTop } from '../../../components/staff/door/shared/hooks';

const TABS = [
  { value: 'scan', label: 'Escanear', icon: ScanQrCode },
  { value: 'sell', label: 'Vender', icon: Banknote },
  { value: 'log', label: 'Registro', icon: ClipboardList },
  { value: 'vehicles', label: 'Vehículos', icon: Car },
  { value: 'cash', label: 'Caja', icon: Wallet },
];

/** Portería: escanear QR, vender en puerta, registro, vehículos y caja. */
export default function Door() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.value === params.get('tab')) ? params.get('tab') : 'scan';
  const setTab = useCallback((v) => setParams(v === 'scan' ? {} : { tab: v }, { replace: true }), [setParams]);
  const top = useStickyTop();
  const config = useFetch((signal) => doorApi.config(signal), []);
  const stats = useFetch((signal) => doorApi.stats(signal), [], { interval: 15000 });
  const reloadStats = stats.reload;
  const refreshStats = useCallback(() => reloadStats({ silent: true }), [reloadStats]);
  const [sellPrefill, setSellPrefill] = useState(null);
  const [visited, setVisited] = useState(() => new Set([tab]));
  const clearPrefill = useCallback(() => setSellPrefill(null), []);

  useEffect(() => setVisited((v) => (v.has(tab) ? v : new Set(v).add(tab))), [tab]);

  // El audio del beep solo se desbloquea con un gesto del usuario.
  useEffect(() => {
    window.addEventListener('pointerdown', unlockAudio, { passive: true });
    return () => window.removeEventListener('pointerdown', unlockAudio);
  }, []);

  if (config.loading && !config.data) return <PageSpinner label="Cargando portería…" />;
  if (!config.data) return <LoadError error={config.error} onRetry={config.reload} />;

  const keep = (value, node) => visited.has(value) && <div hidden={tab !== value}>{node}</div>;

  return (
    <div className="-mt-2">
      <div className="sticky z-30 -mx-4 flex flex-col gap-2 bg-ink/95 px-4 pb-3 pt-2 backdrop-blur-md" style={{ top }}>
        <ConnectionBanner error={stats.error} onRetry={() => stats.reload({ silent: true })} />
        <DoorStatsBar stats={stats.data} config={config.data} />
        <Tabs tabs={TABS} value={tab} onChange={setTab} ariaLabel="Portería" className={OPS_TABS_CLASS} />
      </div>
      <div className="mt-2">
        {tab === 'scan' && (
          <ScanTab
            config={config.data}
            onChanged={refreshStats}
            onSell={(prefill) => {
              setSellPrefill(prefill);
              setTab('sell');
            }}
          />
        )}
        {keep('sell', <SellTab config={config.data} prefill={sellPrefill} onPrefillUsed={clearPrefill} onChanged={refreshStats} />)}
        {keep('log', <LogTab active={tab === 'log'} config={config.data} onChanged={refreshStats} />)}
        {keep('vehicles', <VehiclesTab active={tab === 'vehicles'} onChanged={refreshStats} />)}
        {tab === 'cash' && <CashTab stats={stats} isAdmin={user?.role === 'admin'} />}
      </div>
    </div>
  );
}
