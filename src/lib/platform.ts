import { generatePath } from 'react-router';
import { PageConfig } from '@blocksdiy/blocks-client-sdk/page';

/**
 * Blocks platform helpers. This file is platform-owned and safe from the shadcn
 * CLI (which overwrites src/lib/utils.ts on init). Canonical implementations stay here;
 * utils.ts only re-exports them as a compatibility shim for pre-CLI app source.
 */

/**
 * LEGACY — kept only so migrated apps' existing calls keep working
 * (`getPageUrl('Dashboard')` → `/Dashboard`, the URL those pages kept after
 * the src/pages → src/routes move). New code navigates with real URLs or
 * {@link getRouteUrl}.
 */
export function getPageUrl(
  page: PageConfig | string,
  searchParams: Record<string, string> = {},
) {
  const appId = (window as any).appId as string | undefined;
  if (!appId) {
    return '';
  }

  const searchParamsString = new URLSearchParams(
    searchParams as Record<string, string>,
  ).toString();

  const { pathname: currentPath } = window.location;
  const pageBlockId = typeof page === 'string' ? page : page.pageBlockId;
  const pageName = typeof page === 'string' ? page : page.pageName;

  if (currentPath.startsWith('/app/')) {
    return `/app/${pageBlockId}${searchParamsString ? `?${searchParamsString}` : ''}`;
  }

  if (currentPath.startsWith('/apps/')) {
    return `/apps/${appId}/design/pages/${pageBlockId}${searchParamsString ? `?${searchParamsString}` : ''}`;
  }

  return `/${pageName || pageBlockId}${searchParamsString ? `?${searchParamsString}` : ''}`;
}

/**
 * Builds a URL for a file-system route (`src/routes/`), filling dynamic params.
 *
 * Pass the route's URL pattern (what the file path under `src/routes/`
 * resolves to), params for any `:param` segments, and optional search params.
 *
 * @example
 * ```ts
 * // src/routes/products/[productId].tsx
 * getRouteUrl('products/:productId', { productId: '123' });
 * // => "/products/123"
 *
 * getRouteUrl('/orders', undefined, { status: 'open' });
 * // => "/orders?status=open"
 * ```
 */
export function getRouteUrl(
  routePath: string,
  params: Record<string, string> = {},
  searchParams: Record<string, string> = {},
) {
  const normalizedPath = routePath.startsWith('/')
    ? routePath
    : `/${routePath}`;
  const pathname = generatePath(normalizedPath, params);
  const searchParamsString = new URLSearchParams(searchParams).toString();
  return `${pathname}${searchParamsString ? `?${searchParamsString}` : ''}`;
}

/**
 * Generates a URL for the login page
 *
 * @returns {string} The URL for the login page
 */
export function getLoginUrl() {
  return `/auth/login`;
}

/**
 * Logs out the user by removing the token from localStorage and reloading the page
 */
export function logOut() {
  localStorage.removeItem('token');
  window.location.href = '/auth/logout';
}
