import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthProvider';
import './TranslationsScreen.css';

const LANGUAGES = ['en', 'fr', 'hu', 'ru', 'bg', 'de', 'es', 'uk'];

const BRAND_LOGOS = {
  smashme: '/brands/smashme-logo.png',
  welovesushi: '/brands/welovesushi-logo.png',
  ikura: '/brands/ikura-logo.png',
  sushimaster: '/brands/sushimaster-logo.png'
};

const BRAND_META = {
  smashme:     { name: 'SmashMe',      color: '#ef4444' },
  sushimaster: { name: 'Sushi Master', color: '#f97316' },
  welovesushi: { name: 'WeLoveSushi',  color: '#f97316' },
  ikura:       { name: 'Ikura',        color: '#1e293b' },
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
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState('');
  const [activeBrands, setActiveBrands] = useState(new Set()); // empty = all

  const toggleBrand = (bLower) => {
    setActiveBrands(prev => {
      const next = new Set(prev);
      if (next.has(bLower)) next.delete(bLower);
      else next.add(bLower);
      return next;
    });
    setPage(1);
  };

  useEffect(() => {
    fetchTranslations();
  }, [backend, fetchWithAuth]);

  const fetchTranslations = async () => {
    try {
      setLoading(true);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const res = await fetchWithAuth(`${backend}/api/admin/translations/`, { signal: controller.signal });
      clearTimeout(timeout);
      const data = await res.json();
      setTranslations(data || {});
    } catch (err) {
      if (err.name === 'AbortError') {
        setMessage({ type: 'error', text: 'Server-ul nu răspunde (posibil adormit pe Render). Apasă Refresh peste 30 secunde.' });
      } else {
        setMessage({ type: 'error', text: 'Eroare la încărcarea traducerilor.' });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForceTranslate = async () => {
    if (!window.confirm('Ești sigur? Va dura câteva minute în fundal.')) return;
    try {
      setSubmitting(true);
      const res = await fetchWithAuth(`${backend}/api/admin/translations/auto-translate`, { method: 'POST' });
      const data = await res.json();
      setMessage({ type: 'success', text: data.message || 'Job-ul de traducere a fost inițiat.' });
    } catch (err) {
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
      const payload = { productId, translations: editData };
      await fetchWithAuth(`${backend}/api/admin/translations/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      setMessage({ type: 'success', text: 'Traducerea a fost salvată cu succes!' });
      setTranslations(prev => ({
        ...prev,
        [productId]: { ...prev[productId], translations: { ...prev[productId].translations, ...editData } }
      }));
      setExpandedId(null);
    } catch (err) {
      setMessage({ type: 'error', text: 'Eroare la salvare. Reîncearcă.' });
    } finally {
      setSubmitting(false);
    }
  };

  const productsArray = useMemo(() =>
    Object.entries(translations).map(([id, data]) => ({ id, ...data })),
  [translations]);

  const availableBrands = useMemo(() => {
    const set = new Set(productsArray.map(p => p.brandId).filter(Boolean));
    return Array.from(set).sort();
  }, [productsArray]);

  const filteredProducts = useMemo(() =>
    productsArray.filter(p => {
      if (activeBrands.size > 0 && !activeBrands.has((p.brandId || '').toLowerCase())) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!(p.name || '').toLowerCase().includes(q) && !(p.originalDescription || '').toLowerCase().includes(q)) return false;
      }
      return true;
    }),
  [productsArray, activeBrands, search]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const pageProducts = filteredProducts.slice((page - 1) * pageSize, page * pageSize);

  if (loading) return (
    <div className="admin-loading" style={{ flexDirection: 'column', gap: '12px' }}>
      <span className="spinner"></span>
      <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Încărcare dicționar... (poate dura 30s dacă serverul a adormit)</span>
    </div>
  );

  return (
    <div className="translations-screen admin-fade-in">

      {/* Subtitle + action buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
          Ajustează descrierile produselor pe limbi disponibile.
        </p>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="loc-filter-btn" onClick={fetchTranslations} disabled={submitting}>Refresh</button>
          <button className="loc-add-btn" onClick={handleForceTranslate} disabled={submitting}>Auto-Traducere</button>
        </div>
      </div>

      {/* Brand filter pills + search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>

        {/* Toate */}
        <button
          className={`kl-filter-btn ${activeBrands.size === 0 ? 'active' : ''}`}
          onClick={() => { setActiveBrands(new Set()); setPage(1); }}
        >
          Toate ({productsArray.length})
        </button>

        {/* Brand pills */}
        {availableBrands.map(b => {
          const bLower = b.toLowerCase();
          const meta = BRAND_META[bLower] || { name: b, color: '#6b7a99' };
          const isActive = activeBrands.has(bLower);
          const count = productsArray.filter(p => (p.brandId || '').toLowerCase() === bLower).length;
          return (
            <button
              key={b}
              className={`kl-filter-btn ${isActive ? 'active' : ''}`}
              style={{ '--bc': meta.color, display: 'flex', alignItems: 'center', gap: '6px' }}
              onClick={() => toggleBrand(bLower)}
            >
              {BRAND_LOGOS[bLower] && (
                <img
                  src={BRAND_LOGOS[bLower]}
                  alt={b}
                  style={{ width: '16px', height: '16px', borderRadius: '50%', objectFit: 'contain', flexShrink: 0 }}
                />
              )}
              {meta.name} ({count})
            </button>
          );
        })}

        {/* Search pushed right */}
        <div style={{ marginLeft: 'auto', position: 'relative', minWidth: '220px' }}>
          <input
            type="text"
            placeholder="Caută produs sau ingredient..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '8px 12px', paddingRight: search ? '76px' : '12px',
              border: '1px solid var(--border)', borderRadius: '8px', fontSize: '0.85rem'
            }}
          />
          {search && (
            <span style={{
              position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
              background: '#0f766e', color: '#fff', borderRadius: '10px',
              padding: '1px 7px', fontSize: '0.72rem', fontWeight: 700, whiteSpace: 'nowrap'
            }}>
              {filteredProducts.length} / {productsArray.length}
            </span>
          )}
        </div>
      </div>

      {message && (
        <div className={`admin-alert mb-24 alert-${message.type}`} style={{ marginBottom: '16px' }}>
          {message.text}
        </div>
      )}

      {/* Table */}
      <div style={{ background: 'var(--card)', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border)' }}>
        <table className="loc-table hoverable-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', color: '#64748B', fontSize: '0.85rem' }}>
              <th style={{ padding: '16px', fontWeight: 600, width: '48px' }}>#</th>
              <th style={{ padding: '16px', fontWeight: 600 }}>Denumire Produs</th>
              <th style={{ padding: '16px', fontWeight: 600, width: '120px' }}>Brand</th>
              <th style={{ padding: '16px', fontWeight: 600 }}>Stare Traduceri</th>
              <th style={{ padding: '16px', fontWeight: 600, textAlign: 'right' }}>Acțiuni</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  Nu au fost găsite produse cu aceste filtre.
                </td>
              </tr>
            ) : (
              pageProducts.map((item, index) => {
                const pid = item.id;
                const isExpanded = expandedId === pid;
                const missingLangs = LANGUAGES.filter(l => !item.translations[l]).length;
                const brandLower = (item.brandId || '').toLowerCase();
                const logoSrc = BRAND_LOGOS[brandLower];

                return (
                  <React.Fragment key={pid}>
                    <tr style={{ borderBottom: '1px solid var(--border)' }} className={isExpanded ? 'active-row' : ''}>
                      <td style={{ padding: '16px', color: '#64748B', fontSize: '0.85rem' }}>
                        {(page - 1) * pageSize + index + 1}
                      </td>
                      <td style={{ padding: '16px', fontWeight: 600, color: 'var(--text)' }}>
                        {item.name || 'Produs Necunoscut'}
                      </td>
                      <td style={{ padding: '16px' }}>
                        {logoSrc
                          ? <img src={logoSrc} alt={item.brandId} style={{ height: '24px', objectFit: 'contain' }} />
                          : <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>{(item.brandId || 'NEDEFINIT').toUpperCase()}</span>
                        }
                      </td>
                      <td style={{ padding: '16px' }}>
                        {missingLangs === 0
                          ? <span style={{ color: '#0f766e', fontWeight: 600, fontSize: '0.85rem' }}>Tradus Complet</span>
                          : <span style={{ color: '#f59e0b', fontWeight: 600, fontSize: '0.85rem' }}>Lipsesc {missingLangs} limbi</span>
                        }
                      </td>
                      <td style={{ padding: '16px', textAlign: 'right' }}>
                        <button className="loc-filter-btn" style={{ fontSize: '0.85rem', padding: '6px 12px' }}
                          onClick={() => isExpanded ? setExpandedId(null) : openEditor(pid, item)}>
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
                                    <img
                                      src={`https://flagsapi.com/${lang === 'en' ? 'GB' : lang === 'uk' ? 'UA' : lang.toUpperCase()}/flat/24.png`}
                                      alt={lang}
                                    />
                                    {lang.toUpperCase()}
                                  </label>
                                  <textarea
                                    value={editData[lang] || ''}
                                    onChange={e => setEditData({ ...editData, [lang]: e.target.value })}
                                    placeholder={`Traducerea în ${lang}...`}
                                    rows={3}
                                  />
                                </div>
                              ))}
                            </div>
                            <div className="tc-actions">
                              <button className="loc-filter-btn" onClick={() => setExpandedId(null)}>Anulează</button>
                              <button className="loc-add-btn" onClick={() => handleSave(pid)} disabled={submitting}>
                                {submitting ? 'Se salvează...' : 'Salvează Traducerea'}
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

      {/* Bottom footer — page size + range + pagination (same as Kiosks) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '16px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>Rânduri pe pagină:</span>
          <select
            value={pageSize}
            onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
            style={{ padding: '4px 8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '0.85rem', outline: 'none', background: 'var(--card)', color: 'var(--text)', cursor: 'pointer' }}
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <span>
            {filteredProducts.length > 0
              ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, filteredProducts.length)} din ${filteredProducts.length}`
              : '0 rezultate'}
          </span>
        </div>
        {totalPages > 1 && (
          <div style={{ display: 'flex', gap: '4px' }}>
            <button className="loc-filter-btn" disabled={page === 1} onClick={() => setPage(1)}>«</button>
            <button className="loc-filter-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</button>
            {Array.from({ length: totalPages }, (_, k) => k + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
              .map((p, idx, arr) => (
                <React.Fragment key={p}>
                  {idx > 0 && arr[idx - 1] !== p - 1 && <span style={{ padding: '4px 6px' }}>…</span>}
                  <button
                    className="loc-filter-btn"
                    style={p === page ? { background: '#0f766e', color: 'white', borderColor: '#0f766e' } : {}}
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </button>
                </React.Fragment>
              ))}
            <button className="loc-filter-btn" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>›</button>
            <button className="loc-filter-btn" disabled={page === totalPages} onClick={() => setPage(totalPages)}>»</button>
          </div>
        )}
      </div>

    </div>
  );
}
