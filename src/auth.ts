/**
 * Auth helpers for standalone local dev/preview (magic-link flow).
 * Uses VITE_BLOCKS_API_HOST as the Blocks/Remix base URL.
 */
function getBaseUrl(): string {
  const host =
    (import.meta as any).env?.VITE_BLOCKS_API_HOST ??
    (typeof window !== 'undefined' ? (window as any).__BLOCKS_API_HOST__ : '');
  if (!host) return '';
  return host.replace(/\/$/, '');
}

export function getAuthBaseUrl(path: string = ''): string {
  const base = getBaseUrl();
  if (!base) return '';
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

export function hasAuthBaseUrl(): boolean {
  return getBaseUrl().length > 0;
}

export async function login(
  email: string,
  appUrl: string,
  appId?: string,
): Promise<{ success?: boolean; redirectToSsoUrl?: string; errors?: unknown }> {
  const base = getBaseUrl();
  if (!base) {
    throw new Error(
      'VITE_BLOCKS_API_HOST is not set. Add it to .env.local (e.g. https://blocks.localhost).',
    );
  }

  const url = new URL('/auth/login', base);
  url.searchParams.set('_data', 'router/auth/login/login-route');

  const formData = new FormData();
  formData.append('email', email);
  formData.append('appUrl', appUrl);
  if (appId) formData.append('appId', appId);

  const response = await fetch(url.toString(), {
    method: 'POST',
    body: formData,
  });

  let data: { success?: boolean; redirectToSsoUrl?: string; errors?: unknown };
  try {
    const text = await response.text();
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(
      response.ok
        ? 'Invalid response from server'
        : `Login server returned ${response.status}. Check VITE_BLOCKS_API_HOST (e.g. https://blocks.localhost) and CORS.`,
    );
  }

  if (!response.ok) {
    const msg =
      (data && typeof data === 'object' && Array.isArray((data as any).errors)
        ? (data as any).errors[0]?.message
        : null) || `Request failed (${response.status})`;
    throw new Error(msg);
  }

  return data;
}
