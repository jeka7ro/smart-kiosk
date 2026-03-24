import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthProvider';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

// Stat card component
function StatCard({ icon, label, value, sub, onClick, loading }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
        borderRadius: 16, padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 8,
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.2s, box-shadow 0.2s',
        boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
      }}
      onMouseEnter={e => onClick && (e.currentTarget.style.transform = 'translateY(-3px)')}
      onMouseLeave={e => onClick && (e.currentTarget.style.transform = 'translateY(0)')}
    >
      <span style={{ fontSize: '1.6rem' }}>{icon}</span>
      {loading
        ? <div style={{ width: 60, height: 32, borderRadius: 8, background: 'var(--border)', animation: 'pulse 1.4s infinite' }} />
        : <span style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text)', lineHeight: 1 }}>{value ?? '—'}</span>
      }
      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</span>
      {sub && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{sub}</span>}
      {onClick && <span style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 600, marginTop: 4 }}>→ Vezi lista</span>}
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

  const STATUS_COLOR = { active: '#10b981', error: '#ef4444', pending: '#94a3b8' };
  const statusColor = STATUS_COLOR[integ?.status] || '#94a3b8';
  const statusLabel = { active: 'Activ', error: 'Eroare', pending: 'Nou' }[integ?.status] || integ?.status;

  if (drillDown) {
    const titles = { restaurants: 'Restaurante', products: 'Produse', categories: 'Categorii' };
    return (
      <div style={{ padding: '0 0 40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <button onClick={() => setDrillDown(null)}
            style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: 10, padding: '8px 16px', color: 'var(--text)', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/></svg>
            Înapoi la integrare
          </button>
          <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: 'var(--text)' }}>{titles[drillDown]} — {integ.name}</h2>
        </div>

        <input value={drillSearch} onChange={e => setDrillSearch(e.target.value)}
          placeholder={`Caută în ${titles[drillDown].toLowerCase()}...`}
          style={{ width: '100%', maxWidth: 380, padding: '9px 14px', border: '1.5px solid var(--border)', borderRadius: 10, background: 'var(--surface)', color: 'var(--text)', fontSize: '0.9rem', marginBottom: 16, boxSizing: 'border-box', outline: 'none' }}
        />

        {drillLoading ? (
          <div style={{ color: 'var(--text-muted)', padding: 40, textAlign: 'center' }}>Se încarcă...</div>
        ) : (
          <div style={{ background: 'var(--surface)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
            {filtered.length === 0
              ? <div style={{ color: 'var(--text-muted)', padding: 40, textAlign: 'center' }}>Niciun rezultat{drillSearch ? ` pentru "${drillSearch}"` : ''}</div>
              : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
                      {drillDown === 'restaurants' && <>
                        <th style={thStyle}>#</th><th style={thStyle}>Nume</th><th style={thStyle}>ID</th><th style={thStyle}>Stare</th>
                      </>}
                      {drillDown === 'products' && <>
                        <th style={thStyle}>#</th><th style={thStyle}>Produs</th><th style={thStyle}>Categorie</th><th style={thStyle}>Preț</th>
                      </>}
                      {drillDown === 'categories' && <>
                        <th style={thStyle}>#</th><th style={thStyle}>Categorie</th><th style={thStyle}>Produse</th>
                      </>}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.slice(0, 200).map((item, i) => (
                      <tr key={item.id || i} style={{ borderBottom: '1px solid var(--border)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surface)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        {drillDown === 'restaurants' && <>
                          <td style={tdStyle}>{i + 1}</td>
                          <td style={{ ...tdStyle, fontWeight: 600 }}>{item.name || item.id}</td>
                          <td style={{ ...tdStyle, fontFamily: 'monospace', color: 'var(--text-muted)', fontSize: '0.78rem' }}>{item.id}</td>
                          <td style={tdStyle}>
                            <span style={{ background: item.active ? 'rgba(16,185,129,0.15)' : 'rgba(100,116,139,0.15)', color: item.active ? '#10b981' : '#94a3b8', borderRadius: 20, padding: '2px 10px', fontSize: '0.73rem', fontWeight: 700 }}>
                              {item.active ? 'Activ' : 'Inactiv'}
                            </span>
                          </td>
                        </>}
                        {drillDown === 'products' && <>
                          <td style={tdStyle}>{i + 1}</td>
                          <td style={{ ...tdStyle, fontWeight: 600 }}>{item.name || item.title}</td>
                          <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>{item.category || item.categoryName || '—'}</td>
                          <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--primary)' }}>{item.price ? `${item.price} lei` : '—'}</td>
                        </>}
                        {drillDown === 'categories' && <>
                          <td style={tdStyle}>{i + 1}</td>
                          <td style={{ ...tdStyle, fontWeight: 600 }}>{item.name || item.title}</td>
                          <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>{item.itemsCount ?? item.products?.length ?? '—'}</td>
                        </>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            }
            {filtered.length > 200 && (
              <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                Afișate primele 200 din {filtered.length} rezultate
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: '0 0 40px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <button onClick={onBack}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 600, padding: 0, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, fontSize: '0.88rem' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/></svg>
            Integrări POS
          </button>
          <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 900, color: 'var(--text)' }}>{integ.name}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
            <span style={{ background: `${statusColor}22`, color: statusColor, borderRadius: 20, padding: '3px 12px', fontSize: '0.78rem', fontWeight: 700 }}>{statusLabel}</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Provider: <strong style={{ color: 'var(--text)' }}>Syrve / iiko</strong></span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Brand: <strong style={{ color: 'var(--text)' }}>{integ.brand_id || '—'}</strong></span>
          </div>
          {stats?.lastSync && (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: 4 }}>Ultima sincronizare: {stats.lastSync}</div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => onTest && onTest(integ.id)} disabled={testing === integ.id}
            style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: 10, padding: '9px 18px', color: '#f59e0b', cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: 6, backdropFilter: 'blur(16px)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            {testing === integ.id ? 'Se testează...' : 'Test Conexiune'}
          </button>
          <button onClick={() => onSync && onSync(integ.id, integ.name)} disabled={syncing === integ.id}
            style={{ background: 'var(--primary)', border: 'none', borderRadius: 10, padding: '9px 18px', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            {syncing === integ.id ? 'Sincronizare...' : 'Sync Meniu'}
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16, marginBottom: 32 }}>
        <StatCard icon="🏪" label="Restaurante" value={stats?.restaurants} loading={loadingStats}
          onClick={() => openDrill('restaurants')} />
        <StatCard icon="🍽️" label="Produse" value={stats?.products} loading={loadingStats}
          onClick={() => openDrill('products')} />
        <StatCard icon="📂" label="Categorii" value={stats?.categories} loading={loadingStats}
          onClick={() => openDrill('categories')} />
        <StatCard icon="🔗" label="Brand ID" value={integ.brand_id || '—'} />
      </div>

      {/* Connection details card */}
      <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: 16, padding: '24px 28px', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
        <h3 style={{ margin: '0 0 16px', fontSize: '1rem', fontWeight: 800, color: 'var(--text)' }}>Detalii Conexiune</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 32px' }}>
          {[
            ['Provider', 'Syrve / iiko cloud'],
            ['API URL', integ.credentials?.apiUrl || 'https://api-eu.syrve.live'],
            ['Org ID', integ.credentials?.orgId || '—'],
            ['API Login', integ.credentials?.apiLogin ? '••••••••' : '—'],
          ].map(([k, v]) => (
            <div key={k}>
              <div style={{ fontSize: '0.73rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>{k}</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text)', fontFamily: v.startsWith('•') ? 'monospace' : 'inherit' }}>{v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const thStyle = { padding: '10px 14px', textAlign: 'left', fontSize: '0.73rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', whiteSpace: 'nowrap' };
const tdStyle = { padding: '11px 14px', color: 'var(--text)', verticalAlign: 'middle' };
