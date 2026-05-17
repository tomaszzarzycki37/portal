const LOOPBACK_HOSTNAMES = new Set(['127.0.0.1', 'localhost', '0.0.0.0'])

export function normalizeMediaUrl(rawUrl) {
  if (!rawUrl) return ''

  // Keep non-browser contexts unchanged.
  if (typeof window === 'undefined' || !window.location?.origin) {
    return rawUrl
  }

  try {
    const parsed = new URL(rawUrl, window.location.origin)
    const currentHost = String(window.location.hostname || '').toLowerCase()
    const parsedHost = String(parsed.hostname || '').toLowerCase()
    const currentBaseHost = currentHost.replace(/^www\./, '')
    const parsedBaseHost = parsedHost.replace(/^www\./, '')

    if (LOOPBACK_HOSTNAMES.has(parsed.hostname)) {
      return `${window.location.origin}${parsed.pathname}${parsed.search}${parsed.hash}`
    }

    // Prevent mixed-content on production by upgrading same-site http media URLs.
    if (
      window.location.protocol === 'https:'
      && parsed.protocol === 'http:'
      && currentBaseHost
      && parsedBaseHost
      && currentBaseHost === parsedBaseHost
    ) {
      parsed.protocol = 'https:'
    }

    return parsed.toString()
  } catch {
    return rawUrl
  }
}
