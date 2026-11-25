import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthProvider';
import { Store, Utensils, FolderTree, Link2 } from 'lucide-react';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'https://smart-kiosk-ttut.onrender.com';

// Stat card component
function StatCard({ icon, label, value, sub, onClick, loading }) {
  return (
    <div
      onClick={onClick}
      className={`apple-card p-5 flex flex-col gap-1.5 transition-all duration-150 ${onClick ? 'cursor-pointer hover:ring-1 hover:ring-[#007AFF]/40' : ''}`}
    >
      <div className="w-9 h-9 rounded-xl bg-[#007AFF]/12 text-[#007AFF] flex items-center justify-center mb-1">
        {icon}
      </div>
      {loading
        ? <div className="w-16 h-7 rounded-lg bg-black/[0.06] dark:bg-white/[0.08] animate-pulse" />
        : <span className="text-[26px] font-bold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7] leading-none tabular-nums">{value ?? '—'}</span>
      }
      <span className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider mt-1">{label}</span>
      {sub && <span className="text-[12px] text-[#6E6E73] dark:text-[#98989D]">{sub}</span>}
      {onClick && <span className="text-[12px] text-[#007AFF] font-semibold mt-1">Vezi lista →</span>}
    </div>
  );
}

export default function IntegrationDetail({ integ, onBack, onTest, onSync, testing, syncing }) {
  const { fetchWithAuth } = useAuth();
  const [stats, setStats]       = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [drillDown, setDrillDown] = useState(null); // 'restaurants' | 'products' | 'categories'
  const [drillData, setDrillData] = useState([]);
  const [drillLoading, setDrillLoading] = useState(false);
  const [drillSearch, setDrillSearch] = useState('');

  // Fetch stats for this brand from our menu data
  useEffect(() => {
    if (!integ) return;
    setLoadingStats(true);

    Promise.all([
      fetchWithAuth(`${BACKEND}/api/menu/${integ.brand_id || 'all'}/stats`).then(r => r.ok ? r.json() : null).catch(() => null),
      fetchWithAuth(`${BACKEND}/api/locations?brand=${integ.brand_id}`).then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([menuStats, locData]) => {
      setStats({
        restaurants: locData?.locations?.length ?? locData?.count ?? null,
        products:    menuStats?.products ?? menuStats?.itemsCount ?? null,
        categories:  menuStats?.categories ?? menuStats?.categoriesCount ?? null,
        lastSync:    integ.last_sync_at ? new Date(integ.last_sync_at).toLocaleString('ro-RO') : null,
      });
      setLoadingStats(false);
    });
  }, [integ?.id]);

  const openDrill = async (type) => {
    setDrillDown(type);
    setDrillSearch('');
    setDrillLoading(true);
    let data = [];
    try {
      if (type === 'restaurants') {
        const r = await fetchWithAuth(`${BACKEND}/api/locations?brand=${integ.brand_id}`);
        const d = await r.json();
        data = d.locations || [];
      } else if (type === 'products') {
        const r = await fetchWithAuth(`${BACKEND}/api/menu/items?brand=${integ.brand_id}&limit=500`);
        const d = await r.json();
        data = d.items || d.products || [];
      } else if (type === 'categories') {
        const r = await fetchWithAuth(`${BACKEND}/api/menu/categories?brand=${integ.brand_id}`);
        const d = await r.json();
        data = d.categories || [];
      }
    } catch (_) {}
    setDrillData(data);
    setDrillLoading(false);
  };

  const filtered = drillData.filter(item => {
    const q = drillSearch.toLowerCase();
    return !q || JSON.stringify(item).toLowerCase().includes(q);
  });

  const STATUS_COLOR = {
    active: 'text-[#248A3D] dark:text-[#30D158] bg-[#34C759]/12',
    error: 'text-[#FF3B30] bg-[#FF3B30]/12',
    pending: 'text-[#6E6E73] dark:text-[#98989D] bg-black/[0.05] dark:bg-white/[0.08]',
  };
  const statusColorClasses = STATUS_COLOR[integ?.status] || STATUS_COLOR.pending;
  const statusLabel = { active: 'Activ', error: 'Eroare', pending: 'Nou' }[integ?.status] || integ?.status;

  if (drillDown) {
    const titles = { restaurants: 'Restaurante', products: 'Produse', categories: 'Categorii' };
    return (
      <div className="pb-10 space-y-5 animate-in fade-in duration-300">
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={() => setDrillDown(null)} className="apple-btn-secondary px-3.5 py-2 text-[13px]">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/></svg>
            Înapoi
          </button>
          <h2 className="text-[20px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] m-0">
            {titles[drillDown]} <span className="text-[#86868B] font-normal mx-1">·</span> {integ.name}
          </h2>
        </div>

        <div className="relative w-full max-w-sm">
          <input value={drillSearch} onChange={e => setDrillSearch(e.target.value)}
            placeholder={`Caută în ${titles[drillDown].toLowerCase()}...`}
            className="apple-input rounded-full w-full pl-9 pr-14 py-2 text-[13px]"
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868B] pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          {drillSearch && (
            <span className="absolute right-2 top-1/2 -translate-y-1/2 bg-[#007AFF]/12 text-[#007AFF] rounded-md px-2 py-0.5 text-[11px] font-semibold tabular-nums pointer-events-none">
              {filtered.length}/{drillData.length}
            </span>
          )}
        </div>

        {drillLoading ? (
          <div className="apple-card flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-6 h-6 border-2 border-black/10 dark:border-white/10 border-t-[#007AFF] rounded-full animate-spin" />
            <span className="text-[#86868B] text-[13px] font-medium">Se încarcă...</span>
          </div>
        ) : (
          <div className="apple-card overflow-hidden">
            {filtered.length === 0
              ? <div className="text-[#86868B] py-16 text-center text-[13px] font-medium">Niciun rezultat{drillSearch ? ` pentru "${drillSearch}"` : ''}</div>
              : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-black/[0.06] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.02] text-[11px] font-semibold text-[#6E6E73] dark:text-[#98989D] uppercase tracking-wider">
                        {drillDown === 'restaurants' && <>
                          <th className="px-4 py-3 w-12">#</th>
                          <th className="px-4 py-3">Nume</th>
                          <th className="px-4 py-3">ID</th>
                          <th className="px-4 py-3">Stare</th>
                        </>}
                        {drillDown === 'products' && <>
                          <th className="px-4 py-3 w-12">#</th>
                          <th className="px-4 py-3">Produs</th>
                          <th className="px-4 py-3">Categorie</th>
                          <th className="px-4 py-3">Preț</th>
                        </>}
                        {drillDown === 'categories' && <>
                          <th className="px-4 py-3 w-12">#</th>
                          <th className="px-4 py-3">Categorie</th>
                          <th className="px-4 py-3">Produse</th>
                        </>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/[0.05] dark:divide-white/[0.06]">
                      {filtered.slice(0, 200).map((item, i) => (
                        <tr key={item.id || i} className="transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
                          {drillDown === 'restaurants' && <>
                            <td className="px-4 py-3 text-[13px] text-[#86868B] tabular-nums">{i + 1}</td>
                            <td className="px-4 py-3 text-[13px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">{item.name || item.id}</td>
                            <td className="px-4 py-3 text-[12px] text-[#86868B]">{item.id}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${item.active ? 'text-[#248A3D] dark:text-[#30D158] bg-[#34C759]/12' : 'text-[#86868B] bg-black/[0.05] dark:bg-white/[0.08]'}`}>
                                {item.active ? 'Activ' : 'Inactiv'}
                              </span>
                            </td>
                          </>}
                          {drillDown === 'products' && <>
                            <td className="px-4 py-3 text-[13px] text-[#86868B] tabular-nums">{i + 1}</td>
                            <td className="px-4 py-3 text-[13px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">{item.name || item.title}</td>
                            <td className="px-4 py-3 text-[13px] text-[#6E6E73] dark:text-[#98989D]">{item.category || item.categoryName || '—'}</td>
                            <td className="px-4 py-3 text-[13px] font-semibold text-[#007AFF] tabular-nums">{item.price ? `${item.price} lei` : '—'}</td>
                          </>}
                          {drillDown === 'categories' && <>
                            <td className="px-4 py-3 text-[13px] text-[#86868B] tabular-nums">{i + 1}</td>
                            <td className="px-4 py-3 text-[13px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">{item.name || item.title}</td>
                            <td className="px-4 py-3 text-[13px] text-[#6E6E73] dark:text-[#98989D] tabular-nums">{item.itemsCount ?? item.products?.length ?? '—'}</td>
                          </>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            }
            {filtered.length > 200 && (
              <div className="px-5 py-3 border-t border-black/[0.06] dark:border-white/[0.08] bg-black/[0.015] dark:bg-white/[0.02] text-[#86868B] text-[12px] font-medium text-center tabular-nums">
                Afișate primele 200 din {filtered.length} rezultate
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="pb-10 space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <button onClick={onBack} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#007AFF] hover:underline mb-2 cursor-pointer">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/></svg>
            Integrări POS
          </button>
          <h1 className="text-[24px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7] m-0 mb-2">{integ.name}</h1>
          <div className="flex flex-wrap items-center gap-2.5 text-[13px]">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${statusColorClasses}`}>
              {statusLabel}
            </span>
            <span className="text-[#6E6E73] dark:text-[#98989D]">Provider: <strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">Syrve / iiko</strong></span>
            <span className="text-[#6E6E73] dark:text-[#98989D]">Brand: <strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">{integ.brand_id || '—'}</strong></span>
          </div>
          {stats?.lastSync && (
            <div className="text-[12px] text-[#86868B] mt-1.5 tabular-nums">Ultima sincronizare: {stats.lastSync}</div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button onClick={() => onTest && onTest(integ.id)} disabled={testing === integ.id} className="apple-btn-secondary px-4 py-2 text-[13px]">
            {testing === integ.id ? 'Se testează...' : 'Test Conexiune'}
          </button>
          <button onClick={() => onSync && onSync(integ.id, integ.name)} disabled={syncing === integ.id} className="apple-btn-primary px-5 py-2 text-[13px]">
            {syncing === integ.id ? 'Sincronizare...' : 'Sync Meniu'}
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Store size={19} />} label="Restaurante" value={stats?.restaurants} loading={loadingStats}
          onClick={() => openDrill('restaurants')} />
        <StatCard icon={<Utensils size={19} />} label="Produse" value={stats?.products} loading={loadingStats}
          onClick={() => openDrill('products')} />
        <StatCard icon={<FolderTree size={19} />} label="Categorii" value={stats?.categories} loading={loadingStats}
          onClick={() => openDrill('categories')} />
        <StatCard icon={<Link2 size={19} />} label="Brand ID" value={integ.brand_id || '—'} />
      </div>

      {/* Connection details card */}
      <div className="apple-card p-6">
        <h3 className="text-[16px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] m-0 mb-5">
          Detalii Conexiune
        </h3>
        <div className="apple-inset-group divide-y divide-black/[0.06] dark:divide-white/[0.08]">
          {[
            ['Provider', 'Syrve / iiko cloud'],
            ['API URL', integ.credentials?.apiUrl || 'https://api-eu.syrve.live'],
            ['Org ID', integ.credentials?.orgId || '—'],
            ['API Login', integ.credentials?.apiLogin ? '••••••••' : '—'],
          ].map(([k, v]) => (
            <div key={k} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 px-4 py-3">
              <div className="text-[12px] font-medium text-[#6E6E73] dark:text-[#98989D]">{k}</div>
              <div className={`text-[13px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] ${v.startsWith('•') ? 'tracking-widest' : ''}`}>{v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
