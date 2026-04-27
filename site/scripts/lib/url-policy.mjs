export const SITE_ORIGIN = 'https://free-router.tonylee.im';
export const SITE_BASE_PATH = '/';

function ensureTrailingSlash(pathname) {
  const normalized = pathname.replace(/\/{2,}/g, '/');
  if (normalized === '/') {
    return '/';
  }

  return normalized.endsWith('/') ? normalized : `${normalized}/`;
}

export function normalizeBasePath(basePath) {
  if (!basePath || basePath === '/') {
    return '/';
  }

  const trimmed = basePath.replace(/\/{2,}/g, '/').replace(/^\/?|\/?$/g, '');
  return trimmed ? `/${trimmed}/` : '/';
}

export function canonicalPathSerializer(pathname, basePath = '/') {
  const isFilePath = /\.[a-z0-9]+$/i.test(pathname);
  const normalizedPathname =
    pathname === '/' ? '/' : isFilePath ? pathname.replace(/\/{2,}/g, '/') : ensureTrailingSlash(pathname);
  const safeBasePath = normalizeBasePath(basePath);
  if (normalizedPathname === '/') {
    return safeBasePath;
  }

  const prefixed = `${safeBasePath}${normalizedPathname.replace(/^\//, '')}`;
  return isFilePath ? prefixed.replace(/\/{2,}/g, '/') : ensureTrailingSlash(prefixed);
}

export function redirectMatcher(pathname, basePath = '/') {
  const canonicalPath = canonicalPathSerializer(pathname, basePath);
  return canonicalPath.replace(/\/$/, '');
}

export function normalizeSiteOrigin(value) {
  const candidate = typeof value === 'string' ? value.trim() : '';
  if (!candidate) {
    return null;
  }

  try {
    const url = new URL(candidate);
    url.pathname = '/';
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

export function resolveBuildContext() {
  return {
    mode: 'production',
    origin: SITE_ORIGIN,
    basePath: SITE_BASE_PATH,
    robotsContent: 'index, follow',
    requiresHttps: true,
  };
}

export function validateBuildContext(context) {
  const errors = [];

  if (!context.origin) {
    errors.push('Missing site origin for the selected build mode');
    return errors;
  }

  try {
    const origin = new URL(context.origin);
    if (context.requiresHttps && origin.protocol !== 'https:') {
      errors.push('Site origin must be HTTPS');
    }
  } catch {
    errors.push('Resolved site origin is invalid');
  }

  return errors;
}

export function sitemapUrlBuilder(pathname, context) {
  const canonicalPath = canonicalPathSerializer(pathname, context.basePath);
  return new URL(canonicalPath, `${context.origin}/`).toString();
}
