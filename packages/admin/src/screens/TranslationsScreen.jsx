import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthProvider';
import './TranslationsScreen.css';

const LANGUAGES = ['en', 'fr', 'hu', 'ru', 'bg', 'de', 'es', 'uk'];
const PAGE_SIZE = 25;

const BRAND_LOGOS = {
  smashme: '/logo_tech.png',
  welovesushi: '/logo_wls.png',
  ikura: '/ikura_logo.webp'
};

export default function TranslationsScreen({ backend }) {
  const { fetchWithAuth } = useAuth();
  const [translations, setTranslations] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);

  const [expandedId, setExpandedId] = useState(null);
  const [editData, setEditData] = useState({});

  // Table state
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [brandFilter, setBrandFilter] = useState('all');

  useEffect(() => {
    fetchTranslations();
  }, [backend, fetchWithAuth]);

  const fetchTranslations = async () => {
    try {
      setLoading(true);
      const res = await fetchWithAuth(`${backend}/api/admin/translations/`);
      const data = await res.json();
      setTranslations(data || {});
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Eroare la încărcarea traducerilor din baza de date.' });
    } finally {
      setLoading(false);
    }
  };

  const handleForceTranslate = async () => {
    if (!window.confirm('Ești sigur că vrei să rulezi o scanare automată pentru toate elementele lipsă? Va dura câteva minute în fundal.')) return;
    try {
      setSubmitting(true);
      const res = await fetchWithAuth(`${backend}/api/admin/translations/auto-translate`, { method: 'POST' });
      const data = await res.json();
      setMessage({ type: 'success', text: data.message || 'Job-ul de traducere a fost inițiat pe fundal.' });
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Eroare la inițierea traducerii.' });
    } finally {
      setSubmitting(false);
    }
  };

  const openEditor = (productId, item) => {
    setExpandedId(productId);
    setEditData({ ...item.translations });
  };

  const handleSave = async (productId) => {
    try {
      setSubmitting(true);
      setMessage(null);
      
      const payload = {
        productId,
        translations: editData
      };
      
      await fetchWithAuth(`${backend}/api/admin/translations/update`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify(payload)
      });
      
      setMessage({ type: 'success', text: 'Traducerea a fost salvată cu succes!' });
      
      // Update local state without full refetch
      setTranslations(prev => ({
        ...prev,
        [productId]: {
          ...prev[productId],
          translations: {
            ...prev[productId].translations,
            ...editData
          }
        }
      }));
      setExpandedId(null);
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Eroare la salvare. Reîncearcă.' });
    } finally {
      setSubmitting(false);
    }
  };

  // Convert dictionary to array for sorting/pagination
  const productsArray = useMemo(() => {
    return Object.entries(translations).map(([id, data]) => ({ id, ...data }));
  }, [translations]);

  // Derived available brands
  const availableBrands = useMemo(() => {
    const set = new Set(productsArray.map(p => p.brandId).filter(Boolean));
    return Array.from(set).sort();
  }, [productsArray]);

  // Filtered array
  const filteredProducts = useMemo(() => {
    return productsArray.filter(p => {
      if (brandFilter !== 'all' && (p.brandId || '').toLowerCase() !== brandFilter.toLowerCase()) return false;
      if (search) {
        const query = search.toLowerCase();
        const matchesName = p.name && p.name.toLowerCase().includes(query);
        const matchesDesc = p.originalDescription && p.originalDescription.toLowerCase().includes(query);
        if (!matchesName && !matchesDesc) return false;
      }
      return true;
    });
  }, [productsArray, brandFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const pageProducts = filteredProducts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (loading) return <div className="admin-loading"><span className="spinner"></span> Încărcare dicționar...</div>;

  return (
    <div className="translations-screen admin-fade-in" style={{ padding: '0 40px', maxWidth: '1200px', margin: '0 auto', paddingBottom: '100px' }}>
      
      <div className="admin-top-bar" style={{ marginTop: '40px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ flex: 1, minWidth: '300px' }}>
          <p className="admin-subtitle" style={{ margin: 0, color: 'var(--text-muted)' }}>
            Ajustează descrierile produselor pe limbi. Filtrează, caută, sau lansează o sincronizare inteligentă de pe server.
          </p>
          
          <div style={{ display: 'flex', gap: '8px', marginTop: '16px', flexWrap: 'wrap' }}>
            <input 
              type="text" 
              placeholder="Caută produs sau ingredient..." 
              value={search} 
              onChange={e => { setSearch(e.target.value); setPage(1); }} 
              style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '8px', minWidth: '240px', fontSize: '0.85rem' }}
            />
            <button className={`loc-filter-btn ${brandFilter === 'all' ? 'active' : ''}`} onClick={() => { setBrandFilter('all'); setPage(1); }}>
              Toate Brandurile
            </button>
            {availableBrands.map(b => (
              <button 
                key={b} 
                className={`loc-filter-btn ${brandFilter === b.toLowerCase() ? 'active' : ''}`} 
                onClick={() => { setBrandFilter(b.toLowerCase()); setPage(1); }}
                style={brandFilter === b.toLowerCase() ? { background: '#10b981', color: 'white', borderColor: '#10b981' } : {}}
              >
                {b.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="loc-filter-btn" onClick={fetchTranslations} disabled={submitting}>Refresh Dicționar</button>
          <button className="loc-add-btn" onClick={handleForceTranslate} disabled={submitting}>
            Pornește Auto-Traducere
          </button>
        </div>
      </div>

      {message && (
        <div className={`admin-alert mb-24 alert-${message.type}`} style={{ marginBottom: '24px' }}>
          {message.text}
        </div>
      )}

      <div style={{ background: 'var(--card)', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border)' }}>
        <table className="loc-table hoverable-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', color: '#64748B', fontSize: '0.85rem' }}>
              <th style={{ padding: '16px', fontWeight: 600, width: '48px' }}>#</th>
              <th style={{ padding: '16px', fontWeight: 600 }}>Denumiere Produs</th>
              <th style={{ padding: '16px', fontWeight: 600, width: '120px' }}>Brand</th>
              <th style={{ padding: '16px', fontWeight: 600 }}>Stare Traduceri</th>
              <th style={{ padding: '16px', fontWeight: 600, textAlign: 'right' }}>Acțiuni</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  Nu au fost găsite produse cu aceste filtre. Verifică sistemul.
                </td>
              </tr>
            ) : (
              pageProducts.map((item, index) => {
                const pid = item.id;
                const isExpanded = expandedId === pid;
                const missingLangs = LANGUAGES.filter(l => !item.translations[l]).length;
                const brandLower = (item.brandId || '').toLowerCase();
                const logoObj = BRAND_LOGOS[brandLower];

                return (
                  <React.Fragment key={pid}>
                  <tr style={{ borderBottom: '1px solid var(--border)' }} className={isExpanded ? 'active-row' : ''}>
                    <td style={{ padding: '16px', color: '#64748B', fontSize: '0.85rem' }}>
                      {(page - 1) * PAGE_SIZE + index + 1}
                    </td>
                    <td style={{ padding: '16px', fontWeight: 600, color: 'var(--text)' }}>
                      {item.name || 'Produs Necunoscut'}
                    </td>
                    <td style={{ padding: '16px' }}>
                      {logoObj ? (
                        <img src={logoObj} alt={item.brandId} style={{ height: '24px', objectFit: 'contain' }} />
                      ) : (
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                          {item.brandId ? item.brandId.toUpperCase() : 'NEDEFINIT'}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '16px' }}>
                      {missingLangs === 0 
                        ? <span style={{ color: '#10b981', fontWeight: 600, fontSize: '0.85rem' }}>Tradus Complet</span>
                        : <span style={{ color: '#f59e0b', fontWeight: 600, fontSize: '0.85rem' }}>Lipsesc {missingLangs} limbi</span>
                      }
                    </td>
                    <td style={{ padding: '16px', textAlign: 'right' }}>
                      <button className="loc-filter-btn" onClick={() => !isExpanded ? openEditor(pid, item) : setExpandedId(null)} style={{ fontSize: '0.85rem', padding: '6px 12px' }}>
                        {isExpanded ? 'Închide Editor' : 'Editează Limbi'}
                      </button>
                    </td>
                  </tr>
                  
                  {isExpanded && (
                    <tr style={{ background: '#f8fafc' }}>
                      <td colSpan="5" style={{ padding: '24px', borderBottom: '1px solid var(--border)' }}>
                        <div className="tc-body" style={{ background: 'transparent', padding: 0 }}>
                          <div className="original-text">
                            <label>Descriere Originală (Syrve):</label>
                            <p>{item.originalDescription || <em>Fără descriere la bază.</em>}</p>
                          </div>

                          <div className="translations-grid">
                            {LANGUAGES.map(lang => (
                              <div key={lang} className="t-input-group">
                                <label className="t-lang-label">
                                  <img src={`https://flagsapi.com/` + (lang==='en'?'GB':lang==='uk'?'UA':lang.toUpperCase()) + `/flat/24.png`} alt={lang}/>
                                  {lang.toUpperCase()}
                                </label>
                                <textarea 
                                  value={editData[lang] || ''}
                                  onChange={(e) => setEditData({...editData, [lang]: e.target.value})}
                                  placeholder={`Traducerea în ${lang}...`}
                                  rows={3}
                                />
                              </div>
                            ))}
                          </div>
                          
                          <div className="tc-actions">
                            <button className="loc-filter-btn" onClick={() => setExpandedId(null)}>Anulează Modificări</button>
                            <button className="loc-add-btn" onClick={() => handleSave(pid)} disabled={submitting}>
                              {submitting ? 'Se salvează...' : 'Salvează Traducerea Manuală'}
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredProducts.length)} din {filteredProducts.length} produse
          </span>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button className="loc-filter-btn" disabled={page === 1} onClick={() => setPage(1)}>«</button>
            <button className="loc-filter-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</button>
            {Array.from({ length: totalPages }, (_, k) => k + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
              .map((p, idx, arr) => (
                <React.Fragment key={p}>
                  {idx > 0 && arr[idx - 1] !== p - 1 && <span style={{ padding: '4px 8px', color: 'var(--text-muted)' }}>…</span>}
                  <button 
                    className="loc-filter-btn" 
                    style={p === page ? { background: '#10b981', color: 'white', borderColor: '#10b981' } : {}} 
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </button>
                </React.Fragment>
              ))
            }
            <button className="loc-filter-btn" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>›</button>
            <button className="loc-filter-btn" disabled={page === totalPages} onClick={() => setPage(totalPages)}>»</button>
          </div>
        </div>
      )}
    </div>
  );
}
