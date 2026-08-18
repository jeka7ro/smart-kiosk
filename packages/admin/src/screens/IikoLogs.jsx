import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthProvider';
import { ChevronDown, ChevronUp, Copy } from 'lucide-react';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'https://smart-kiosk-v7ws.onrender.com';

const STATUS_CONFIG = {
  success: { label: 'Succes', color: '#10b981', bg: '#10b98120' },
  error:   { label: 'Eroare', color: '#ef4444', bg: '#ef444420' },
};

export default function IikoLogs() {
  const { fetchWithAuth } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  const fetchLogs = async () => {
    try {
      const res = await fetchWithAuth(`${BACKEND}/api/iiko-logs`);
      const data = await res.json();
      setLogs(Array.isArray(data) ? data : (data.logs || []));
    } catch (e) {
      console.error('Failed to load iiko logs:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLogs(); }, []);

  const toggleExpand = (id) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  const formatDate = (isoString) => {
    if (!isoString) return '-';
    const d = new Date(isoString);
    return d.toLocaleString('ro-RO', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="admin-section">
        <p style={{ color: 'var(--text-muted)' }}>Se încarcă logurile iiko...</p>
      </div>
    );
  }

  return (
    <div className="admin-section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
          Istoric ultimele comenzi trimise către iiko (Syrve). Apasă pe o comandă pentru detalii (Payload & Răspuns).
        </p>
        <button onClick={fetchLogs} className="bg-white border border-slate-200 text-sm font-medium py-2 px-4 rounded-full shadow-sm hover:bg-slate-50 transition-colors">
          🔄 Reîncarcă
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Data / Ora</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">ID Comandă</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Brand</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Acțiune</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {logs.map((log, idx) => {
                const isExpanded = expandedId === idx;
                const statusInfo = STATUS_CONFIG[log.status] || STATUS_CONFIG.error;
                
                return (
                  <React.Fragment key={idx}>
                    <tr 
                      className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors ${isExpanded ? 'bg-slate-50 dark:bg-slate-800/50' : ''}`}
                      onClick={() => toggleExpand(idx)}
                    >
                      <td className="p-4 text-sm font-medium text-slate-900 dark:text-white whitespace-nowrap">
                        {formatDate(log.timestamp)}
                      </td>
                      <td className="p-4 text-sm font-bold text-slate-900 dark:text-white">
                        #{log.id}
                      </td>
                      <td className="p-4 text-sm text-slate-500">
                        <span className="capitalize">{log.brandId}</span>
                      </td>
                      <td className="p-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border"
                              style={{ backgroundColor: statusInfo.bg, color: statusInfo.color, borderColor: `${statusInfo.color}40` }}>
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <button className="text-slate-400 hover:text-slate-600 transition-colors">
                          {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </button>
                      </td>
                    </tr>
                    
                    {isExpanded && (
                      <tr className="bg-slate-50 dark:bg-slate-800/30">
                        <td colSpan="5" className="p-6 border-b border-slate-200 dark:border-slate-700">
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            
                            {/* Request Payload */}
                            <div>
                              <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-blue-500"></span> 
                                Cerere (Payload Trimis)
                              </h4>
                              <div className="bg-slate-900 rounded-xl p-4 overflow-x-auto border border-slate-700">
                                <pre className="text-xs text-blue-300 font-mono" style={{ margin: 0 }}>
                                  {JSON.stringify(log.payload, null, 2)}
                                </pre>
                              </div>
                            </div>

                            {/* Response */}
                            <div>
                              <div className="flex justify-between items-center mb-2">
                                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2 m-0">
                                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: statusInfo.color }}></span> 
                                  Răspuns (Syrve)
                                </h4>
                                <button 
                                  onClick={() => navigator.clipboard.writeText(JSON.stringify(log.response, null, 2))}
                                  className="text-xs px-2 py-1 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors flex items-center gap-1"
                                >
                                  <Copy size={14} /> Copiază
                                </button>
                              </div>
                              <div className="bg-slate-900 rounded-xl p-4 overflow-x-auto border border-slate-700">
                                <pre className="text-xs text-green-300 font-mono" style={{ margin: 0, color: log.status === 'error' ? '#fca5a5' : '#86efac' }}>
                                  {JSON.stringify(log.response, null, 2)}
                                </pre>
                              </div>
                            </div>
                            
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              
              {logs.length === 0 && (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-slate-500">
                    Nu există loguri recente de la iiko.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
