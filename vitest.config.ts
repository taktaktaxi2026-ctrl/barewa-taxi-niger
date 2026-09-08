import { defineConfig } from 'vitest/config';
import path, { resolve } from 'path';
import { fileURLToPath } from 'url';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import babel from '@rolldown/plugin-babel';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    react(),
    babel({
      presets: [reactCompilerPreset()],
    }),
  ],
  test: {
    environment: 'jsdom',
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@blocks/client-sdk': '@blocksdiy/blocks-client-sdk/clientSdk',
      '@blocks/react-sdk': '@blocksdiy/blocks-client-sdk/reactSdk',
    },
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // Some deps ship components that import their own CSS (@copilotkit/react-core's
    // dist/v2/index.css, streamdown/styles.css). vitest externalizes node_modules by
    // default, so Node — which cannot import .css — throws `Unknown file extension
    // ".css"` and any test that mounts an agent-chat page fails, including this
    // boilerplate's own src/test/render-smoke.test.tsx. Inlining these packages routes
    // them through Vite, which handles the CSS import. Keep this list minimal.
    server: {
      deps: {
        inline: [/@copilotkit\//, /@blocksdiy\/react-common/, /streamdown/],
      },
    },
    // e2e specs under test/e2e are Playwright scripts the browser verifier writes via the Playwright MCP —
    // the boilerplate ships NO Playwright dependency, so exclude them here; vitest runs only unit tests.
    // code-actions/** is covered by vitest.code-actions.config.ts (`pnpm test:action`).
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'test/e2e/**',
      'code-actions/**',
    ],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@blocks/client-sdk': '@blocksdiy/blocks-client-sdk/clientSdk',
      '@blocks/react-sdk': '@blocksdiy/blocks-client-sdk/reactSdk',
    },
  },
});
