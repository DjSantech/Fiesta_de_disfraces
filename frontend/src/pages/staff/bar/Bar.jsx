import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChartColumn, Package, Receipt, ShoppingCart } from 'lucide-react';
import { Tabs } from '../../../components/ui';
import { useFetch } from '../../../lib/useFetch';
import PosTab from '../../../components/staff/bar/PosTab';
import { ProductsTab, SalesTab, SummaryTab } from '../../../components/staff/bar/ManageTabs';
import { barApi, loadCart, saveCart } from '../../../components/staff/bar/barUtils';
import { ConnectionBanner, OPS_TABS_CLASS } from '../../../components/staff/door/shared/OpsUi';
import { useStickyTop } from '../../../components/staff/door/shared/hooks';

/** Barra: punto de venta, productos, ventas y resumen. */
export default function Bar() {
  const [params, setParams] = useSearchParams();
  const values = ['pos', 'products', 'sales', 'summary'];
  const tab = values.includes(params.get('tab')) ? params.get('tab') : 'pos';
  const setTab = useCallback((v) => setParams(v === 'pos' ? {} : { tab: v }, { replace: true }), [setParams]);
  const top = useStickyTop();
  const products = useFetch((s) => barApi.products(false, s), [], { interval: tab === 'pos' ? 30000 : undefined });
  const reloadProducts = products.reload;
  const refresh = useCallback(() => reloadProducts({ silent: true }), [reloadProducts]);
  const [cart, setCart] = useState(loadCart);
  const [visited, setVisited] = useState(() => new Set([tab]));
  useEffect(() => saveCart(cart), [cart]);
  useEffect(() => setVisited((v) => (v.has(tab) ? v : new Set(v).add(tab))), [tab]);

  const count = cart.reduce((n, i) => n + i.qty, 0);
  const tabs = [
    { value: 'pos', label: 'Vender', icon: ShoppingCart, badge: tab !== 'pos' && count ? count : undefined },
    { value: 'products', label: 'Productos', icon: Package },
    { value: 'sales', label: 'Ventas', icon: Receipt },
    { value: 'summary', label: 'Resumen', icon: ChartColumn },
  ];
  const keep = (v, node) => visited.has(v) && <div hidden={tab !== v}>{node}</div>;

  return (
    <div className="-mt-2">
      <div className="sticky z-30 -mx-4 flex flex-col gap-2 bg-ink/95 px-4 pb-3 pt-2 backdrop-blur-md" style={{ top }}>
        <ConnectionBanner error={products.data ? products.error : null} onRetry={refresh} />
        <Tabs tabs={tabs} value={tab} onChange={setTab} ariaLabel="Barra" className={OPS_TABS_CLASS} />
      </div>
      <div className="mt-2">
        {tab === 'pos' && <PosTab products={products} cart={cart} setCart={setCart} onSold={refresh} />}
        {keep('products', <ProductsTab active={tab === 'products'} onChanged={refresh} />)}
        {keep('sales', <SalesTab active={tab === 'sales'} onChanged={refresh} />)}
        {tab === 'summary' && <SummaryTab />}
      </div>
    </div>
  );
}
