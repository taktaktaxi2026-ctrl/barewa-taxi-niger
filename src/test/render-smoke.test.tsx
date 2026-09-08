/**
 * Render smoke test: mounts the app the way production composes it — the layout wrapping each
 * page — and fails on any exception thrown during mount. `pnpm build` only proves the code
 * compiles; this proves the app actually renders. It exists because a command palette wired
 * into the layout once shipped crashing every page of a published app: lint and the production
 * build both passed, and nothing ever mounted the tree before real users did.
 *
 * Run with `pnpm test:render` after the build succeeds. Network is stubbed to stay pending
 * forever, so pages mount into their loading/skeleton branch — this suite verifies the MOUNT
 * path only, never data flows, so it is deterministic and needs no backend.
 */
import { cleanup, render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeAll, describe, test, vi } from 'vitest';
import { ClientSdk } from '@blocksdiy/blocks-client-sdk/clientSdk';
import { ClientProvider } from '@blocksdiy/blocks-client-sdk/reactSdk';
import Root from '../root';

// jsdom lacks several browser APIs that shadcn/Base UI components touch at mount time; without
// these stubs every app with a sidebar (matchMedia) or command palette (scrollIntoView) would
// fail here despite working in a real browser. Behavior-free stubs — enough to mount, not to
// interact.
beforeAll(() => {
  if (typeof window.matchMedia !== 'function') {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  }
  if (typeof window.IntersectionObserver !== 'function') {
    class IntersectionObserverStub {
      readonly root = null;
      readonly rootMargin = '';
      readonly thresholds: ReadonlyArray<number> = [];
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords(): IntersectionObserverEntry[] {
        return [];
      }
    }
    vi.stubGlobal('IntersectionObserver', IntersectionObserverStub);
  }
  if (typeof Element.prototype.scrollIntoView !== 'function') {
    Element.prototype.scrollIntoView = () => {};
  }
  if (typeof Element.prototype.hasPointerCapture !== 'function') {
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
  }
  // Data must never load OR fail: a pending-forever fetch keeps every data hook in its loading
  // state, so a page's error/success branches (which need a backend) stay out of scope.
  vi.stubGlobal('fetch', () => new Promise(() => {}));
});

afterEach(() => {
  cleanup();
});

// Same discovery rule as the app-index plugin (vite-plugin-generate-app-index.js): routes mode
// when src/routes has .tsx modules; legacy pages mode otherwise.
const routeModules = import.meta.glob('../routes/**/*.tsx');
const pageModules = import.meta.glob('../pages/**/*.tsx');
const isRoutesMode = Object.keys(routeModules).length > 0;

// The legacy layout must NOT be a static import: a migrated workspace can lack src/layout.tsx
// entirely (the migration renames it into src/components/), and a static import would fail the
// whole suite on resolution alone — routes-mode tests included, which never mount it.
const layoutModules = import.meta.glob('../layout.tsx', {
  eager: true,
}) as Record<
  string,
  { default?: React.ComponentType<{ children?: React.ReactNode }> }
>;
const Layout =
  Object.values(layoutModules)[0]?.default ??
  (({ children }: { children?: React.ReactNode }) => <>{children}</>);

/** Mount a route module the way production composes it: router → SDK → root layout → <Outlet/> → route. */
function mountRoute(node: React.ReactNode): void {
  const client = new ClientSdk({ appId: 'render-smoke-test-app' });
  render(
    <MemoryRouter>
      <ClientProvider client={client}>
        <Routes>
          <Route element={<Root />}>
            <Route index element={node} />
          </Route>
        </Routes>
      </ClientProvider>
    </MemoryRouter>,
  );
}

/** Legacy pages model: the layout wraps each page as children. */
function mountLegacyPage(node: React.ReactNode): void {
  const client = new ClientSdk({ appId: 'render-smoke-test-app' });
  render(
    <MemoryRouter>
      <ClientProvider client={client}>
        <Layout>{node}</Layout>
      </ClientProvider>
    </MemoryRouter>,
  );
}

async function loadDefaultExport(
  load: () => Promise<unknown>,
): Promise<React.ComponentType | undefined> {
  const mod = (await load()) as Record<string, unknown>;
  return (mod.default ??
    Object.values(mod).find((value) => typeof value === 'function')) as
    | React.ComponentType
    | undefined;
}

describe('render smoke', () => {
  // The root layout mounts on EVERY route, so a crash here takes the whole app down — test it
  // alone first so a layout failure is reported as the layout's, not blamed on every route.
  test(isRoutesMode ? 'root layout mounts' : 'layout mounts', () => {
    (isRoutesMode ? mountRoute : mountLegacyPage)(
      <div data-testid="render-smoke-page-slot" />,
    );
  });

  const modules = isRoutesMode ? routeModules : pageModules;
  for (const [file, load] of Object.entries(modules)) {
    const displayPath = file.replace('../', 'src/');
    test(`${displayPath} mounts inside the layout`, async () => {
      const Page = await loadDefaultExport(load);
      if (!Page) {
        return; // not a component module — nothing to mount
      }
      // Section layout.tsx files render an <Outlet/> themselves — mounting them
      // as an index route under Root is valid (empty outlet), same as pages.
      (isRoutesMode ? mountRoute : mountLegacyPage)(<Page />);
    });
  }
});
