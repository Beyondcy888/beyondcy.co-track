import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext.js';
import { DotField } from './DotField.jsx';
import { Logo } from '../ui/bits.jsx';

export function AuthLayout({ children }) {
  return (
    <div className="auth">
      <div className="auth-art">
        <DotField />
      </div>
      <main className="auth-panel">
        <div className="auth-inner">
          <Logo height={30} className="auth-logo" />
          {children}
        </div>
      </main>
    </div>
  );
}

export function LoginPage() {
  const { ready, session, signIn, requestPasswordReset } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState('signin'); // signin | forgot | sent
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const from = typeof location.state?.from === 'string' ? location.state.from : '/';

  // Already signed in (and not in the middle of signing in): go straight in.
  if (ready && session && !busy) return <Navigate to={from} replace />;

  async function onSignIn(e) {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setBusy(true);
    const result = await signIn(email, password);
    if (result.error) {
      setError(result.error);
      setBusy(false);
      return;
    }
    navigate(from, { replace: true });
  }

  async function onForgot(e) {
    e.preventDefault();
    setError(null);
    if (!email.trim()) {
      setError('Enter the email you sign in with.');
      return;
    }
    setBusy(true);
    const result = await requestPasswordReset(email);
    setBusy(false);
    if (result.error) setError(result.error);
    else setMode('sent');
  }

  const switchMode = (next) => {
    setError(null);
    setMode(next);
  };

  return (
    <AuthLayout>
      {mode === 'signin' && (
        <form className="auth-form" onSubmit={onSignIn} noValidate>
          <h1 className="auth-title">Sign in to the tracker</h1>
          <div className="uline">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@beyondcy.co"
              autoFocus
            />
          </div>
          <div className="uline">
            <label htmlFor="password">Password</label>
            <div className="uline-row">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
              />
              <button
                type="button"
                className="uline-toggle"
                onClick={() => setShowPassword((s) => !s)}
                aria-pressed={showPassword}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}
          <div className="auth-actions">
            <button type="button" className="link-btn auth-link" onClick={() => switchMode('forgot')}>
              Forgot password?
            </button>
            <button type="submit" className="btn btn-primary auth-submit" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </div>
        </form>
      )}

      {mode === 'forgot' && (
        <form className="auth-form" onSubmit={onForgot} noValidate>
          <h1 className="auth-title">Reset your password</h1>
          <p className="auth-text">Enter the email you sign in with. We'll send a link to set a new password.</p>
          <div className="uline">
            <label htmlFor="reset-email">Email</label>
            <input
              id="reset-email"
              type="email"
              autoComplete="username"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@beyondcy.co"
              autoFocus
            />
          </div>
          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}
          <div className="auth-actions">
            <button type="button" className="link-btn auth-link" onClick={() => switchMode('signin')}>
              Back to sign in
            </button>
            <button type="submit" className="btn btn-primary auth-submit" disabled={busy}>
              {busy ? 'Sending…' : 'Send reset link'}
            </button>
          </div>
        </form>
      )}

      {mode === 'sent' && (
        <div className="auth-form" role="status">
          <h1 className="auth-title">Check your email</h1>
          <p className="auth-text">
            If an account exists for <strong>{email.trim()}</strong>, a reset link is on its way. Open it in this
            browser, on this device.
          </p>
          <div className="auth-actions">
            <button type="button" className="link-btn auth-link" onClick={() => switchMode('signin')}>
              Back to sign in
            </button>
          </div>
        </div>
      )}
    </AuthLayout>
  );
}
