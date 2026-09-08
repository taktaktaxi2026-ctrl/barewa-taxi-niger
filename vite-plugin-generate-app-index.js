// vite-plugin-generate-app-index.js
//
// Fabricates the app's entry module (`virtual:blocks-app-index`). Two routing
// modes, detected from the filesystem:
//
//  - ROUTES mode (current): `src/routes/` has at least one .tsx route module.
//    The tree itself is built by src/lib/route-tree.tsx via import.meta.glob
//    (folder structure = URL); this plugin only emits a few lines calling it,
//    exported as `__blocksRoutes`.
//
//  - LEGACY pages mode: flat `src/pages/*.tsx` + single `src/layout.tsx`,
//    kept for unmigrated apps/clones. Emits `AppLayout` + one named export
//    per page (app-render treats every non-AppLayout export as a page).
//
// Two OUTPUT shapes via `mode`: 'umd' (cloud bundle → window.compiler; adds
// the index.css import) and 'standalone' (pnpm dev; adds a `__standalone`
// default export that src/main.tsx reads).
import fs from 'fs';
import path from 'path';

const VIRTUAL_ID = 'virtual:blocks-app-index';
const RESOLVED_VIRTUAL_ID = '\0' + VIRTUAL_ID;

// Layout export name expected by app-render's DataProvider in LEGACY mode
// (destructured out of window.compiler so it is not mistaken for a page).
const LAYOUT_EXPORT_NAME = 'AppLayout';

// The app's chat-component renderer (the agent-chat registry item), exposed on the bundle so
// app-render can preview a chat component with the app's own UI kit, theme and SDK when the
// platform asks (IframeApi.onPreviewChatComponent). Present only when the app has the file;
// app-render destructures the export out in LEGACY mode so it is not mistaken for a page.
const CHAT_COMPONENT_RENDERER_EXPORT_NAME = '__agentChatCodeComponent';
const CHAT_COMPONENT_RENDERER_IMPORT_PATH =
  '@/components/ui/agent-chat-code-component';

function chatComponentRendererFile(srcDir) {
  return path.join(srcDir, 'components', 'ui', 'agent-chat-code-component.tsx');
}

/** The renderer export line, or nothing for an app without the agent-chat item. */
function chatComponentRendererLines(srcDir) {
  return fs.existsSync(chatComponentRendererFile(srcDir))
    ? [
        `export * as ${CHAT_COMPONENT_RENDERER_EXPORT_NAME} from ${JSON.stringify(CHAT_COMPONENT_RENDERER_IMPORT_PATH)};`,
      ]
    : [];
}

// Page filenames whose basename (case-insensitive) is treated as the landing page (legacy mode).
const DEFAULT_PAGE_PREFERENCE = ['main', 'home', 'index', 'dashboard'];

function toIdentifier(value, fallback) {
  const cleaned = value.replace(/[^a-zA-Z0-9_$]/g, '_');
  return /^[a-zA-Z_$]/.test(cleaned) ? cleaned : `_${cleaned || fallback}`;
}

function walkTsxFiles(dir) {
  const out = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.')) {
      continue;
    }
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkTsxFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.tsx')) {
      out.push(fullPath);
    }
  }
  return out;
}

/** Routes mode is active when src/routes/ contains at least one .tsx route module. */
function hasRouteModules(srcDir) {
  return walkTsxFiles(path.join(srcDir, 'routes')).length > 0;
}

// RTL apps (`rtl: true` in components.json, set by `shadcn init --rtl`) get the document
// direction stamped into the generated module, so it runs at bundle evaluation — before
// anything mounts, in both the UMD/app-render and standalone paths. The document element
// is the ancestor of portaled content (dialogs, selects, menus), which a wrapper div's
// `dir` never reaches. App code may still override it at runtime (language switcher) —
// effects run after module evaluation.
function readAppRtl(srcDir) {
  try {
    const componentsJson = path.join(srcDir, '..', 'components.json');
    return JSON.parse(fs.readFileSync(componentsJson, 'utf-8')).rtl === true;
  } catch {
    // Pre-init or unreadable — LTR default, nothing stamped.
    return false;
  }
}

const RTL_STAMP_LINE =
  "if (typeof document !== 'undefined') { document.documentElement.dir = 'rtl'; }";

// ---------------------------------------------------------------------------
// ROUTES mode
// ---------------------------------------------------------------------------

/**
 * Routes mode entry: the tree itself is built by src/lib/route-tree.tsx via
 * import.meta.glob — the plugin only wires the entry exports. No Toaster
 * auto-mount here (unlike legacy mode): migrated apps get the Toaster baked
 * into their generated src/root.tsx by the migration, and new apps render it
 * in root.tsx themselves.
 */
function generateRoutesModule(srcDir, mode) {
  const lines = mode === 'umd' ? ["import '@/index.css';"] : [];
  if (readAppRtl(srcDir)) {
    lines.push(RTL_STAMP_LINE);
  }
  lines.push("import { buildBlocksRoutes } from '@/lib/route-tree';");
  lines.push('export const __blocksRoutes = buildBlocksRoutes();');
  lines.push(...chatComponentRendererLines(srcDir));

  if (mode === 'standalone') {
    lines.push('export const __standalone = { routes: __blocksRoutes };');
    lines.push('export default __standalone;');
  }

  return lines.join('\n') + '\n';
}

// ---------------------------------------------------------------------------
// LEGACY pages mode (unchanged behavior)
// ---------------------------------------------------------------------------

function collectPages(pagesDir) {
  const files = walkTsxFiles(pagesDir).sort();
  return files.map((file) => {
    const relFromPages = path
      .relative(pagesDir, file)
      .split(path.sep)
      .join('/')
      .replace(/\.tsx$/, '');
    return {
      // Filename (path relative to src/pages, without extension) is the id/name.
      id: relFromPages,
      name: relFromPages,
      basename: path.basename(file, '.tsx'),
      importPath: `@/pages/${relFromPages}`,
    };
  });
}

function pickDefaultPageId(pages) {
  for (const preferred of DEFAULT_PAGE_PREFERENCE) {
    const match = pages.find((p) => p.basename.toLowerCase() === preferred);
    if (match) {
      return match.id;
    }
  }
  return pages[0]?.id ?? '';
}

function generateLegacyPagesModule(srcDir, mode) {
  const pages = collectPages(path.join(srcDir, 'pages'));
  const layoutPath = path.join(srcDir, 'layout.tsx');
  const sonnerPath = path.join(srcDir, 'components', 'ui', 'sonner.tsx');
  const hasLayout = fs.existsSync(layoutPath);
  const appRtl = readAppRtl(srcDir);

  // Legacy compatibility: apps built when the platform pre-installed shadcn were written against
  // an auto-mounted sonner <Toaster/> (the old generated index mounted it next to the layout), so
  // their layouts never render one. Auto-mount it when the app has sonner installed but the
  // layout doesn't mention Toaster; a current-model layout that renders one explicitly turns
  // this off and avoids double-mounting.
  let autoMountToaster = false;
  if (hasLayout && fs.existsSync(sonnerPath)) {
    try {
      autoMountToaster = !fs
        .readFileSync(layoutPath, 'utf-8')
        .includes('Toaster');
    } catch {
      autoMountToaster = false;
    }
  }

  const lines = mode === 'umd' ? ["import '@/index.css';"] : [];

  if (appRtl) {
    lines.push(RTL_STAMP_LINE);
  }

  if (hasLayout) {
    lines.push("import React from 'react';");
    if (autoMountToaster) {
      lines.push("import { Toaster } from '@/components/ui/sonner';");
    }
    lines.push("import Layout from '@/layout';");
  }

  const usedExportNames = new Set([LAYOUT_EXPORT_NAME]);
  const pageExportNames = [];
  pages.forEach((page, index) => {
    const importVar = `__page${index}`;
    lines.push(`import ${importVar} from ${JSON.stringify(page.importPath)};`);

    let exportName = toIdentifier(page.name, `Page${index}`);
    while (usedExportNames.has(exportName)) {
      exportName = `${exportName}_`;
    }
    usedExportNames.add(exportName);
    pageExportNames.push(exportName);

    lines.push(
      `export const ${exportName} = { id: ${JSON.stringify(page.id)}, name: ${JSON.stringify(page.name)}, component: ${importVar} };`,
    );
  });

  if (hasLayout) {
    lines.push(
      autoMountToaster
        ? 'const __LayoutComponent = ({ children }) => React.createElement(React.Fragment, null, React.createElement(Layout, { children }), React.createElement(Toaster));'
        : 'const __LayoutComponent = ({ children }) => React.createElement(Layout, { children });',
    );
    // Must be named `AppLayout` so app-render's DataProvider picks it up as the layout.
    lines.push(
      `export const ${LAYOUT_EXPORT_NAME} = { id: ${JSON.stringify(LAYOUT_EXPORT_NAME)}, name: ${JSON.stringify(LAYOUT_EXPORT_NAME)}, component: __LayoutComponent };`,
    );
  }

  lines.push(...chatComponentRendererLines(srcDir));

  // UMD/cloud bundle: only AppLayout, the chat-component renderer and page named exports may be
  // present, because app-render treats every other named export as a page. A default or
  // __standalone export here would render as a broken page.
  if (mode === 'standalone') {
    const layoutExpr = hasLayout ? LAYOUT_EXPORT_NAME : 'null';
    const defaultPageId = pickDefaultPageId(pages);
    lines.push(
      `export const __standalone = { layout: ${layoutExpr}, pages: [${pageExportNames.join(', ')}], defaultPageId: ${JSON.stringify(defaultPageId)} };`,
    );
    lines.push('export default __standalone;');
  }

  return lines.join('\n') + '\n';
}

function generateModule(srcDir, mode) {
  if (hasRouteModules(srcDir)) {
    return generateRoutesModule(srcDir, mode);
  }
  return generateLegacyPagesModule(srcDir, mode);
}

/**
 * @param  srcDir: string, mode: 'standalone' | 'umd'  options
 */
export function generateAppIndexPlugin(options) {
  const srcDir = options.srcDir;
  const mode = options.mode;
  const pagesDir = path.join(srcDir, 'pages');
  const routesDir = path.join(srcDir, 'routes');
  const layoutFile = path.join(srcDir, 'layout.tsx');
  const sonnerFile = path.join(srcDir, 'components', 'ui', 'sonner.tsx');
  const rendererFile = chatComponentRendererFile(srcDir);
  const componentsJsonFile = path.join(srcDir, '..', 'components.json');

  return {
    name: 'blocks-generate-app-index',
    resolveId(id) {
      if (id === VIRTUAL_ID) {
        return RESOLVED_VIRTUAL_ID;
      }
      return null;
    },
    load(id) {
      if (id === RESOLVED_VIRTUAL_ID) {
        return generateModule(srcDir, mode);
      }
      return null;
    },
    configureServer(server) {
      const invalidate = (file) => {
        const normalized = path.resolve(file);
        // src/root.tsx is absent on purpose: it only flows through
        // import.meta.glob (route-tree.tsx), which Vite hot-updates itself.
        const isRelevant =
          normalized.startsWith(path.resolve(pagesDir) + path.sep) ||
          normalized.startsWith(path.resolve(routesDir) + path.sep) ||
          normalized === path.resolve(layoutFile) ||
          normalized === path.resolve(sonnerFile) ||
          normalized === path.resolve(rendererFile) ||
          normalized === path.resolve(componentsJsonFile);
        if (!isRelevant) {
          return;
        }
        const mod = server.moduleGraph.getModuleById(RESOLVED_VIRTUAL_ID);
        if (mod) {
          server.moduleGraph.invalidateModule(mod);
        }
        server.ws.send({ type: 'full-reload' });
      };
      server.watcher.on('add', invalidate);
      server.watcher.on('unlink', invalidate);
      // Legacy Toaster auto-mounting depends on layout CONTENT, not only file
      // existence — same for the RTL stamp and components.json. (Routes mode
      // has no content-sensitive inputs: root.tsx flows through
      // import.meta.glob, which Vite hot-updates itself.)
      server.watcher.on('change', (file) => {
        const normalized = path.resolve(file);
        if (
          normalized === path.resolve(layoutFile) ||
          normalized === path.resolve(componentsJsonFile)
        ) {
          invalidate(file);
        }
      });
    },
  };
}
