const LOOPBACK_HOSTNAMES = new Set(['127.0.0.1', 'localhost', '0.0.0.0'])

export function normalizeMediaUrl(rawUrl) {
  if (!rawUrl) return ''

  // Keep non-browser contexts unchanged.
  if (typeof window === 'undefined' || !window.location?.origin) {
    return rawUrl
  }

  try {
    const parsed = new URL(rawUrl, window.location.origin)

    if (LOOPBACK_HOSTNAMES.has(parsed.hostname)) {
      return `${window.location.origin}${parsed.pathname}${parsed.search}${parsed.hash}`
    }

    return parsed.toString()
  } catch {
    return rawUrl
  }
}
