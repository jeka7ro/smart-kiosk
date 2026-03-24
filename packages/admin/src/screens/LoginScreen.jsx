import { useState } from 'react';
import { useAuth } from '../context/AuthProvider';
import './LoginScreen.css';

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
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
          <img src="/logo_getapp.png" alt="GetApp" style={{ height: '64px', marginBottom: '12px' }} />
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
            <input 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              placeholder="••••••••"
              required 
            />
          </div>

          {error && <div className="login-error">⚠️ {error}</div>}

          <button type="submit" disabled={loading} className="btn-login">
            {loading ? 'Se verifică...' : 'Log in ->'}
          </button>
        </form>
      </div>
    </div>
  );
}
