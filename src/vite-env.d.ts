/// <reference types="vite/client" />

declare const __ENV__: string;

declare module 'virtual:blocks-app-index' {
  import type { ComponentType } from 'react';

  type StandaloneEntry = {
    id: string;
    name: string;
    component: ComponentType<any>;
  };

  export const __standalone: {
    layout: StandaloneEntry | null;
    pages: StandaloneEntry[];
    defaultPageId: string;
  };

  const defaultExport: typeof __standalone;
  export default defaultExport;
}
