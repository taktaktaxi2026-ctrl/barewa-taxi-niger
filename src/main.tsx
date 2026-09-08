/**
 * Standalone entry for pnpm dev / pnpm preview only.
 * This file is loaded by index.html in the boilerplate repo. It is NOT used by the SaaS
 * app-render (which loads the compiler's index.js UMD bundle from the compiler service).
 * We only run the standalone UI when loaded as the main entry from our index.html.
 */
import {
  Component,
  ComponentType,
  ReactNode,
  StrictMode,
  useEffect,
  useState,
} from 'react';
import { createRoot } from 'react-dom/client';
import {
  BrowserRouter,
  Link,
  Navigate,
  Outlet,
  Route,
  RouteObject,
  Routes,
  useRoutes,
} from 'react-router';
import {
  ClientProvider,
  ReactClientSdk,
} from '@blocksdiy/blocks-client-sdk/reactSdk';
import './index.css';
import { Login } from './Login';
import { loadFontsFromTheme } from './fonts';
import type { BlocksRoutes } from './lib/route-tree';

// Must run before any import that uses getApiHost/getHost (e.g. SDK)
const apiHost = (import.meta as any).env?.VITE_BLOCKS_API_HOST as
  | string
  | undefined;
const appIdFromEnv = (import.meta as any).env?.VITE_APP_ID as
  | string
  | undefined;
if (typeof window !== 'undefined') {
  if (apiHost) {
    (window as any).__BLOCKS_API_HOST__ = apiHost;
  }
  if (appIdFromEnv) {
    (window as any).appId = appIdFromEnv;
  }
}

// Only run standalone UI when we were loaded by our index.html (not by SaaS app-render).
// SaaS loads the compiler's index.js UMD bundle, not this file.
if (
  typeof window !== 'undefined' &&
  (window as any).__BLOCKS_STANDALONE_ENTRY__
) {
  runApp();
}

/**
 * Standalone-only error boundary. In the SaaS iframe the platform (app-render)
 * owns render-error UX — it catches errors itself and must keep receiving
 * them, so the app tree deliberately ships no boundary of its own. Here
 * nothing else would catch a render crash, so show a minimal recovery screen
 * instead of a white page.
 */
class StandaloneErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            padding: '2rem',
            fontFamily: 'system-ui',
            maxWidth: 480,
            margin: '0 auto',
          }}
        >
          <h2>Something went wrong</h2>
          <p>The app crashed while rendering.</p>
          <pre
            style={{
              background: '#f0f0f0',
              padding: '0.5rem',
              whiteSpace: 'pre-wrap',
            }}
          >
            {this.state.error.message}
          </pre>
          <button onClick={() => window.location.reload()}>Reload</button>
        </div>
      );
    }
    return this.props.children;
  }
}

function getToken(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const viteAppId = (import.meta as any).env?.VITE_APP_ID;
  if (viteAppId) {
    const token = window.localStorage.getItem(`token-${viteAppId}`);
    return token;
  }

  return window.localStorage.getItem('token');
}

async function runApp() {
  loadFontsFromTheme();
  const rootEl = document.getElementById('root');
  if (!rootEl) return;

  // Routes mode: { routes } (nested route tree from src/routes/ + src/root.tsx).
  // Legacy mode: layout and pages as { id, name, component }.
  let app: {
    routes?: BlocksRoutes;
    layout?: { id: string; name: string; component: ComponentType<any> } | null;
    pages?: { id: string; name: string; component: ComponentType<any> }[];
    defaultPageId?: string;
  };

  try {
    // Routing metadata (layout + pages) is generated from the filesystem by
    // vite-plugin-generate-app-index. Page id/name is the source filename.
    const index = await import('virtual:blocks-app-index');
    app = (index as any).default ?? (index as any).__standalone;
  } catch {
    rootEl.innerHTML = `
      <div style="padding: 2rem; font-family: system-ui; max-width: 480px;">
        <h2>No app bundle</h2>
        <p>Build the app in Blocks and push to this repo, or run from the Blocks platform.</p>
        <p>For local preview against Blocks backend:</p>
        <pre style="background: #f0f0f0; padding: 0.5rem;">VITE_BLOCKS_API_HOST=https://blocks.localhost
VITE_APP_ID=your-app-id
pnpm dev</pre>
      </div>
    `;
    return;
  }

  const isRoutesMode = !!app?.routes?.routes?.length;
  if (!isRoutesMode && !app?.pages?.length) {
    rootEl.innerHTML = `
      <div style="padding: 2rem; font-family: system-ui;">
        <h2>No pages</h2>
        <p>This app has no pages yet. Add pages in Blocks and push to this repo.</p>
      </div>
    `;
    return;
  }

  const appId =
    appIdFromEnv ??
    (typeof window !== 'undefined' ? (window as any).appId : undefined);
  if (!appId && apiHost) {
    rootEl.innerHTML = `
      <div style="padding: 2rem; font-family: system-ui; max-width: 480px;">
        <h2>Set VITE_APP_ID</h2>
        <p>To talk to the Blocks backend locally, set:</p>
        <pre style="background: #f0f0f0; padding: 0.5rem;">VITE_BLOCKS_API_HOST=${apiHost}
VITE_APP_ID=your-app-id
pnpm dev</pre>
      </div>
    `;
    return;
  }

  /**
   * Routes mode: the bundle's tree IS a RouteObject tree — useRoutes renders
   * the `Component` field natively. Unmatched URLs render the default 404
   * below unless the app ships its own `not-found.tsx` / splat, which matches
   * first — same behavior as the platform (app-render).
   */
  const RoutesModeApp = ({ routes }: { routes: BlocksRoutes }) => {
    return useRoutes([
      {
        id: 'root',
        Component: routes.root?.Component ?? Outlet,
        children: [
          ...(routes.routes as unknown as RouteObject[]),
          {
            path: '*',
            element: (
              <div
                style={{
                  minHeight: '50vh',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.75rem',
                  padding: '2rem',
                  textAlign: 'center',
                }}
              >
                <h1 style= margin: 0, fontSize: '1.5rem', fontWeight: 600 >
                  Page not found
                </h1>
                <p style= margin: 0, opacity: 0.65 >
                  This page doesn't exist or has moved.
                </p>
                <Link
                  to="/"
                  style= color: 'inherit', textDecoration: 'underline' 
                >
                  Back to home
                </Link>
              </div>
            ),
          },
        ],
      },
    ]);
  };

  const StandaloneApp = () => {
    const [themeMode, setThemeMode] = useState<'dark' | 'light' | 'system'>(
      () =>
        (typeof window !== 'undefined' &&
          (localStorage.getItem('app-theme-mode') as
            | 'dark'
            | 'light'
            | 'system')) ||
        'system',
    );

    useEffect(() => {
      const root = document.documentElement;
      root.classList.remove('light', 'dark');
      const resolved =
        themeMode === 'system'
          ? window.matchMedia('(prefers-color-scheme: dark)').matches
            ? 'dark'
            : 'light'
          : themeMode;
      root.classList.add(resolved);
    }, [themeMode]);

    return (
      <ClientProvider
        client={client!}
        themeMode={themeMode}
        setThemeMode={(mode) => {
          if (typeof window !== 'undefined')
            localStorage.setItem('app-theme-mode', mode);
          setThemeMode(mode);
        }}
      >
        {app!.routes?.routes?.length ? (
          <RoutesModeApp routes={app!.routes} />
        ) : (
          <Routes>
            <Route
              path="/"
              element={
                app!.layout?.component ? (
                  (() => {
                    const LayoutWrap = app!.layout.component;
                    return (
                      <LayoutWrap>
                        <Outlet />
                      </LayoutWrap>
                    );
                  })()
                ) : (
                  <Outlet />
                )
              }
            >
              <Route
                index
                element={
                  <Navigate
                    to={
                      app!.defaultPageId
                        ? `/${app!.defaultPageId}`
                        : `/${app!.pages![0]!.id}`
                    }
                    replace
                  />
                }
              />
              {app!.pages!.map((p) => {
                const raw = p.component;
                const Comp =
                  raw &&
                  typeof raw === 'object' &&
                  'component' in raw &&
                  typeof (raw as { component: ComponentType<any> })
                    .component === 'function'
                    ? (raw as { component: ComponentType<any> }).component
                    : (raw as ComponentType<any>);
                return (
                  <Route
                    key={p.id}
                    path={`/${p.id}`}
                    element={Comp ? <Comp /> : null}
                  />
                );
              })}
              {/* Same as SaaS: allow navigation by page name (e.g. /dashboard) not just id */}
              {app!.pages!.map((p) => {
                if (p.name === p.id) return null;
                const raw = p.component;
                const Comp =
                  raw &&
                  typeof raw === 'object' &&
                  'component' in raw &&
                  typeof (raw as { component: ComponentType<any> })
                    .component === 'function'
                    ? (raw as { component: ComponentType<any> }).component
                    : (raw as ComponentType<any>);
                return (
                  <Route
                    key={`name-${p.name}`}
                    path={`/${p.name}`}
                    element={Comp ? <Comp /> : null}
                  />
                );
              })}
            </Route>
          </Routes>
        )}
      </ClientProvider>
    );
  };

  let client: ReactClientSdk | null = null;

  function AuthenticatedApp() {
    const [token, setTokenState] = useState<string | null>(() => getToken());
    const [clientReady, setClientReady] = useState(false);

    useEffect(() => {
      const t = getToken();
      setTokenState(t);
      if (!t) return;
      const c = new ReactClientSdk({ appId: appId!, token: t });
      client = c;
      c.authenticate().then(() => setClientReady(true));
    }, []);

    if (!token) {
      return <Navigate to="/auth/login" replace />;
    }
    if (!clientReady || !client) {
      return (
        <div
          style={{
            padding: '2rem',
            fontFamily: 'system-ui',
            textAlign: 'center',
          }}
        >
          Loading…
        </div>
      );
    }
    return (
      <StandaloneErrorBoundary>
        <StandaloneApp />
      </StandaloneErrorBoundary>
    );
  }

  createRoot(rootEl).render(
    <StrictMode>
      <BrowserRouter>
        <Routes>
          <Route path="/auth/login" element={<Login />} />
          <Route path="/auth/magic-login" element={<Login />} />
          <Route path="/auth/app-login" element={<Login />} />
          <Route path="*" element={<AuthenticatedApp />} />
        </Routes>
      </BrowserRouter>
    </StrictMode>,
  );
}
