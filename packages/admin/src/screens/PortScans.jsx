import { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../context/AuthProvider';
import { io } from 'socket.io-client';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'https://smart-kiosk-v7ws.onrender.com';

export default function PortScans() {
  const { fetchWithAuth } = useAuth();
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const socketRef = useRef(null);

  const fetchScans = async () => {
    try {
      const res = await fetchWithAuth(`${BACKEND}/api/port-scans?limit=200`);
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setScans(data.scans || []);
    } catch (err) {
      console.error('Failed to load port scans:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchScans(); }, []);

  useEffect(() => {
    const socket = io(BACKEND, { transports: ['websocket'] });
    socketRef.current = socket;
    socket.on('connect', () => socket.emit('join', { role: 'admin' }));
    socket.on('port_scan_new', (entry) => {
      setScans(prev => [entry, ...prev]);
    });
    return () => socket.disconnect();
  }, []);

  const totalPages = Math.ceil(scans.length / itemsPerPage) || 1;
  const paginated = scans.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard label="Total Scanări" value={scans.length} color="#6366f1" />
        <StatCard label="Locații Unice" value={new Set(scans.map(s => s.locationId)).size} color="#10b981" />
        <StatCard label="Ultimul Scan" value={scans[0] ? new Date(scans[0].timestamp).toLocaleString('ro-RO') : '—'} color="#3b82f6" isText />
      </div>

      {/* Controls */}
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={fetchScans}
          className="px-4 h-9 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm font-bold transition-colors flex items-center gap-2"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
          Refresh
        </button>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[900px]">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 w-12">Nr.</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Data Scan</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Locație</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Hostname</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">OS</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">POS Port</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Gateway</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Imprimantă Config</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">COM Ports</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Imprimante PC</th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 && (
              <tr>
                <td colSpan={10} className="text-center py-12 text-slate-400">
                  Niciun scan disponibil — reporniți bridge-ul pe un PC
                </td>
              </tr>
            )}
            {paginated.map((scan, idx) => {
              const isExpanded = expandedId === scan._id;
              return (
                <>
                  <tr
                    key={scan._id}
                    onClick={() => setExpandedId(isExpanded ? null : scan._id)}
                    className={`border-b border-slate-100 dark:border-slate-800/50 transition-colors cursor-pointer ${
                      isExpanded ? 'bg-blue-50/50 dark:bg-blue-900/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'
                    }`}
                  >
                    <td className="px-4 py-3 text-center text-slate-400 text-xs font-mono">
                      {(currentPage - 1) * itemsPerPage + idx + 1}
                    </td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      <div className="font-semibold text-slate-700 dark:text-slate-300">
                        {scan.timestamp ? new Date(scan.timestamp).toLocaleDateString('ro-RO') : '—'}
                      </div>
                      <div className="text-slate-400">
                        {scan.timestamp ? new Date(scan.timestamp).toLocaleTimeString('ro-RO') : ''}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs font-bold text-blue-600 dark:text-blue-400">
                      {scan.locationId || '—'}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-slate-600 dark:text-slate-400">
                      {scan.hostname || '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {scan.os || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2.5 py-1 rounded-full bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 text-xs font-bold">
                        {scan.posPort || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium text-[10px] uppercase">
                        {scan.posGateway || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                      {scan.printerName || '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-center">
                      <span className="px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-bold">
                        {(scan.comPorts || []).length}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-center">
                      <span className="px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-bold">
                        {(scan.printers || []).length}
                      </span>
                    </td>
                  </tr>

                  {/* Expanded — full details */}
                  {isExpanded && (
                    <tr key={`${scan._id}-expand`} className="bg-slate-50 dark:bg-slate-800/30">
                      <td colSpan={10} className="px-6 py-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                          {/* COM Ports */}
                          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                              🔌 Porturi COM ({(scan.comPorts || []).length})
                            </h4>
                            {(scan.comPorts || []).length === 0 ? (
                              <p className="text-slate-400 text-xs">Niciun port COM găsit</p>
                            ) : (
                              <div className="space-y-2">
                                {(scan.comPorts || []).map((p, i) => (
                                  <div key={i} className={`flex items-center justify-between p-2 rounded-lg text-xs ${p.path === scan.posPort ? 'bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/30' : 'bg-slate-50 dark:bg-slate-800/50'}`}>
                                    <div>
                                      <span className="font-bold text-slate-700 dark:text-slate-300">{p.path}</span>
                                      {p.path === scan.posPort && <span className="ml-2 px-2 py-0.5 rounded-full bg-purple-500 text-white text-[10px] font-bold">POS</span>}
                                    </div>
                                    <span className="text-slate-400 text-[11px]">{p.manufacturer || p.pnpId || '—'}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Printers */}
                          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                              🖨️ Imprimante Instalate ({(scan.printers || []).length})
                            </h4>
                            {(scan.printers || []).length === 0 ? (
                              <p className="text-slate-400 text-xs">Nicio imprimantă găsită</p>
                            ) : (
                              <div className="space-y-2">
                                {(scan.printers || []).map((p, i) => {
                                  const isConfigured = scan.printerName && p.name && p.name.includes(scan.printerName.replace(/\s+Receipt\d*$/, ''));
                                  return (
                                    <div key={i} className={`p-2 rounded-lg text-xs ${isConfigured ? 'bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30' : 'bg-slate-50 dark:bg-slate-800/50'}`}>
                                      <div className="flex items-center justify-between">
                                        <span className="font-bold text-slate-700 dark:text-slate-300">{p.name}</span>
                                        {isConfigured && <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold">CONFIGURAT</span>}
                                      </div>
                                      <div className="text-slate-400 text-[11px] mt-1">
                                        Driver: {p.driver || '—'} | Port: {p.port || '—'}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 rounded-b-2xl">
          <div className="flex items-center gap-4 text-sm text-slate-500">
            <span className="flex items-center gap-2">
              Afișează
              <select
                value={itemsPerPage}
                onChange={e => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-full px-2 py-0.5 font-medium outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={9999}>Toți</option>
              </select>
            </span>
            <span>Total înregistrări: <strong className="text-slate-700 dark:text-slate-300">{scans.length}</strong></span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-slate-500">Pagina {currentPage} din {totalPages}</span>
            <div className="flex gap-1">
              {[
                { label: '«', action: () => setCurrentPage(1),           disabled: currentPage === 1 },
                { label: '‹', action: () => setCurrentPage(p => p - 1),  disabled: currentPage === 1 },
                { label: '›', action: () => setCurrentPage(p => p + 1),  disabled: currentPage === totalPages },
                { label: '»', action: () => setCurrentPage(totalPages),  disabled: currentPage === totalPages },
              ].map(btn => (
                <button key={btn.label} onClick={btn.action} disabled={btn.disabled}
                  className={`w-8 h-8 rounded-lg border text-sm font-bold flex items-center justify-center transition-colors ${btn.disabled ? 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-300 dark:text-slate-600 cursor-not-allowed' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer'}`}
                >{btn.label}</button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color, isText }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-4 flex flex-col justify-center" style={{ borderLeft: `3px solid ${color}` }}>
      <span className={`${isText ? 'text-sm' : 'text-2xl'} font-bold text-slate-900 dark:text-white`}>{value}</span>
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mt-1">{label}</span>
    </div>
  );
}
