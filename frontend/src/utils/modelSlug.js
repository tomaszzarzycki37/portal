export function slugifyModelName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function modelNameFromSlug(slug, candidates = []) {
  const normalized = String(slug || '').trim().toLowerCase()
  const exact = (candidates || []).find(
    (name) => slugifyModelName(name) === normalized,
  )
  if (exact) return exact

  const loose = (candidates || []).find(
    (name) => slugifyModelName(name).includes(normalized) || normalized.includes(slugifyModelName(name)),
  )
  return loose || ''
}

export function buildModelFamilyPath(brandSlug, modelName, query = '') {
  const modelSlug = slugifyModelName(modelName)
  if (!brandSlug || !modelSlug) return '/cars'
  const suffix = query ? (query.startsWith('?') ? query : `?${query}`) : ''
  return `/cars/brands/${brandSlug}/${modelSlug}${suffix}`
}
