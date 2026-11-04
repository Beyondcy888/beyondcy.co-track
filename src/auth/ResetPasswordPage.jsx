import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext.js';
import { AuthLayout } from './LoginPage.jsx';
import { Spinner } from '../ui/bits.jsx';

const MIN_LENGTH = 8;

/** Landing page of the reset email (PKCE: the code in the URL is exchanged on load). */
export function ResetPasswordPage() {
  const { ready, session, updatePassword } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_LENGTH) {
      setError(`Use at least ${MIN_LENGTH} characters.`);
      return;
    }
    if (password !== repeat) {
      setError("The two passwords don't match.");
      return;
    }
    setBusy(true);
    const result = await updatePassword(password);
    setBusy(false);
    if (result.error) setError(result.error);
    else setDone(true);
  }

  let body;
  if (!ready) {
    body = (
      <div className="auth-form">
        <Spinner label="Checking your reset link" />
      </div>
    );
  } else if (done) {
    body = (
      <div className="auth-form" role="status">
        <h1 className="auth-title">Password updated</h1>
        <p className="auth-text">You can use your new password from now on.</p>
        <div className="auth-actions">
          <span />
          <button type="button" className="btn btn-primary auth-submit" onClick={() => navigate('/', { replace: true })}>
            Continue
          </button>
        </div>
      </div>
    );
  } else if (!session) {
    body = (
      <div className="auth-form">
        <h1 className="auth-title">This link has expired</h1>
        <p className="auth-text">
          Reset links work once, for a short time, and only in the browser where you asked for them. Request a new one
          from the sign-in page.
        </p>
        <div className="auth-actions">
          <Link className="btn btn-primary auth-submit" to="/login">
            Go to sign in
          </Link>
        </div>
      </div>
    );
  } else {
    body = (
      <form className="auth-form" onSubmit={onSubmit} noValidate>
        <h1 className="auth-title">Set a new password</h1>
        <div className="uline">
          <label htmlFor="new-password">New password</label>
          <input
            id="new-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={`At least ${MIN_LENGTH} characters`}
            autoFocus
          />
        </div>
        <div className="uline">
          <label htmlFor="repeat-password">Repeat the password</label>
          <input
            id="repeat-password"
            type="password"
            autoComplete="new-password"
            value={repeat}
            onChange={(e) => setRepeat(e.target.value)}
          />
        </div>
        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}
        <div className="auth-actions">
          <span />
          <button type="submit" className="btn btn-primary auth-submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save password'}
          </button>
        </div>
      </form>
    );
  }

  return <AuthLayout>{body}</AuthLayout>;
}
