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
      const res = await fetchWithAuth(`${backend}/api/admin/translations`);
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
      <div className="admin-top-bar">
        <div>
          <h2 className="admin-title">📖 Traduceri Meniu Automate</h2>
          <p className="admin-subtitle">Ajustează descrierile și ingredientele. Orice schimbare de aici va suprascrie robotul Google Translate.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="admin-btn btn-outline" onClick={fetchTranslations} disabled={submitting}>🔄 Refresh</button>
          <button className="admin-btn" onClick={handleForceTranslate} disabled={submitting}>
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
          <h3>Nicio traducere generată</h3>
          <p>Se pare că nu s-a rulat încă nicio sincronizare sau nu ai produse cu descrieri. Apasă "Pornește Auto-Traducere".</p>
        </div>
      ) : (
        <div className="translations-list">
          {productIds.map(pid => {
            const item = translations[pid];
            const isExpanded = expandedId === pid;
            const missingLangs = LANGUAGES.filter(l => !item.translations[l]).length;

            return (
              <div key={pid} className={`translation-card ${isExpanded ? 'expanded' : ''}`}>
                <div className="tc-header" onClick={() => !isExpanded ? openEditor(pid, item) : setExpandedId(null)}>
                  <div className="tc-info">
                    <h4>{item.name || 'Produs Necunoscut'}</h4>
                    <span className="tc-id">ID: {pid.split('-')[0]}...</span>
                  </div>
                  
                  <div className="tc-status">
                    {missingLangs === 0 
                      ? <span className="status-badge success">✅ Tradus Complet</span>
                      : <span className="status-badge warning">⏳ Lipsesc {missingLangs} limbi</span>
                    }
                    <button className="tc-toggle">
                      {isExpanded ? 'Închide' : 'Editează'}
                    </button>
                  </div>
                </div>
                
                {isExpanded && (
                  <div className="tc-body">
                    <div className="original-text">
                      <label>🇷🇴 Descriere Originală (Syrve):</label>
                      <p>{item.originalDescription || <em>Fără descriere.</em>}</p>
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
                      <button className="admin-btn btn-outline" onClick={() => setExpandedId(null)}>Anulează</button>
                      <button className="admin-btn" onClick={() => handleSave(pid)} disabled={submitting}>
                        {submitting ? 'Se salvează...' : 'Salveză Manual'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
