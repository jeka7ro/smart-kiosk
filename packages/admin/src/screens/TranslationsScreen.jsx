import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthProvider';
import './TranslationsScreen.css';

const LANGUAGES = ['en', 'fr', 'hu', 'ru', 'bg', 'de', 'es', 'uk'];

export default function TranslationsScreen({ backend }) {
  const { fetchWithAuth } = useAuth();
  const [translations, setTranslations] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);

  const [expandedId, setExpandedId] = useState(null);
  const [editData, setEditData] = useState({});

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

  if (loading) return <div className="admin-loading"><span className="spinner"></span> Încărcare dicționar...</div>;

  const productIds = Object.keys(translations);

  return (
    <div className="translations-screen admin-fade-in">
      <div className="admin-top-bar" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p className="admin-subtitle" style={{ margin: 0 }}>
          Ajustează descrierile și ingredientele. Orice schimbare manuală de aici va suprascrie robotul Google Translate.
        </p>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="loc-filter-btn" onClick={fetchTranslations} disabled={submitting}>🔄 Refresh Dicționar</button>
          <button className="loc-add-btn" onClick={handleForceTranslate} disabled={submitting}>
            Pornește Auto-Traducere
          </button>
        </div>
      </div>

      {message && (
        <div className={`admin-alert mb-24 alert-${message.type}`}>
          {message.text}
        </div>
      )}

      {productIds.length === 0 ? (
        <div className="empty-state">
          <h3>Sincronizare Necesară</h3>
          <p>Se pare că nu s-a rulat curând o sincronizare sau lista s-a reinițializat automat. Apasă "Pornește Auto-Traducere" pentru a trage datele live din POS.</p>
        </div>
      ) : (
        <div style={{ background: 'var(--card)', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border)' }}>
          <table className="loc-table hoverable-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', color: '#64748B', fontSize: '0.85rem' }}>
                <th style={{ padding: '16px', fontWeight: 600 }}>ID (Syrve)</th>
                <th style={{ padding: '16px', fontWeight: 600 }}>Denumiere Produs</th>
                <th style={{ padding: '16px', fontWeight: 600 }}>Brand</th>
                <th style={{ padding: '16px', fontWeight: 600 }}>Stare Traduceri</th>
                <th style={{ padding: '16px', fontWeight: 600, textAlign: 'right' }}>Acțiuni</th>
              </tr>
            </thead>
            <tbody>
              {productIds.map(pid => {
                const item = translations[pid];
                const isExpanded = expandedId === pid;
                const missingLangs = LANGUAGES.filter(l => !item.translations[l]).length;

                return (
                  <React.Fragment key={pid}>
                    <tr style={{ borderBottom: '1px solid var(--border)' }} className={isExpanded ? 'active-row' : ''}>
                      <td style={{ padding: '16px', color: '#64748B', fontSize: '0.85rem', fontFamily: 'monospace' }}>{pid.split('-')[0]}...</td>
                      <td style={{ padding: '16px', fontWeight: 600, color: 'var(--text)' }}>{item.name || 'Produs Necunoscut'}</td>
                      <td style={{ padding: '16px' }}>
                        <span style={{ background: 'var(--bg)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                          {item.brandId ? item.brandId.toUpperCase() : 'NEDEFINIT'}
                        </span>
                      </td>
                      <td style={{ padding: '16px' }}>
                        {missingLangs === 0 
                          ? <span style={{ color: '#10b981', fontWeight: 600, fontSize: '0.85rem' }}>Tradus Complet</span>
                          : <span style={{ color: '#f59e0b', fontWeight: 600, fontSize: '0.85rem' }}>Lipsesc {missingLangs} limbi</span>
                        }
                      </td>
                      <td style={{ padding: '16px', textAlign: 'right' }}>
                        <button className="loc-filter-btn" onClick={() => !isExpanded ? openEditor(pid, item) : setExpandedId(null)}>
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
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
