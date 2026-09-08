/**
 * Unit + render specs for the file-system route tree builder (src/lib/route-tree.tsx).
 *
 * `deriveRouteNodes` is pure — these specs feed it synthetic module maps (the
 * import.meta.glob shape) so every folder-convention rule is pinned without
 * fixture files on disk. The render suite then mounts derived trees with
 * React Router to pin the runtime semantics the derivation relies on
 * (nesting through Outlets, splat ranking, hoisted compound paths).
 *
 * The compiler mirrors this derivation in
 * apps/compiler/src/modules/git-sync/fs-routes-path.ts — when a case changes
 * here, its spec must change identically.
 */
import { cleanup, render, screen } from '@testing-library/react';
import React, { type ComponentType } from 'react';
import {
  MemoryRouter,
  Outlet,
  useRoutes,
  type RouteObject,
} from 'react-router';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { deriveRouteNodes, type BlocksRouteNode } from '../lib/route-tree';

afterEach(() => {
  cleanup();
});

/** A distinct component per test id so renders are assertable. */
const comp = (testId: string): { default: ComponentType } => ({
  default: () => <div data-testid={testId} />,
});

/** Layout component: marker + Outlet, like every real layout. */
const layout = (testId: string): { default: ComponentType } => ({
  default: () => (
    <div data-testid={testId}>
      <Outlet />
    </div>
  ),
});

const modules = (
  entries: Record<string, { default?: ComponentType }>,
): Record<string, { default?: ComponentType }> => entries;

/** Strip Components so trees compare structurally. */
const summarize = (nodes: BlocksRouteNode[]): unknown[] =>
  nodes.map((node) => ({
    id: node.id,
    path: node.path,
    index: node.index,
    children: node.children ? summarize(node.children) : undefined,
  }));

const node = (
  id: string,
  path: string | undefined,
  extra: { index?: boolean; children?: unknown[] } = {},
) => ({ id, path, index: extra.index, children: extra.children });

describe('deriveRouteNodes — files', () => {
  test('flat files become literal routes; index becomes the index route', () => {
    const tree = deriveRouteNodes(
      modules({
        '/src/routes/about.tsx': comp('about'),
        '/src/routes/index.tsx': comp('index'),
      }),
    );
    expect(summarize(tree)).toEqual([
      node('routes/about', 'about'),
      node('routes/index', undefined, { index: true }),
    ]);
  });

  test('bracket params and splats map to :param and *', () => {
    const tree = deriveRouteNodes(
      modules({
        '/src/routes/[slug].tsx': comp('slug'),
        '/src/routes/files/[...rest].tsx': comp('files'),
      }),
    );
    expect(summarize(tree)).toEqual([
      node('routes/[slug]', ':slug'),
      node('routes/files/[...rest]', 'files/*'),
    ]);
  });

  test('not-found.tsx is the folder catch-all (*)', () => {
    const tree = deriveRouteNodes(
      modules({ '/src/routes/not-found.tsx': comp('nf') }),
    );
    expect(summarize(tree)).toEqual([node('routes/not-found', '*')]);
  });

  test('literal names keep dots, underscores, and casing', () => {
    const tree = deriveRouteNodes(
      modules({
        '/src/routes/v1.2.tsx': comp('v12'),
        '/src/routes/_drafts.tsx': comp('drafts'),
        '/src/routes/Dashboard.tsx': comp('dash'),
      }),
    );
    expect(summarize(tree)).toEqual([
      node('routes/Dashboard', 'Dashboard'),
      node('routes/_drafts', '_drafts'),
      node('routes/v1.2', 'v1.2'),
    ]);
  });

  test('an empty module map derives an empty tree', () => {
    expect(deriveRouteNodes(modules({}))).toEqual([]);
  });
});

describe('deriveRouteNodes — folders', () => {
  test('a folder WITH layout.tsx becomes a parent node; children nest under it', () => {
    const tree = deriveRouteNodes(
      modules({
        '/src/routes/orders/layout.tsx': layout('orders-layout'),
        '/src/routes/orders/index.tsx': comp('orders-index'),
        '/src/routes/orders/[orderId].tsx': comp('order'),
        '/src/routes/orders/not-found.tsx': comp('orders-nf'),
      }),
    );
    expect(summarize(tree)).toEqual([
      node('routes/orders/layout', 'orders', {
        children: [
          node('routes/orders/[orderId]', ':orderId'),
          node('routes/orders/index', undefined, { index: true }),
          node('routes/orders/not-found', '*'),
        ],
      }),
    ]);
  });

  test('a folder WITHOUT layout.tsx hoists children with compound paths', () => {
    const tree = deriveRouteNodes(
      modules({
        '/src/routes/settings/index.tsx': comp('settings'),
        '/src/routes/settings/notifications.tsx': comp('notifications'),
        '/src/routes/settings/not-found.tsx': comp('settings-nf'),
      }),
    );
    expect(summarize(tree)).toEqual([
      node('routes/settings/index', 'settings'),
      node('routes/settings/not-found', 'settings/*'),
      node('routes/settings/notifications', 'settings/notifications'),
    ]);
  });

  test('param folders contribute :param segments', () => {
    const tree = deriveRouteNodes(
      modules({
        '/src/routes/orders/[id]/edit.tsx': comp('edit'),
        '/src/routes/orders/[id]/index.tsx': comp('detail'),
        '/src/routes/orders/[id]/not-found.tsx': comp('order-nf'),
      }),
    );
    expect(summarize(tree)).toEqual([
      node('routes/orders/[id]/edit', 'orders/:id/edit'),
      node('routes/orders/[id]/index', 'orders/:id'),
      node('routes/orders/[id]/not-found', 'orders/:id/*'),
    ]);
  });

  test('a layout inside a param folder wraps that folder (path carries the param)', () => {
    const tree = deriveRouteNodes(
      modules({
        '/src/routes/orders/[id]/layout.tsx': layout('order-layout'),
        '/src/routes/orders/[id]/index.tsx': comp('order-detail'),
        '/src/routes/orders/[id]/edit.tsx': comp('order-edit'),
      }),
    );
    expect(summarize(tree)).toEqual([
      node('routes/orders/[id]/layout', 'orders/:id', {
        children: [
          node('routes/orders/[id]/edit', 'edit'),
          node('routes/orders/[id]/index', undefined, { index: true }),
        ],
      }),
    ]);
  });

  test('a migrated reserved-name page (index/index.tsx) coexists with a generated root index', () => {
    // The migration maps a legacy page literally named "index" to
    // routes/index/index.tsx (/index) and generates routes/index.tsx ("/") —
    // file and folder share the name without conflict.
    const tree = deriveRouteNodes(
      modules({
        '/src/routes/index.tsx': comp('home'),
        '/src/routes/index/index.tsx': comp('index-page'),
      }),
    );
    expect(summarize(tree)).toEqual([
      node('routes/index', undefined, { index: true }),
      node('routes/index/index', 'index'),
    ]);
  });

  test('layouts nest recursively; layout-less folders inside a layout keep prefixes local', () => {
    const tree = deriveRouteNodes(
      modules({
        '/src/routes/app/layout.tsx': layout('app-layout'),
        '/src/routes/app/index.tsx': comp('app-index'),
        '/src/routes/app/admin/layout.tsx': layout('admin-layout'),
        '/src/routes/app/admin/index.tsx': comp('admin-index'),
        '/src/routes/app/reports/summary.tsx': comp('summary'),
      }),
    );
    expect(summarize(tree)).toEqual([
      node('routes/app/layout', 'app', {
        children: [
          node('routes/app/index', undefined, { index: true }),
          node('routes/app/admin/layout', 'admin', {
            children: [
              node('routes/app/admin/index', undefined, { index: true }),
            ],
          }),
          node('routes/app/reports/summary', 'reports/summary'),
        ],
      }),
    ]);
  });
});

describe('deriveRouteNodes — exclusions and edge cases', () => {
  test('dotfiles and dotfolders never become routes', () => {
    const tree = deriveRouteNodes(
      modules({
        '/src/routes/.drafts/page.tsx': comp('draft'),
        '/src/routes/.hidden.tsx': comp('hidden'),
        '/src/routes/real.tsx': comp('real'),
      }),
    );
    expect(summarize(tree)).toEqual([node('routes/real', 'real')]);
  });

  test('a module without a default export is skipped (with a console report)', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const tree = deriveRouteNodes(
      modules({
        '/src/routes/broken.tsx': {},
        '/src/routes/ok.tsx': comp('ok'),
      }),
    );
    expect(summarize(tree)).toEqual([node('routes/ok', 'ok')]);
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('/src/routes/broken.tsx'),
    );
    consoleError.mockRestore();
  });

  test('a ROOT-level layout.tsx wraps ALL routes as a pathless layout (src/routes/ is the folder)', () => {
    // Same folder rule as everywhere else — and the compiler classifies this
    // file as a layout block (fs-routes-path), so the two derivations agree.
    const tree = deriveRouteNodes(
      modules({
        '/src/routes/layout.tsx': layout('routes-layout'),
        '/src/routes/about.tsx': comp('about'),
        '/src/routes/index.tsx': comp('index'),
      }),
    );
    expect(summarize(tree)).toEqual([
      node('routes/layout', undefined, {
        children: [
          node('routes/about', 'about'),
          node('routes/index', undefined, { index: true }),
        ],
      }),
    ]);
  });

  test('a root splat file and not-found.tsx both derive "*"; the splat file sorts first', () => {
    // Ambiguous authoring the skill forbids — pin the deterministic outcome
    // (first "*" in the array wins in React Router) so it can never flap.
    const tree = deriveRouteNodes(
      modules({
        '/src/routes/not-found.tsx': comp('nf'),
        '/src/routes/[...rest].tsx': comp('splat'),
      }),
    );
    expect(summarize(tree)).toEqual([
      node('routes/[...rest]', '*'),
      node('routes/not-found', '*'),
    ]);
  });

  test('output order is deterministic regardless of module map insertion order', () => {
    const forward = deriveRouteNodes(
      modules({
        '/src/routes/a.tsx': comp('a'),
        '/src/routes/b.tsx': comp('b'),
      }),
    );
    const reversed = deriveRouteNodes(
      modules({
        '/src/routes/b.tsx': comp('b'),
        '/src/routes/a.tsx': comp('a'),
      }),
    );
    expect(summarize(forward)).toEqual(summarize(reversed));
  });
});

describe('derived trees render correctly under React Router', () => {
  const app = deriveRouteNodes(
    modules({
      '/src/routes/index.tsx': comp('page-index'),
      '/src/routes/Dashboard.tsx': comp('page-dashboard'),
      '/src/routes/not-found.tsx': comp('page-not-found'),
      '/src/routes/admin/Users.tsx': comp('page-admin-users'),
      '/src/routes/orders/layout.tsx': layout('orders-layout'),
      '/src/routes/orders/index.tsx': comp('page-orders'),
      '/src/routes/orders/[orderId].tsx': comp('page-order'),
      '/src/routes/orders/not-found.tsx': comp('orders-not-found'),
    }),
  );

  const renderAt = (url: string) => {
    const App = () =>
      useRoutes([
        {
          id: 'root',
          Component: () => (
            <div data-testid="root-layout">
              <Outlet />
            </div>
          ),
          children: app as unknown as RouteObject[],
        },
      ]);
    render(
      <MemoryRouter initialEntries={[url]}>
        <App />
      </MemoryRouter>,
    );
  };

  test('"/" renders the index inside the root layout', () => {
    renderAt('/');
    expect(screen.getByTestId('root-layout')).toBeDefined();
    expect(screen.getByTestId('page-index')).toBeDefined();
  });

  test('flat and hoisted pages render at their URLs', () => {
    renderAt('/Dashboard');
    expect(screen.getByTestId('page-dashboard')).toBeDefined();
    cleanup();
    renderAt('/admin/Users');
    expect(screen.getByTestId('page-admin-users')).toBeDefined();
  });

  test('section pages render inside their folder layout, params resolve', () => {
    renderAt('/orders');
    expect(screen.getByTestId('orders-layout')).toBeDefined();
    expect(screen.getByTestId('page-orders')).toBeDefined();
    cleanup();
    renderAt('/orders/o-123');
    expect(screen.getByTestId('orders-layout')).toBeDefined();
    expect(screen.getByTestId('page-order')).toBeDefined();
  });

  test('an unmatched section URL renders the section 404 inside the section layout', () => {
    renderAt('/orders/o-1/nope/deeper');
    expect(screen.getByTestId('orders-layout')).toBeDefined();
    expect(screen.getByTestId('orders-not-found')).toBeDefined();
    expect(screen.queryByTestId('page-not-found')).toBeNull();
  });

  test('an unmatched root URL renders the app 404; catch-alls never shadow real routes', () => {
    renderAt('/totally-missing');
    expect(screen.getByTestId('page-not-found')).toBeDefined();
    cleanup();
    // Splat ranks lowest: a real route at the same depth always wins.
    renderAt('/Dashboard');
    expect(screen.queryByTestId('page-not-found')).toBeNull();
    expect(screen.getByTestId('page-dashboard')).toBeDefined();
  });

  test('a top-level routes/layout.tsx wraps every URL', () => {
    const wrapped = deriveRouteNodes(
      modules({
        '/src/routes/layout.tsx': layout('routes-layout'),
        '/src/routes/index.tsx': comp('wrapped-index'),
      }),
    );
    const App = () => useRoutes(wrapped as unknown as RouteObject[]);
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('routes-layout')).toBeDefined();
    expect(screen.getByTestId('wrapped-index')).toBeDefined();
  });

  test('a param-folder layout renders around its index and leaf routes', () => {
    const tree = deriveRouteNodes(
      modules({
        '/src/routes/orders/[id]/layout.tsx': layout('order-layout'),
        '/src/routes/orders/[id]/index.tsx': comp('order-detail'),
        '/src/routes/orders/[id]/edit.tsx': comp('order-edit'),
      }),
    );
    const App = () => useRoutes(tree as unknown as RouteObject[]);
    render(
      <MemoryRouter initialEntries={['/orders/o-77/edit']}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('order-layout')).toBeDefined();
    expect(screen.getByTestId('order-edit')).toBeDefined();
    expect(screen.queryByTestId('order-detail')).toBeNull();
  });

  test('the migrated reserved-name pair serves both "/" and "/index"', () => {
    const tree = deriveRouteNodes(
      modules({
        '/src/routes/index.tsx': comp('home'),
        '/src/routes/index/index.tsx': comp('index-page'),
      }),
    );
    const App = () => useRoutes(tree as unknown as RouteObject[]);
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('home')).toBeDefined();
    cleanup();
    render(
      <MemoryRouter initialEntries={['/index']}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('index-page')).toBeDefined();
  });
});
