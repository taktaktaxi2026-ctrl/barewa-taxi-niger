import tailwindcss from '@tailwindcss/vite';
import { defineConfig, loadEnv, PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateAppIndexPlugin } from './vite-plugin-generate-app-index';
import componentDebugger from 'vite-plugin-component-debugger';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isStandalone = process.env.VITE_BUILD_STANDALONE === '1';

const externalDeps = [
  'react',
  'react-dom',
  'react/jsx-runtime',
  'react/compiler-runtime',
  'react-router',
  '@blocksdiy/blocks-client-sdk/clientSdk',
  '@blocksdiy/blocks-client-sdk/reactSdk',
  '@blocksdiy/react-common/agent-chat',
  '@blocksdiy/react-common/new-agent-chat',
];

// UMD globals: each external module id → the global the platform's app-render provides on window.
const umdGlobals: Record<string, string> = {
  react: 'React',
  'react-dom': 'ReactDOM',
  'react/jsx-runtime': 'jsxRuntime',
  'react/compiler-runtime': 'reactCompilerRuntime',
  'react-router': 'react-router',
  '@blocksdiy/blocks-client-sdk/clientSdk':
    '@blocksdiy/blocks-client-sdk/clientSdk',
  '@blocksdiy/blocks-client-sdk/reactSdk':
    '@blocksdiy/blocks-client-sdk/reactSdk',
  '@blocksdiy/react-common/agent-chat': '@blocksdiy/react-common/agent-chat',
  '@blocksdiy/react-common/new-agent-chat':
    '@blocksdiy/react-common/new-agent-chat',
};

// CommonJS deps (e.g. react-fast-marquee) call `require("react")` at runtime. Because react & co. are UMD
// externals, the bundler leaves those inner `require(...)` calls literal — and `require` is undefined in
// the browser, so the app crashes ("require is not defined"). This factory-scoped shim resolves a require
// of any external id to the global the platform already provides, so pure-JS CJS npm deps work in the
// compiled bundle. It's a no-op for apps that never call require; non-external requires are bundled by the
// builder so they never reach the shim; an unknown id throws a clear, actionable error.
const umdRequireShim = `var __blocksExternals=${JSON.stringify(umdGlobals)};function require(id){var g=typeof globalThis!=="undefined"?globalThis:this;if(Object.prototype.hasOwnProperty.call(__blocksExternals,id)){var v=g[__blocksExternals[id]];if(v!=null)return v;}throw new Error("[blocks] Cannot require('"+id+"') in the compiled app bundle. Only pure-JS npm dependencies (no native binaries, no install scripts) are supported.");}`;

export default defineConfig(({ mode, command }) => {
  let env = 'production';
  if (isStandalone) {
    const envFromFile = loadEnv(mode, __dirname, '');
    const apiHost = envFromFile.VITE_BLOCKS_API_HOST ?? '';
    console.log('apiHost', apiHost);
    if (apiHost?.includes('localhost')) {
      env = 'development';
    }
  }
  console.log('env', env);

  // Dev server (command === 'serve') must use index.html so / serves the standalone app.
  // When rollupOptions.input is ./src/index.tsx (cloud build), the dev server won't serve index.html at / and you get a blank page.
  const useHtmlEntry = isStandalone || command === 'serve';

  return {
    // Explicit root so dev server finds index.html when run from any cwd (e.g. workspace root)
    root: __dirname,
    plugins: [
      tailwindcss(),
      componentDebugger({
        enabled: true,
        includeAttributes: ['id', 'name', 'path', 'line', 'file'],
        includePaths: [
          'src/pages/**',
          'src/routes/**',
          'src/components/**',
          'src/layout.tsx',
          'src/root.tsx',
        ],
        // shadcn primitives stay untagged. The plugin appends its attributes AFTER {...props}, so a
        // tagged ui/button.tsx would overwrite the page's <Button> tag on the very same DOM node:
        // select mode would then point at the shared primitive (label "Comp", and an Ella edit there
        // restyles every button in the app) instead of the page instance. See BLK-976.
        excludePaths: ['src/components/ui/**'],
        includeContent: true,
        customAttributes: ({ content }) => {
          const attrs: Record<string, string> = {};
          const staticText = content?.trim();

          // Only set when plugin extracted compile-time JSX text.
          if (staticText) {
            attrs['data-dev-static-text'] = staticText;
          }

          return attrs;
        },
      }),
      react({
        babel: {
          plugins: ['babel-plugin-react-compiler'],
        },
      }) as PluginOption,
      // Generate app routing (layout + pages) from the filesystem so the build
      // works without the compiler wiring up src/index.tsx. 'standalone' emits a
      // default/__standalone export (consumed by main.tsx); 'umd' emits AppLayout
      // + per-page named exports (consumed by app-render via window.compiler).
      generateAppIndexPlugin({
        srcDir: path.resolve(__dirname, 'src'),
        mode: useHtmlEntry ? 'standalone' : 'umd',
      }),
      {
        name: 'html-transform',
        transformIndexHtml(html) {
          return html.replaceAll('__ENV__', env);
        },
      },
    ],
    // Use '/' so asset URLs work from any path (e.g. /auth/magic-login, /auth/app-login)
    base: '/',
    mode: 'production',
    resolve: {
      // Single React instance so react/jsx-runtime resolves with correct exports (avoids "does not provide export named 'jsx'").
      dedupe: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
      ],
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@blocks/client-sdk': '@blocksdiy/blocks-client-sdk/clientSdk',
        '@blocks/react-sdk': '@blocksdiy/blocks-client-sdk/reactSdk',
        '@/product-types': path.resolve(__dirname, './src/product-types.ts'),
        // CJS lodash has no default export in ESM; use ESM build in dev so subpath imports work.
        lodash: 'lodash-es',
      },
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
      __ENV__: `"${env}"`,
    },
    optimizeDeps: {
      // CJS deps that don't expose default for ESM; pre-bundle so Vite handles interop.
      // React runtimes: pre-bundle so CJS → ESM gives proper named exports (jsx, jsxs, etc.).
      include: [
        'pusher-js',
        'lodash-es',
        'react',
        'react-dom',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
      ],
    },
    build: {
      minify: false,
      reportCompressedSize: false,
      chunkSizeWarningLimit: 2000,
      target: 'es2022',
      sourcemap: false,
      cssCodeSplit: true,
      manifest: false,
      outDir: `dist/`,
      rolldownOptions: useHtmlEntry
        ? {
            input: './index.html',
          }
        : {
            treeshake: true,
            preserveEntrySignatures: 'exports-only',
            input: {
              main: 'virtual:blocks-app-index',
            },
            external: externalDeps,
            output: {
              format: 'umd',
              entryFileNames: () => {
                return `index.js`;
              },
              name: `compiler`,
              // Factory-scoped require shim so CJS deps that require an external (e.g. react) resolve to
              // the platform-provided global instead of crashing on an undefined `require`.
              intro: umdRequireShim,
              globals: umdGlobals,
            },
          },
    },
  };
});
