// Rolldown's UMD output leaves bare require() calls for externals inside
// __commonJSMin wrappers. Import this BEFORE any CJS dep that needs it.
import * as React from 'react';

if (typeof globalThis.require !== 'function') {
  (globalThis as any).require = (id: string) => {
    if (id === 'react') return React;
    throw new Error(`require("${id}") is not available`);
  };
}
