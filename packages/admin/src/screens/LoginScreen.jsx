import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthProvider';

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Restore remembered credentials
  useEffect(() => {
    const saved = localStorage.getItem('kiosk_remember');
    if (saved) {
      try {
        const { email: e, password: p } = JSON.parse(saved);
        setEmail(e || '');
        setPassword(p || '');
        setRemember(true);
      } catch (_) {}
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (remember) {
        localStorage.setItem('kiosk_remember', JSON.stringify({ email, password }));
      } else {
        localStorage.removeItem('kiosk_remember');
      }
      await login(email, password);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  return (
    <div 
      className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative"
      style={{
        backgroundImage: 'url(/login_bg.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      }}
    >
      <div className="absolute inset-0 bg-black/45 backdrop-blur-md z-0 pointer-events-none" />

      <div className="relative z-10 mt-8 sm:mx-auto sm:w-full sm:max-w-[400px]">
        <div className="apple-modal py-9 px-6 sm:px-9">
          <div className="mb-7 text-center">
            <img
              src="/getapp_smart_kiosk_logo.png"
              alt="GetApp Smart Kiosk"
              className="mx-auto h-13 w-auto"
            />
            <h2 className="mt-5 text-center text-[22px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
              Autentificare
            </h2>
            <p className="mt-1 text-center text-[12px] font-medium text-[#86868B]">
              Smart Kiosk Admin Backoffice
            </p>
          </div>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-[12px] font-semibold text-[#6E6E73] dark:text-[#98989D] mb-1.5">
                Email / Utilizator
              </label>
              <input
                type="text"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@kiosk.ro"
                required
                className="apple-input block w-full py-2.5 text-[14px]"
              />
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-[#6E6E73] dark:text-[#98989D] mb-1.5">
                Parolă
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="apple-input block w-full py-2.5 text-[14px] pr-10"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-white focus:outline-none transition-colors cursor-pointer"
                  onClick={() => setShowPass(v => !v)}
                  tabIndex={-1}
                >
                  {showPass ? (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-0.5">
              <label htmlFor="remember-me" className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  checked={remember}
                  onChange={e => setRemember(e.target.checked)}
                  className="w-4 h-4 rounded accent-[#007AFF] cursor-pointer"
                />
                <span className="text-[13px] font-medium text-[#6E6E73] dark:text-[#98989D]">
                  Ține-mă minte
                </span>
              </label>
            </div>

            {error && (
              <div className="rounded-xl bg-[#FF3B30]/10 p-3 border border-[#FF3B30]/20">
                <p className="text-[12px] font-semibold text-[#FF3B30] text-center m-0">
                  {error}
                </p>
              </div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="apple-btn-primary w-full py-2.5 text-[14px]"
              >
                {loading ? 'Se verifică...' : 'Autentificare'}
              </button>
            </div>
          </form>

          <div className="mt-6 text-center">
            <a href="https://www.getapp.ro" target="_blank" rel="noopener noreferrer" className="text-[12px] font-medium text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7] transition-colors">
              www.getapp.ro
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
