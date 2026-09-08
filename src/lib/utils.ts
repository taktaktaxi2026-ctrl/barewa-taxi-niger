import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Keep this file shadcn-shaped: `shadcn init` may overwrite it, but src/lib/ files never persist
// as blocks, so every materialize restores THIS boilerplate version. Platform helpers live in
// src/lib/platform.ts; the re-export below keeps legacy pre-CLI apps working — their code imports
// the helpers from '@/lib/utils' (the old boilerplate kept them here). New code imports from
// '@/lib/platform' directly.
export { getLoginUrl, getPageUrl, getRouteUrl, logOut } from './platform';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
