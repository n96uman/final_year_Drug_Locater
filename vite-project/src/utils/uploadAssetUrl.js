const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api').trim().replace(/\/+$/, '')

/**
 * Licence/profile URLs from the API may point at the wrong host in dev (e.g. Vite port).
 * Normalise /uploads/... to the real backend origin when VITE_API_BASE_URL is absolute,
 * otherwise same-origin (Vite must proxy /uploads → backend).
 */
export function resolveUploadAssetUrl(url) {
  if (!url || typeof url !== 'string') return null
  let pathname = url
  let search = ''
  try {
    if (/^https?:\/\//i.test(url)) {
      const u = new URL(url)
      pathname = u.pathname
      search = u.search
    }
  } catch {
    return url
  }
  if (!pathname.startsWith('/uploads/')) return url
  if (API_BASE.startsWith('http')) {
    const origin = new URL(API_BASE).origin
    return `${origin}${pathname}${search}`
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${pathname}${search}`
  }
  return url
}
