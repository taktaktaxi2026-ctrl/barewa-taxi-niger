import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { getAuthBaseUrl, hasAuthBaseUrl, login as loginApi } from './auth';

// Theme vars are full OKLCH colors (src/index.css); reference them directly with a fallback.
const theme = {
  background: 'var(--background, oklch(0.985 0 0))',
  foreground: 'var(--foreground, oklch(0.145 0 0))',
  card: 'var(--card, oklch(1 0 0))',
  mutedForeground: 'var(--muted-foreground, oklch(0.556 0 0))',
  border: 'var(--border, oklch(0.922 0 0))',
  primary: 'var(--primary, oklch(0.205 0 0))',
  primaryForeground: 'var(--primary-foreground, oklch(0.985 0 0))',
  secondary: 'var(--secondary, oklch(0.97 0 0))',
  secondaryForeground: 'var(--secondary-foreground, oklch(0.205 0 0))',
};

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1.5rem',
    fontFamily: 'system-ui, sans-serif',
    background: theme.background,
    color: theme.foreground,
  },
  card: {
    width: '100%',
    maxWidth: '400px',
    padding: '1.5rem',
    borderRadius: 'var(--radius, 0.625rem)',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    background: theme.card,
  },
  header: { marginBottom: '1.25rem' },
  title: { fontSize: '1.25rem', fontWeight: 600, margin: '0 0 0.25rem 0' },
  subtitle: { margin: 0, color: theme.mutedForeground, fontSize: '0.875rem' },
  error: { color: '#dc2626', fontSize: '0.875rem', marginTop: '0.5rem' },
  form: { display: 'flex', flexDirection: 'column' as const, gap: '1rem' },
  label: { fontSize: '0.875rem', fontWeight: 500 },
  input: {
    padding: '0.5rem 0.75rem',
    borderRadius: '6px',
    border: `1px solid ${theme.border}`,
    fontSize: '1rem',
    background: theme.card,
  },
  button: {
    padding: '0.5rem 1rem',
    borderRadius: '6px',
    border: 'none',
    fontSize: '0.875rem',
    fontWeight: 500,
    cursor: 'pointer',
  },
  primary: { background: theme.primary, color: theme.primaryForeground },
  secondary: { background: theme.secondary, color: theme.secondaryForeground },
  or: {
    textAlign: 'center' as const,
    margin: '1rem 0',
    fontSize: '0.875rem',
    color: theme.mutedForeground,
  },
  successCard: { textAlign: 'center' as const },
  actions: {
    display: 'flex',
    gap: '0.75rem',
    justifyContent: 'center',
    flexWrap: 'wrap' as const,
    marginTop: '1rem',
  },
};

const defaultAppUrl =
  typeof window !== 'undefined' ? window.location.origin : '';

export function Login() {
  const [email, setEmail] = useState('');
  const [appUrl, setAppUrl] = useState(defaultAppUrl);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');
  const [searchParams] = useSearchParams();
  const hasAttemptedMagic = useRef(false);
  const hasAttemptedAppLogin = useRef(false);

  const isMagicLoginRoute =
    typeof window !== 'undefined' &&
    window.location.pathname === '/auth/magic-login';
  const isAppLoginRoute =
    typeof window !== 'undefined' &&
    window.location.pathname === '/auth/app-login';

  // Redirect to platform to complete magic login, then come back to /auth/app-login
  useEffect(() => {
    if (!isMagicLoginRoute || hasAttemptedMagic.current) {
      return;
    }
    const token = searchParams.get('token');
    if (!token) {
      return;
    }
    hasAttemptedMagic.current = true;
    const base = getAuthBaseUrl('/auth/magic-login');
    if (!base) {
      setError('VITE_BLOCKS_API_HOST is not set');
      return;
    }
    const redirectUrl = window.location.origin;
    window.location.href = `${base}?token=${encodeURIComponent(token)}&redirectUrl=${encodeURIComponent(redirectUrl)}`;
  }, [isMagicLoginRoute, searchParams]);

  // Store token and go to app
  useEffect(() => {
    if (!isAppLoginRoute || hasAttemptedAppLogin.current) {
      return;
    }
    const token = searchParams.get('token');
    if (!token) {
      return;
    }
    hasAttemptedAppLogin.current = true;
    const viteAppId = (import.meta as any).env?.VITE_APP_ID;
    if (viteAppId) {
      localStorage.setItem(`token-${viteAppId}`, token);
    } else {
      localStorage.setItem('token', token);
    }

    const returnPath = searchParams.get('returnPath');
    window.location.href =
      returnPath && returnPath.startsWith('/') ? returnPath : '/';
  }, [isAppLoginRoute, searchParams]);

  const appIdValue =
    (import.meta as any).env?.VITE_APP_ID ??
    (typeof window !== 'undefined' ? (window as any).appId : undefined);
  const returnPath =
    typeof window !== 'undefined' &&
    !window.location.pathname.startsWith('/auth')
      ? window.location.pathname + window.location.search
      : (searchParams.get('returnPath') ?? undefined);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    try {
      const urlToUse = (appUrl || defaultAppUrl).trim() || defaultAppUrl;
      const appId = appIdValue;
      const response = await loginApi(email, urlToUse, appId);
      if (response.redirectToSsoUrl) {
        window.location.href = response.redirectToSsoUrl;
        return;
      }
      if (response.errors) {
        setError('User not found or not allowed');
        return;
      }
      setIsSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isMagicLoginRoute || isAppLoginRoute) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <p style={styles.subtitle}>Completing login…</p>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div style={styles.container}>
        <div style= ...styles.card, ...styles.successCard >
          <h2 style={styles.title}>Email sent!</h2>
          <p style={styles.subtitle}>
            We sent a confirmation email to <strong>{email}</strong>. Click the
            link to continue.
          </p>
          <p
            style={{
              ...styles.subtitle,
              fontSize: '0.75rem',
              marginTop: '0.5rem',
            }}
          >
            The link will open this app at the same URL you’re on now. Using
            preview (e.g. port 4175)? Request the link from that URL first.
          </p>
          <div style={styles.actions}>
            <button
              type="button"
              onClick={handleSubmit}
              style= ...styles.button, ...styles.secondary 
            >
              Send another link
            </button>
            <button
              type="button"
              onClick={() => {
                setIsSuccess(false);
                setEmail('');
              }}
              style= ...styles.button, ...styles.secondary 
            >
              Edit email
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!hasAuthBaseUrl()) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.header}>
            <h1 style={styles.title}>Log in</h1>
            <p style= ...styles.error, marginTop: '0.5rem' >
              Set{' '}
              <code
                style={{
                  background: '#f4f4f5',
                  padding: '0.125rem 0.25rem',
                  borderRadius: 4,
                }}
              >
                VITE_BLOCKS_API_HOST
              </code>{' '}
              in{' '}
              <code
                style={{
                  background: '#f4f4f5',
                  padding: '0.125rem 0.25rem',
                  borderRadius: 4,
                }}
              >
                .env.local
              </code>{' '}
              (e.g.{' '}
              <code
                style={{
                  background: '#f4f4f5',
                  padding: '0.125rem 0.25rem',
                  borderRadius: 4,
                }}
              >
                https://blocks.localhost
              </code>
              ) and restart the dev server.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h1 style={styles.title}>Log in</h1>
          <p style={styles.subtitle}>
            Enter your email to receive a login link
          </p>
          {error && (
            <p style={styles.error} role="alert">
              {error}
            </p>
          )}
        </div>
        <form onSubmit={handleSubmit} style={styles.form}>
          <label htmlFor="email" style={styles.label}>
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@company.com"
            required
            disabled={isSubmitting}
            style={styles.input}
          />
          <button
            type="submit"
            disabled={isSubmitting || !email}
            style= ...styles.button, ...styles.primary 
          >
            {isSubmitting ? 'Sending…' : 'Send me a login link'}
          </button>
        </form>
        <p style={styles.or}>Or</p>
        <form action={getAuthBaseUrl('/authentication/oauth')} method="get">
          <input type="hidden" name="flow" value="app-login" />
          <input type="hidden" name="appUrl" value={appUrl || defaultAppUrl} />
          {appIdValue && (
            <input type="hidden" name="appId" value={appIdValue} />
          )}
          {returnPath && (
            <input type="hidden" name="returnPath" value={returnPath} />
          )}
          <button
            type="submit"
            style= ...styles.button, ...styles.secondary, width: '100%' 
          >
            Continue with Google
          </button>
        </form>
      </div>
    </div>
  );
}
