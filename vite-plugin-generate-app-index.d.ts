import type { Plugin } from 'vite';

export declare function generateAppIndexPlugin(options: {
  srcDir: string;
  mode: 'standalone' | 'umd';
}): Plugin;
