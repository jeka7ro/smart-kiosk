import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthProvider';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

// Stat card component
function StatCard({ icon, label, value, sub, onClick, loading }) {
  return (
    <div
      onClick={onClick}
      className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex flex-col gap-2 shadow-sm transition-all duration-200 ${onClick ? 'cursor-pointer hover:-translate-y-1 hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700' : ''}`}
    >
      <span className="text-3xl mb-1">{icon}</span>
      {loading
        ? <div className="w-16 h-8 rounded-lg bg-slate-200 dark:bg-slate-800 animate-pulse" />
        : <span className="text-3xl font-black text-slate-900 dark:text-white leading-none">{value ?? '—'}</span>
      }
      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">{label}</span>
      {sub && <span className="text-xs text-slate-500">{sub}</span>}
      {onClick && <span className="text-xs text-blue-600 dark:text-blue-400 font-bold mt-1">→ Vezi lista</span>}
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

  const STATUS_COLOR = { active: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800', error: 'text-red-600 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800', pending: 'text-slate-600 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700' };
  const statusColorClasses = STATUS_COLOR[integ?.status] || STATUS_COLOR.pending;
  const statusLabel = { active: 'Activ', error: 'Eroare', pending: 'Nou' }[integ?.status] || integ?.status;

  if (drillDown) {
    const titles = { restaurants: 'Restaurante', products: 'Produse', categories: 'Categorii' };
    return (
      <div className="pb-10 animate-in fade-in duration-300">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => setDrillDown(null)}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-700 dark:text-slate-300 font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/></svg>
            Înapoi la integrare
          </button>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white m-0 leading-tight">
            {titles[drillDown]} <span className="text-slate-400 font-normal mx-1">—</span> {integ.name}
          </h2>
        </div>

        <div className="relative w-full max-w-sm mb-6">
          <input value={drillSearch} onChange={e => setDrillSearch(e.target.value)}
            placeholder={`Caută în ${titles[drillDown].toLowerCase()}...`}
            className="w-full pl-11 pr-16 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-shadow shadow-sm"
          />
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          {drillSearch && (
            <span className="absolute right-1 top-1 bottom-1 flex items-center justify-center bg-blue-600 text-white rounded-full px-3 text-xs font-bold pointer-events-none">
              {filtered.length}/{drillData.length}
            </span>
          )}
        </div>

        {drillLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-50 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
             <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-500 rounded-full animate-spin"></div>
             <span className="text-slate-500 text-sm font-medium">Se încarcă...</span>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            {filtered.length === 0
              ? <div className="text-slate-500 py-16 text-center font-medium">Niciun rezultat{drillSearch ? ` pentru "${drillSearch}"` : ''}</div>
              : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                        {drillDown === 'restaurants' && <>
                          <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider w-12">#</th>
                          <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Nume</th>
                          <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">ID</th>
                          <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Stare</th>
                        </>}
                        {drillDown === 'products' && <>
                          <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider w-12">#</th>
                          <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Produs</th>
                          <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Categorie</th>
                          <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Preț</th>
                        </>}
                        {drillDown === 'categories' && <>
                          <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider w-12">#</th>
                          <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Categorie</th>
                          <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Produse</th>
                        </>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {filtered.slice(0, 200).map((item, i) => (
                        <tr key={item.id || i} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          {drillDown === 'restaurants' && <>
                            <td className="px-4 py-3 text-sm text-slate-500 font-medium">{i + 1}</td>
                            <td className="px-4 py-3 text-sm font-bold text-slate-900 dark:text-white">{item.name || item.id}</td>
                            <td className="px-4 py-3 text-xs font-mono text-slate-400">{item.id}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${item.active ? 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800' : 'text-slate-500 bg-slate-100 border-slate-200 dark:bg-slate-800 dark:border-slate-700'}`}>
                                {item.active ? 'Activ' : 'Inactiv'}
                              </span>
                            </td>
                          </>}
                          {drillDown === 'products' && <>
                            <td className="px-4 py-3 text-sm text-slate-500 font-medium">{i + 1}</td>
                            <td className="px-4 py-3 text-sm font-bold text-slate-900 dark:text-white">{item.name || item.title}</td>
                            <td className="px-4 py-3 text-sm text-slate-500">{item.category || item.categoryName || '—'}</td>
                            <td className="px-4 py-3 text-sm font-bold text-blue-600 dark:text-blue-400">{item.price ? `${item.price} lei` : '—'}</td>
                          </>}
                          {drillDown === 'categories' && <>
                            <td className="px-4 py-3 text-sm text-slate-500 font-medium">{i + 1}</td>
                            <td className="px-4 py-3 text-sm font-bold text-slate-900 dark:text-white">{item.name || item.title}</td>
                            <td className="px-4 py-3 text-sm text-slate-500 font-medium">{item.itemsCount ?? item.products?.length ?? '—'}</td>
                          </>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            }
            {filtered.length > 200 && (
              <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 text-slate-500 text-sm font-medium text-center">
                Afișate primele 200 din {filtered.length} rezultate
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="pb-10 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-8">
        <div>
          <button onClick={onBack}
            className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors mb-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/></svg>
            Integrări POS
          </button>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white m-0 leading-tight mb-3">{integ.name}</h1>
          <div className="flex flex-wrap items-center gap-3">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${statusColorClasses}`}>
              {statusLabel}
            </span>
            <span className="text-sm text-slate-500">Provider: <strong className="text-slate-700 dark:text-slate-300">Syrve / iiko</strong></span>
            <span className="text-sm text-slate-500">Brand: <strong className="text-slate-700 dark:text-slate-300">{integ.brand_id || '—'}</strong></span>
          </div>
          {stats?.lastSync && (
            <div className="text-sm text-slate-400 mt-2 font-medium">Ultima sincronizare: {stats.lastSync}</div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => onTest && onTest(integ.id)} disabled={testing === integ.id}
            className="flex items-center justify-center gap-2 px-5 h-11 rounded-full bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/20 dark:hover:bg-amber-900/40 text-amber-600 dark:text-amber-500 text-sm font-bold border border-amber-200 dark:border-amber-800/50 transition-colors disabled:opacity-50 min-w-[160px]">
            {testing === integ.id ? (
              <div className="w-4 h-4 border-2 border-amber-300 border-t-amber-600 rounded-full animate-spin"></div>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            )}
            {testing === integ.id ? 'Se testează...' : 'Test Conexiune'}
          </button>
          <button onClick={() => onSync && onSync(integ.id, integ.name)} disabled={syncing === integ.id}
            className="flex items-center justify-center gap-2 px-6 h-11 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-sm transition-all disabled:opacity-50 min-w-[160px]">
            {syncing === integ.id ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            )}
            {syncing === integ.id ? 'Sincronizare...' : 'Sync Meniu'}
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon="🏪" label="Restaurante" value={stats?.restaurants} loading={loadingStats}
          onClick={() => openDrill('restaurants')} />
        <StatCard icon="🍽️" label="Produse" value={stats?.products} loading={loadingStats}
          onClick={() => openDrill('products')} />
        <StatCard icon="📂" label="Categorii" value={stats?.categories} loading={loadingStats}
          onClick={() => openDrill('categories')} />
        <StatCard icon="🔗" label="Brand ID" value={integ.brand_id || '—'} />
      </div>

      {/* Connection details card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 md:p-8 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white m-0 mb-6 flex items-center gap-3">
           <svg className="text-slate-400" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg>
           Detalii Conexiune
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
          {[
            ['Provider', 'Syrve / iiko cloud'],
            ['API URL', integ.credentials?.apiUrl || 'https://api-eu.syrve.live'],
            ['Org ID', integ.credentials?.orgId || '—'],
            ['API Login', integ.credentials?.apiLogin ? '••••••••' : '—'],
          ].map(([k, v]) => (
            <div key={k} className="flex flex-col gap-1">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">{k}</div>
              <div className={`text-sm font-medium text-slate-900 dark:text-white ${v.startsWith('•') ? 'font-mono tracking-widest text-lg translate-y-1' : ''}`}>{v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
