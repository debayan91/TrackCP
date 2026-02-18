
// Logger
const IS_DEV = import.meta.env.DEV;

export const Logger = {
  log: (...args: any[]) => {
    if (IS_DEV) console.log('[TrackCP]', ...args);
  },
  warn: (...args: any[]) => {
    if (IS_DEV) console.warn('[TrackCP]', ...args);
  },
  error: (...args: any[]) => {
    console.error('[TrackCP]', ...args);
  }
};

// Sanitizer
export const sanitizeProblemName = (name: string): string => {
  if (!name) return 'Unknown_Problem';
  // Replace invalid chars with underscore
  // Keep alphanumeric, spaces, hyphens, underscores
  let safe = name.replace(/[^\w\s-]/g, '').trim();
  // Replace spaces with underscore
  safe = safe.replace(/\s+/g, '_');
  // Limit length
  if (safe.length > 50) safe = safe.substring(0, 50);
  return safe || 'Unknown_Problem';
};

export const sanitizePath = (path: string): string => {
  return path.replace(/\/{2,}/g, '/').replace(/^\/+|\/+$/g, '');
};

// GitHub Unicode Safe Encoding
export const safeBase64 = (str: string): string => {
  return btoa(unescape(encodeURIComponent(str)));
};

export const safeDecodeBase64 = (str: string): string => {
  return decodeURIComponent(escape(atob(str)));
};
