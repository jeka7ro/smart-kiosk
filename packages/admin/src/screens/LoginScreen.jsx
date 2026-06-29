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
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm z-0 pointer-events-none"></div>

      <div className="relative z-10 mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md py-8 px-4 shadow-2xl sm:rounded-3xl sm:px-10 border border-white/40 dark:border-slate-700/50">
          <div className="mb-8">
            <img
              src="/getapp_smart_kiosk_logo.png"
              alt="GetApp Smart Kiosk"
              className="mx-auto h-16 w-auto"
            />
            <h2 className="mt-6 text-center text-3xl font-extrabold text-slate-900 dark:text-white">
              Autentificare
            </h2>
            <p className="mt-2 text-center text-sm text-slate-600 dark:text-slate-400">
              Smart Kiosk Admin Panel
            </p>
          </div>
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Email / Utilizator
              </label>
              <div className="mt-1">
                <input
                  type="text"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="admin@kiosk.ro"
                  required
                  className="appearance-none block w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm placeholder-slate-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-white transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Parolă
              </label>
              <div className="mt-1 relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="appearance-none block w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm placeholder-slate-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-white transition-colors pr-10"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-500 focus:outline-none"
                  onClick={() => setShowPass(v => !v)}
                  tabIndex={-1}
                >
                  {showPass ? (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  checked={remember}
                  onChange={e => setRemember(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded cursor-pointer"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-slate-900 dark:text-slate-300 cursor-pointer">
                  Ține-mă minte
                </label>
              </div>
            </div>

            {error && (
              <div className="rounded-md bg-red-50 dark:bg-red-900/30 p-4 border border-red-200 dark:border-red-800">
                <div className="flex">
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                      {error}
                    </h3>
                  </div>
                </div>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-full shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Se verifică...' : 'Log in'}
              </button>
            </div>
          </form>

          <div className="mt-6 text-center">
            <a href="https://www.getapp.ro" target="_blank" rel="noopener noreferrer" className="text-sm text-slate-500 hover:text-slate-900 dark:hover:text-slate-300 transition-colors">
              www.getapp.ro
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
