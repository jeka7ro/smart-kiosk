import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthProvider';
import './LoginScreen.css';

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
    <div className="login-screen">
      <div className="login-glass-panel">
        <div className="login-header">
          <img
            src="/logo_getapp.png"
            alt="GetApp"
            className="login-logo"
          />
          <h2>Kiosk Gateway</h2>
          <p>Autentificare Securizată</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label>Email / Utilizator</label>
            <input
              type="text"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@kiosk.ro"
              required
            />
          </div>

          <div className="form-group">
            <label>Parolă</label>
            <div className="pass-wrap">
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                className="pass-eye"
                onClick={() => setShowPass(v => !v)}
                tabIndex={-1}
              >
                {showPass ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          <label className="remember-row">
            <input
              type="checkbox"
              checked={remember}
              onChange={e => setRemember(e.target.checked)}
            />
            <span>Ține-mă minte</span>
          </label>

          {error && <div className="login-error">{error}</div>}

          <button type="submit" disabled={loading} className="btn-login">
            {loading ? 'Se verifică...' : 'Log in '}
          </button>
        </form>
      </div>
    </div>
  );
}
