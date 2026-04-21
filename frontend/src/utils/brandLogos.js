const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'
const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '')

export function resolveBrandLogoUrl(url) {
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url
  if (url.startsWith('/')) return `${API_ORIGIN}${url}`
  return `${API_ORIGIN}/${url}`
}

export function createBrandPlaceholderUrl(name) {
  const safeName = String(name || '?').trim()
  const label = safeName.slice(0, 1).toUpperCase() || '?'
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128" fill="none">
      <defs>
        <linearGradient id="bg" x1="64" y1="0" x2="64" y2="128" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="#67d4ff"/>
          <stop offset="1" stop-color="#2563eb"/>
        </linearGradient>
        <linearGradient id="ring" x1="64" y1="14" x2="64" y2="114" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="#eff6ff" stop-opacity="0.95"/>
          <stop offset="1" stop-color="#bfdbfe" stop-opacity="0.75"/>
        </linearGradient>
      </defs>
      <rect x="8" y="8" width="112" height="112" rx="28" fill="url(#bg)"/>
      <rect x="8" y="8" width="112" height="112" rx="28" stroke="#1d4ed8" stroke-opacity="0.28" stroke-width="2"/>
      <circle cx="64" cy="64" r="35" fill="url(#ring)"/>
      <circle cx="64" cy="64" r="21" fill="#f8fafc" fill-opacity="0.95"/>
      <path d="M64 20 69 31l12 2-8 8 2 12-11-6-11 6 2-12-8-8 12-2 5-11Zm0 55 5 11 12 2-8 8 2 12-11-6-11 6 2-12-8-8 12-2 5-11Zm-44-11 11-5 2-12 8 8 12-2-6 11 6 11-12-2-8 8-2-12-11-5Zm88 0 11-5 2-12 8 8 12-2-6 11 6 11-12-2-8 8-2-12-11-5Z" fill="#0f172a" fill-opacity="0.08"/>
      <text x="64" y="76" text-anchor="middle" font-family="Space Grotesk, Trebuchet MS, sans-serif" font-size="38" font-weight="800" fill="#0f172a">${label}</text>
    </svg>
  `.trim()

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

export function getBrandLogoOrPlaceholder(url, name) {
  return resolveBrandLogoUrl(url) || createBrandPlaceholderUrl(name)
}
