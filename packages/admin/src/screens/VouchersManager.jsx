import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthProvider';
import { useConfirm } from '../components/ConfirmModal';
import BrandLogo from '../components/BrandLogo';
import { X, Ticket, Tag, CreditCard, Search, Plus, Pencil, Trash2, CheckCircle2, AlertTriangle } from 'lucide-react';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

const AVAILABLE_BRANDS = [
  { id: 'smashme', name: 'SmashMe' },
  { id: 'crunch', name: 'Crunch' },
  { id: 'rollmaster', name: 'Roll Master' },
  { id: 'lovesushi', name: 'Love Sushi' },
  { id: 'pokiwoki', name: 'Poki-Woki' },
];

const FALLBACK_KIOSKS = [
  { id: 'smashme-main', name: 'SmashMe CJ-1 (Cluj 1)', kioskUrl: 'cluj1' },
  { id: 'cluj2', name: 'SmashMe CJ-2 (Cluj 2)', kioskUrl: 'cluj2' },
  { id: 'sm-brasov', name: 'RollMaster Brașov', kioskUrl: 'sm-brasov' },
  { id: 'smashme-constanta', name: 'CT POKI_WOKI (Constanța)', kioskUrl: 'constanta1' },
];

export default function VouchersManager() {
  const { fetchWithAuth } = useAuth();
  const confirm = useConfirm();

  const [vouchers, setVouchers] = useState([]);
  const [availableKiosks, setAvailableKiosks] = useState(FALLBACK_KIOSKS);
  const [loading, setLoading] = useState(true);
  const [apiNotDeployed, setApiNotDeployed] = useState(false);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    code: '',
    description: '',
    type: 'percentage', // 'percentage' | 'fixed'
    value: 10,
    minOrderAmount: 0,
    maxDiscountAmount: '',
    maxUses: '',
    endDate: '',
    active: true,
    locationIds: [], // strict opt-in: empty = inactive on all kiosks
    brandIds: []     // strict opt-in: empty = inactive on all brands
  });
  const [saving, setSaving] = useState(false);

  const showToast = (msg, type = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchLocations = async () => {
    try {
      const res = await fetchWithAuth(`${BACKEND}/api/locations`);
      if (!res.ok) return;
      const data = await res.json();
      const locs = Array.isArray(data?.locations) ? data.locations : [];
      const activeKiosks = locs.filter(l => l && l.active !== false && l.kioskUrl);
      if (activeKiosks.length > 0) {
        setAvailableKiosks(activeKiosks.map(l => ({
          id: l.id,
          name: l.name || l.id,
          kioskUrl: l.kioskUrl
        })));
      }
    } catch (_) {}
  };

  const fetchVouchers = async () => {
    setLoading(true);
    setApiNotDeployed(false);
    try {
      const res = await fetchWithAuth(`${BACKEND}/api/vouchers`);
      const contentType = res.headers.get('content-type') || '';
      if (res.status === 404 || !contentType.includes('application/json')) {
        setApiNotDeployed(true);
        setVouchers([]);
        return;
      }
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.vouchers)) {
        setVouchers(data.vouchers);
      } else {
        setVouchers([]);
        if (!res.ok) showToast(data.error || 'Nu s-au putut încărca codurile promoționale', 'err');
      }
    } catch (e) {
      setApiNotDeployed(true);
      setVouchers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations();
    fetchVouchers();
  }, []);

  const openCreateModal = () => {
    setEditingId(null);
    setFormData({
      code: '',
      description: '',
      type: 'percentage',
      value: 10,
      minOrderAmount: 0,
      maxDiscountAmount: '',
      maxUses: '',
      endDate: '',
      active: true,
      locationIds: [],
      brandIds: []
    });
    setIsModalOpen(true);
  };

  const openEditModal = (v) => {
    setEditingId(v.id);
    setFormData({
      code: v.code || '',
      description: v.description || '',
      type: v.type || 'percentage',
      value: v.value !== undefined ? v.value : 10,
      minOrderAmount: v.minOrderAmount || 0,
      maxDiscountAmount: v.maxDiscountAmount || '',
      maxUses: v.maxUses || '',
      endDate: v.endDate ? v.endDate.slice(0, 10) : '',
      active: v.active !== undefined ? v.active : true,
      locationIds: Array.isArray(v.locationIds) ? v.locationIds : [],
      brandIds: Array.isArray(v.brandIds) ? v.brandIds : []
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const cleanCode = formData.code.trim().toUpperCase();
    if (!cleanCode) {
      return showToast('Codul promoțional este obligatoriu.', 'err');
    }

    if (Number(formData.value) <= 0) {
      return showToast('Valoarea reducerii trebuie să fie mai mare ca 0.', 'err');
    }

    if (formData.active && (!Array.isArray(formData.locationIds) || formData.locationIds.length === 0)) {
      return showToast('Selectează cel puțin un kiosk pe care să fie activ acest cod.', 'err');
    }

    if (formData.active && (!Array.isArray(formData.brandIds) || formData.brandIds.length === 0)) {
      return showToast('Selectează cel puțin un brand pe care să fie activ acest cod.', 'err');
    }

    setSaving(true);
    try {
      const payload = {
        code: cleanCode,
        description: formData.description.trim(),
        type: formData.type,
        value: Number(formData.value),
        minOrderAmount: Number(formData.minOrderAmount) || 0,
        maxDiscountAmount: formData.maxDiscountAmount ? Number(formData.maxDiscountAmount) : null,
        maxUses: formData.maxUses ? parseInt(formData.maxUses, 10) : null,
        endDate: formData.endDate ? new Date(formData.endDate).toISOString() : null,
        active: Boolean(formData.active),
        locationIds: formData.locationIds,
        brandIds: formData.brandIds
      };

      const url = editingId ? `${BACKEND}/api/vouchers/${editingId}` : `${BACKEND}/api/vouchers`;
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetchWithAuth(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Salvare eșuată');
      }

      showToast(editingId ? 'Cod actualizat cu succes!' : 'Cod creat cu succes!');
      setIsModalOpen(false);
      await fetchVouchers();
    } catch (err) {
      showToast(err.message, 'err');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, code) => {
    const ok = await confirm(`Sigur dorești să ștergi codul promoțional "${code}"?`, {
      title: 'Ștergere Cod Promoțional',
      okLabel: 'Șterge definitiv',
      danger: true
    });
    if (!ok) return;

    try {
      const res = await fetchWithAuth(`${BACKEND}/api/vouchers/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Eroare la ștergere');
      showToast('Codul a fost șters.');
      await fetchVouchers();
    } catch (err) {
      showToast(err.message, 'err');
    }
  };

  const handleToggleActive = async (v) => {
    try {
      const res = await fetchWithAuth(`${BACKEND}/api/vouchers/${v.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !v.active })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Eroare la comutare');
      setVouchers(prev => prev.map(item => item.id === v.id ? { ...item, active: !item.active } : item));
      showToast(v.active ? 'Cod dezactivat' : 'Cod activat');
    } catch (err) {
      showToast(err.message, 'err');
    }
  };

  const filteredVouchers = vouchers.filter(v => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (v.code || '').toLowerCase().includes(q) || (v.description || '').toLowerCase().includes(q);
  });

  const totalActive = vouchers.filter(v => v.active).length;
  const totalUses = vouchers.reduce((acc, v) => acc + (v.usedCount || 0), 0);

  return (
    <div className="space-y-5">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-full bg-[#1C1C1E] dark:bg-[#2C2C2E] text-white shadow-2xl border border-white/10 text-[13px] font-medium flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-4 duration-200">
          {toast.type === 'err' ? <AlertTriangle size={15} className="text-[#FF3B30]" /> : <CheckCircle2 size={15} className="text-[#34C759]" />}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Info Banner if connected backend does not yet have /api/vouchers deployed */}
      {apiNotDeployed && (
        <div className="apple-card px-4 py-3.5 border-[#007AFF]/20 bg-[#007AFF]/[0.05] dark:bg-[#0A84FF]/[0.1] flex items-center justify-between gap-3">
          <div className="text-[13px] text-[#1D1D1F] dark:text-[#F5F5F7]">
            <span className="font-semibold text-[#007AFF] dark:text-[#64D2FF]">Modulul de coduri promoționale așteaptă publicarea (push) pe server.</span>
            <span className="text-[#6E6E73] dark:text-[#98989D] ml-1.5">
              Pe kiosk-uri nu apare nimic până nu publici și activezi explicit codul pe kiosk-ul dorit.
            </span>
          </div>
        </div>
      )}

      {/* Overview Stats — Vibrant Apple App Icon Squircles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="apple-card p-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Coduri Active</div>
            <div className="text-[26px] font-bold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7] mt-1 leading-none">
              {totalActive} <span className="text-[14px] font-normal text-[#86868B]">/ {vouchers.length}</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-[12px] bg-gradient-to-b from-[#34C759] to-[#248A3D] text-white shadow-[0_3px_10px_rgba(52,199,89,0.28)] flex items-center justify-center shrink-0">
            <Ticket size={19} strokeWidth={2.1} />
          </div>
        </div>

        <div className="apple-card p-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Total Utilizări pe Kiosk</div>
            <div className="text-[26px] font-bold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7] mt-1 leading-none">{totalUses}</div>
          </div>
          <div className="w-10 h-10 rounded-[12px] bg-gradient-to-b from-[#0A84FF] to-[#0066D6] text-white shadow-[0_3px_10px_rgba(0,122,255,0.28)] flex items-center justify-center shrink-0">
            <Tag size={18} strokeWidth={2.1} />
          </div>
        </div>

        <div className="apple-card p-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Reducere la Plată</div>
            <div className="text-[14px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mt-1.5 leading-snug">Automată pe ecran & POS</div>
          </div>
          <div className="w-10 h-10 rounded-[12px] bg-gradient-to-b from-[#FF9F0A] to-[#D97706] text-white shadow-[0_3px_10px_rgba(255,149,0,0.28)] flex items-center justify-center shrink-0">
            <CreditCard size={18} strokeWidth={2.1} />
          </div>
        </div>
      </div>

      {/* Header Bar: Capsule Search & Single-Line Add Button */}
      <div className="apple-card p-2.5 flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#86868B] pointer-events-none" />
          <input
            type="text"
            placeholder="Caută cod promoțional..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="apple-input rounded-full w-full h-9 pl-9 pr-8 py-0 text-[13px]"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-white cursor-pointer"
              title="Golește"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="apple-btn-primary px-4 h-9 text-[13px]"
        >
          <Plus size={15} strokeWidth={2.5} />
          <span>Adaugă Cod Nou</span>
        </button>
      </div>

      {/* Vouchers Table */}
      {loading ? (
        <div className="apple-card py-20 flex flex-col items-center justify-center gap-3">
          <div className="w-6 h-6 border-2 border-black/10 dark:border-white/10 border-t-[#007AFF] rounded-full animate-spin" />
          <span className="text-[13px] font-medium text-[#86868B]">Se încarcă codurile promoționale...</span>
        </div>
      ) : filteredVouchers.length === 0 ? (
        <div className="apple-card py-14 text-center px-6">
          <div className="w-12 h-12 rounded-[14px] bg-gradient-to-b from-[#0A84FF]/15 to-[#007AFF]/10 text-[#007AFF] flex items-center justify-center mx-auto mb-3.5">
            <Ticket size={22} />
          </div>
          <h3 className="text-[15px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] m-0">Niciun cod promoțional găsit</h3>
          <p className="text-[13px] text-[#6E6E73] dark:text-[#98989D] mt-1.5 mb-5 max-w-sm mx-auto">
            {search ? 'Nu există coduri care să corespundă căutării tale.' : 'Creează primul cod promoțional pentru reduceri automate pe Kiosk.'}
          </p>
          {!search && (
            <button type="button" onClick={openCreateModal} className="apple-btn-primary px-4 h-9 text-[13px]">
              <Plus size={15} strokeWidth={2.5} />
              <span>Creează Primul Cod</span>
            </button>
          )}
        </div>
      ) : (
        <div className="apple-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px] border-collapse">
              <thead>
                <tr className="bg-black/[0.02] dark:bg-white/[0.02] border-b border-black/[0.06] dark:border-white/[0.08] text-[11px] text-[#6E6E73] dark:text-[#98989D] font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Cod & Descriere</th>
                  <th className="py-3 px-4">Reducere</th>
                  <th className="py-3 px-4">Comandă Min.</th>
                  <th className="py-3 px-4">Utilizări</th>
                  <th className="py-3 px-4">Branduri</th>
                  <th className="py-3 px-4">Kiosk-uri Active</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Acțiuni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.05] dark:divide-white/[0.06]">
                {filteredVouchers.map((v) => {
                  const isExpired = v.endDate && new Date(v.endDate) < new Date();
                  const isMaxedOut = v.maxUses && v.usedCount >= v.maxUses;
                  const isActiveNow = v.active && !isExpired && !isMaxedOut;

                  return (
                    <tr key={v.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-[13px] text-[#1D1D1F] dark:text-[#F5F5F7] bg-black/[0.04] dark:bg-white/[0.08] px-2.5 py-0.5 rounded-lg">
                            {v.code}
                          </span>
                        </div>
                        {v.description && (
                          <div className="text-[12px] text-[#6E6E73] dark:text-[#98989D] mt-1 max-w-xs truncate">{v.description}</div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 tabular-nums">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-semibold bg-[#34C759]/12 text-[#248A3D] dark:text-[#30D158]">
                          {v.type === 'percentage' ? `-${v.value}%` : `-${Number(v.value).toFixed(2)} lei`}
                        </span>
                        {v.maxDiscountAmount && v.type === 'percentage' && (
                          <div className="text-[11px] text-[#86868B] mt-0.5">max {v.maxDiscountAmount} lei</div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 font-medium text-[#1D1D1F] dark:text-[#F5F5F7] tabular-nums">
                        {v.minOrderAmount > 0 ? `${v.minOrderAmount} lei` : <span className="text-[#86868B] font-normal">Fără minim</span>}
                      </td>

                      <td className="py-3.5 px-4 tabular-nums">
                        <div className="font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                          {v.usedCount || 0} <span className="text-[#86868B] font-normal">/ {v.maxUses ? v.maxUses : '∞'}</span>
                        </div>
                        {isMaxedOut && (
                          <span className="text-[11px] font-semibold text-[#FF3B30]">Limita atinsă</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        {(!v.brandIds || v.brandIds.length === 0) ? (
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#FF9500]/12 text-[#C93400] dark:text-[#FF9F0A]">
                            Niciun brand
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {v.brandIds.map(bId => {
                              const found = AVAILABLE_BRANDS.find(b => b.id === bId);
                              return (
                                <span key={bId} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-black/[0.04] dark:bg-white/[0.08] text-[#1D1D1F] dark:text-[#F5F5F7]">
                                  <BrandLogo brandId={bId} size={13} />
                                  <span>{found ? found.name : bId}</span>
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        {(!v.locationIds || v.locationIds.length === 0) ? (
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#FF9500]/12 text-[#C93400] dark:text-[#FF9F0A]">
                            Niciun kiosk (ascuns)
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {v.locationIds.map(locId => {
                              const found = availableKiosks.find(l => l.id === locId || l.kioskUrl === locId);
                              return (
                                <span key={locId} className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#007AFF]/10 text-[#007AFF] dark:text-[#64D2FF]">
                                  {found ? found.name : locId}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(v)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold cursor-pointer transition-colors ${
                            isActiveNow
                              ? 'bg-[#34C759]/12 text-[#248A3D] dark:text-[#30D158] hover:bg-[#34C759]/20'
                              : 'bg-black/[0.05] dark:bg-white/[0.08] text-[#6E6E73] dark:text-[#98989D] hover:bg-black/[0.09]'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isActiveNow ? 'bg-[#34C759]' : 'bg-[#86868B]'}`} />
                          {isActiveNow ? 'Activ' : (isExpired ? 'Expirat' : 'Inactiv')}
                        </button>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditModal(v)}
                            title="Editează cod"
                            className="w-8 h-8 inline-flex items-center justify-center rounded-full bg-black/[0.04] hover:bg-black/[0.08] dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-[#1D1D1F] dark:text-[#F5F5F7] transition-colors cursor-pointer"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(v.id, v.code)}
                            title="Șterge cod"
                            className="w-8 h-8 inline-flex items-center justify-center rounded-full bg-[#FF3B30]/10 hover:bg-[#FF3B30]/20 text-[#FF3B30] transition-colors cursor-pointer"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Adaugă / Editează Cod Promoțional */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-150">
          <div className="apple-modal w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-black/[0.06] dark:border-white/[0.08] mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-[10px] bg-gradient-to-b from-[#0A84FF] to-[#0066D6] text-white shadow-[0_2px_8px_rgba(0,122,255,0.28)] flex items-center justify-center shrink-0">
                  <Ticket size={15} strokeWidth={2.2} />
                </div>
                <h3 className="text-[16px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] m-0">
                  {editingId ? 'Editare Cod Promoțional' : 'Cod Promoțional Nou'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="apple-close-btn"
                title="Închide"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-[13px]">
              <div>
                <label className="block text-[12px] font-semibold text-[#6E6E73] dark:text-[#98989D] mb-1.5">Cod Promoțional *</label>
                <input
                  type="text"
                  required
                  placeholder="Introdu codul"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  className="apple-input w-full font-semibold tracking-wide"
                />
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-[#6E6E73] dark:text-[#98989D] mb-1.5">Descriere (opțional)</label>
                <input
                  type="text"
                  placeholder="Descriere"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="apple-input w-full"
                />
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-[#6E6E73] dark:text-[#98989D] mb-1.5">Tip Reducere</label>
                <div className="apple-segmented w-full grid grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'percentage' })}
                    className={`apple-segmented-item ${formData.type === 'percentage' ? 'is-active' : ''}`}
                  >
                    Procentual (%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'fixed' })}
                    className={`apple-segmented-item ${formData.type === 'fixed' ? 'is-active' : ''}`}
                  >
                    Sumă Fixă (LEI)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-semibold text-[#6E6E73] dark:text-[#98989D] mb-1.5">
                    {formData.type === 'percentage' ? 'Valoare (%) *' : 'Valoare (LEI) *'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={formData.value}
                    onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                    className="apple-input w-full font-semibold tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-[#6E6E73] dark:text-[#98989D] mb-1.5">Comandă Minimă (LEI)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0 = fără minim"
                    value={formData.minOrderAmount}
                    onChange={(e) => setFormData({ ...formData, minOrderAmount: e.target.value })}
                    className="apple-input w-full tabular-nums"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-semibold text-[#6E6E73] dark:text-[#98989D] mb-1.5">Limită Utilizări (opțional)</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Gol = nelimitat"
                    value={formData.maxUses}
                    onChange={(e) => setFormData({ ...formData, maxUses: e.target.value })}
                    className="apple-input w-full tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-[#6E6E73] dark:text-[#98989D] mb-1.5">Dată Expirare (opțional)</label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="apple-input w-full tabular-nums"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[12px] font-semibold text-[#6E6E73] dark:text-[#98989D]">
                    Branduri pe care este activ *
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const allIds = AVAILABLE_BRANDS.map(b => b.id);
                      const allSelected = allIds.every(id => formData.brandIds.includes(id));
                      setFormData({ ...formData, brandIds: allSelected ? [] : allIds });
                    }}
                    className="text-[11.5px] font-semibold text-[#007AFF] hover:underline cursor-pointer"
                  >
                    {AVAILABLE_BRANDS.every(b => formData.brandIds.includes(b.id))
                      ? 'Deselectează toate'
                      : 'Selectează toate'}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {AVAILABLE_BRANDS.map((brand) => {
                    const isSelected = formData.brandIds.includes(brand.id);
                    return (
                      <button
                        key={brand.id}
                        type="button"
                        onClick={() => {
                          const next = isSelected
                            ? formData.brandIds.filter((id) => id !== brand.id)
                            : [...formData.brandIds, brand.id];
                          setFormData({ ...formData, brandIds: next });
                        }}
                        className={`px-3 py-1.5 rounded-full text-[12px] font-semibold inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#007AFF] text-white shadow-[0_2px_6px_rgba(0,122,255,0.28)]'
                            : 'bg-black/[0.04] dark:bg-white/[0.06] text-[#6E6E73] dark:text-[#98989D] hover:bg-black/[0.08] dark:hover:bg-white/[0.12]'
                        }`}
                      >
                        <BrandLogo brandId={brand.id} size={15} />
                        <span>{brand.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[12px] font-semibold text-[#6E6E73] dark:text-[#98989D]">
                    Kiosk-uri pe care este activ *
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const allIds = availableKiosks.map(k => k.id);
                      const allSelected = allIds.length > 0 && allIds.every(id => formData.locationIds.includes(id));
                      setFormData({ ...formData, locationIds: allSelected ? [] : allIds });
                    }}
                    className="text-[11.5px] font-semibold text-[#007AFF] hover:underline cursor-pointer"
                  >
                    {availableKiosks.length > 0 && availableKiosks.every(k => formData.locationIds.includes(k.id))
                      ? 'Deselectează toate'
                      : 'Selectează toate'}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {availableKiosks.map((loc) => {
                    const isSelected = formData.locationIds.includes(loc.id) || (loc.kioskUrl && formData.locationIds.includes(loc.kioskUrl));
                    return (
                      <button
                        key={loc.id}
                        type="button"
                        onClick={() => {
                          const next = isSelected
                            ? formData.locationIds.filter((id) => id !== loc.id && id !== loc.kioskUrl)
                            : [...formData.locationIds, loc.id];
                          setFormData({ ...formData, locationIds: next });
                        }}
                        className={`px-3 py-1.5 rounded-full text-[12px] font-semibold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#007AFF] text-white shadow-[0_2px_6px_rgba(0,122,255,0.28)]'
                            : 'bg-black/[0.04] dark:bg-white/[0.06] text-[#6E6E73] dark:text-[#98989D] hover:bg-black/[0.08] dark:hover:bg-white/[0.12]'
                        }`}
                      >
                        {loc.name}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-[#86868B] mt-1.5 mb-0">
                  Butonul de cod promoțional apare pe un kiosk exclusiv dacă are cel puțin un cod activ selectat pentru acel kiosk.
                </p>
              </div>

              <div className="apple-inset-group px-4 py-3 flex items-center justify-between">
                <div>
                  <div className="text-[13px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">Cod Activ</div>
                  <div className="text-[11px] text-[#86868B]">Permite folosirea codului pe kiosk</div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={formData.active}
                  onClick={() => setFormData({ ...formData, active: !formData.active })}
                  className={`apple-switch ${formData.active ? 'is-on' : ''}`}
                >
                  <span className="apple-switch-thumb" />
                </button>
              </div>

              <div className="pt-3 flex items-center gap-2.5 border-t border-black/[0.06] dark:border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="apple-btn-secondary flex-1 py-2.5 text-[13px]"
                >
                  Anulează
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="apple-btn-primary flex-1 py-2.5 text-[13px]"
                >
                  {saving ? 'Se salvează...' : (editingId ? 'Salvează Modificările' : 'Creează Codul')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
