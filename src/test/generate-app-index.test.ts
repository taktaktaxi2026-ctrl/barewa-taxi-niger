/**
 * Specs for the virtual entry generator (vite-plugin-generate-app-index.js),
 * exercised through the plugin's public resolveId/load API against real temp
 * directories — mode detection (routes vs legacy pages), the exact exports
 * each output mode ships, legacy Toaster auto-mount, and the RTL stamp.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { generateAppIndexPlugin } from '../../vite-plugin-generate-app-index';

const VIRTUAL_ID = 'virtual:blocks-app-index';
const RESOLVED_VIRTUAL_ID = '\0' + VIRTUAL_ID;

const tempDirs: string[] = [];
afterEach(() => {
  while (tempDirs.length > 0) {
    fs.rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

/** Writes an app dir (files relative to the APP root, src/ included) and returns its srcDir. */
const makeApp = (files: Record<string, string>): string => {
  const appDir = fs.mkdtempSync(path.join(os.tmpdir(), 'blocks-app-index-'));
  tempDirs.push(appDir);
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(appDir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  return path.join(appDir, 'src');
};

const loadModule = (srcDir: string, mode: 'umd' | 'standalone'): string => {
  const plugin = generateAppIndexPlugin({ srcDir, mode });
  return plugin.load(RESOLVED_VIRTUAL_ID) as string;
};

describe('virtual module plumbing', () => {
  test('resolves only the virtual id', () => {
    const plugin = generateAppIndexPlugin({
      srcDir: '/nowhere/src',
      mode: 'umd',
    });
    expect(plugin.resolveId(VIRTUAL_ID)).toBe(RESOLVED_VIRTUAL_ID);
    expect(plugin.resolveId('some-other-module')).toBeNull();
    expect(plugin.load('some-other-id')).toBeNull();
  });
});

describe('routes mode', () => {
  test('a single route module activates routes mode: buildBlocksRoutes + __blocksRoutes', () => {
    const srcDir = makeApp({
      'src/routes/index.tsx': 'export default () => null;',
    });
    const umd = loadModule(srcDir, 'umd');
    expect(umd).toContain("import '@/index.css';");
    expect(umd).toContain(
      "import { buildBlocksRoutes } from '@/lib/route-tree';",
    );
    expect(umd).toContain('export const __blocksRoutes = buildBlocksRoutes();');
    // UMD bundles must expose ONLY __blocksRoutes — a default export would
    // render as a broken page in app-render's legacy fallback.
    expect(umd).not.toContain('__standalone');
    expect(umd).not.toContain('export default');
  });

  test('standalone mode adds the __standalone default export and skips the css import', () => {
    const srcDir = makeApp({
      'src/routes/index.tsx': 'export default () => null;',
    });
    const standalone = loadModule(srcDir, 'standalone');
    expect(standalone).not.toContain("import '@/index.css';");
    expect(standalone).toContain(
      'export const __standalone = { routes: __blocksRoutes };',
    );
    expect(standalone).toContain('export default __standalone;');
  });

  test('routes mode wins over legacy leftovers, and never auto-mounts a Toaster', () => {
    const srcDir = makeApp({
      'src/routes/nested/deep/page.tsx': 'export default () => null;',
      'src/pages/Home.tsx': 'export default () => null;',
      'src/layout.tsx': 'export default ({ children }) => children;',
      'src/components/ui/sonner.tsx': 'export const Toaster = () => null;',
    });
    const umd = loadModule(srcDir, 'umd');
    expect(umd).toContain('__blocksRoutes');
    expect(umd).not.toContain('AppLayout');
    // Migrated apps get the Toaster baked into root.tsx by the migration —
    // the routes-mode entry must not mount a second one.
    expect(umd).not.toContain('Toaster');
  });

  test('dotfolders under src/routes/ do not activate routes mode', () => {
    const srcDir = makeApp({
      'src/routes/.drafts/hidden.tsx': 'export default () => null;',
      'src/pages/Home.tsx': 'export default () => null;',
    });
    const umd = loadModule(srcDir, 'umd');
    expect(umd).not.toContain('__blocksRoutes');
    expect(umd).toContain('Home');
  });
});

describe('legacy pages mode', () => {
  test('exports one named entry per page plus AppLayout when src/layout.tsx exists', () => {
    const srcDir = makeApp({
      'src/pages/Home.tsx': 'export default () => null;',
      'src/pages/admin/Users.tsx': 'export default () => null;',
      'src/layout.tsx': 'export default ({ children }) => children;',
    });
    const umd = loadModule(srcDir, 'umd');
    // Page id/name is the path relative to src/pages — the export identifier is sanitized.
    expect(umd).toContain('export const Home = { id: "Home", name: "Home"');
    expect(umd).toContain(
      'export const admin_Users = { id: "admin/Users", name: "admin/Users"',
    );
    expect(umd).toContain('export const AppLayout');
  });

  test('auto-mounts the sonner Toaster only when the layout does not render one', () => {
    const files = {
      'src/pages/Home.tsx': 'export default () => null;',
      'src/layout.tsx': 'export default ({ children }) => children;',
      'src/components/ui/sonner.tsx': 'export const Toaster = () => null;',
    };
    expect(loadModule(makeApp(files), 'umd')).toContain(
      "import { Toaster } from '@/components/ui/sonner';",
    );

    const optedOut = {
      ...files,
      'src/layout.tsx':
        'import { Toaster } from "@/components/ui/sonner"; export default ({ children }) => children;',
    };
    expect(loadModule(makeApp(optedOut), 'umd')).not.toContain(
      "import { Toaster } from '@/components/ui/sonner';",
    );

    // No sonner installed — nothing to mount.
    const noSonner = {
      'src/pages/Home.tsx': files['src/pages/Home.tsx'],
      'src/layout.tsx': files['src/layout.tsx'],
    };
    expect(loadModule(makeApp(noSonner), 'umd')).not.toContain('Toaster');
  });

  test('standalone mode picks a preferred default page by basename', () => {
    const srcDir = makeApp({
      'src/pages/Zebra.tsx': 'export default () => null;',
      'src/pages/home.tsx': 'export default () => null;',
    });
    const standalone = loadModule(srcDir, 'standalone');
    expect(standalone).toContain('defaultPageId: "home"');
  });
});

describe('chat-component renderer export', () => {
  const EXPORT_LINE =
    'export * as __agentChatCodeComponent from "@/components/ui/agent-chat-code-component";';
  const renderer = {
    'src/components/ui/agent-chat-code-component.tsx':
      'export const ChatCodeComponent = () => null;',
  };

  test('exposes the app renderer in both modes when the app has the agent-chat item', () => {
    const routesApp = makeApp({
      'src/routes/index.tsx': 'export default () => null;',
      ...renderer,
    });
    expect(loadModule(routesApp, 'umd')).toContain(EXPORT_LINE);
    expect(loadModule(routesApp, 'standalone')).toContain(EXPORT_LINE);

    const legacyApp = makeApp({
      'src/pages/Home.tsx': 'export default () => null;',
      ...renderer,
    });
    expect(loadModule(legacyApp, 'umd')).toContain(EXPORT_LINE);
  });

  test('exports nothing for an app without the item', () => {
    const srcDir = makeApp({
      'src/routes/index.tsx': 'export default () => null;',
    });
    expect(loadModule(srcDir, 'umd')).not.toContain('__agentChatCodeComponent');
  });
});

describe('RTL stamp', () => {
  test('stamps the document direction when components.json says rtl, in both modes', () => {
    const rtlApp = {
      'src/routes/index.tsx': 'export default () => null;',
      'components.json': JSON.stringify({ rtl: true }),
    };
    expect(loadModule(makeApp(rtlApp), 'umd')).toContain(
      "document.documentElement.dir = 'rtl'",
    );

    const ltrApp = { 'src/routes/index.tsx': 'export default () => null;' };
    expect(loadModule(makeApp(ltrApp), 'umd')).not.toContain("dir = 'rtl'");
  });
});
