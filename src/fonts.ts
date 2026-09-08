/**
 * Load Google Fonts from theme CSS variables (--font-sans, --font-serif, --font-mono).
 * Mirrors app-render Theme.tsx font loading so standalone app matches cloud behavior.
 */

const buildFontCssUrl = (
  family: string,
  weights: string[] = ['400'],
): string => {
  const encodedFamily = encodeURIComponent(family);
  const weightsParam = weights.join(';');
  return `https://fonts.googleapis.com/css2?family=${encodedFamily}:wght@${weightsParam}&display=swap`;
};

const loadGoogleFont = (
  family: string,
  weights: string[] = ['400', '700'],
): void => {
  if (typeof document === 'undefined') return;

  const href = buildFontCssUrl(family, weights);
  if (document.querySelector(`link[href="${href}"]`)) return;

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
};

const SYSTEM_FONTS = [
  'ui-sans-serif',
  'ui-serif',
  'ui-monospace',
  'system-ui',
  'sans-serif',
  'serif',
  'monospace',
  'cursive',
  'fantasy',
];

function extractFontFamily(fontFamilyValue: string): string | null {
  if (!fontFamilyValue) return null;
  const firstFont = fontFamilyValue.split(',')[0]?.trim();
  if (!firstFont) return null;
  const cleanFont = firstFont.replace(/['"]/g, '');
  if (SYSTEM_FONTS.includes(cleanFont.toLowerCase())) return null;
  return cleanFont;
}

const FONT_VARS = [
  '--font-sans',
  '--font-serif',
  '--font-mono',
  '--font-inter',
  '--font-inter-tight',
];

/**
 * Read font CSS variables from the document (after theme is injected)
 * and load any non-system Google Fonts via <link> tags.
 * Matches app-render Theme.tsx + Remix font-inter/inter-tight usage.
 */
export function loadFontsFromTheme(): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  const computed = getComputedStyle(root);
  const weights = ['400', '500', '600', '700'];
  const seen = new Set<string>();

  for (const varName of FONT_VARS) {
    const value = computed.getPropertyValue(varName).trim();
    const family = extractFontFamily(value);
    if (family && !seen.has(family)) {
      seen.add(family);
      try {
        loadGoogleFont(family, weights);
      } catch (e) {
        console.warn('Failed to load Google font:', family, e);
      }
    }
  }
}
