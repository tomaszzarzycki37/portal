export const RATING_MIN = 1
export const RATING_MAX = 5

export const OPINION_RATING_SECTIONS = {
  technical: [
    'engine',
    'gearbox',
    'drivetrain',
    'suspension',
    'bodywork',
    'paint',
    'anti_corrosion',
  ],
  comfort: [
    'soundproofing',
    'hvac',
    'ergonomics',
    'multimedia',
    'materials',
    'passenger_space',
    'cargo_space',
  ],
  utility: [
    'visibility',
    'driving_position',
    'handling',
    'safety_systems',
    'exterior_lighting',
    'performance',
    'functionality',
  ],
  economy: [
    'value_for_money',
    'reliability',
    'trouble_free',
    'service_conditions',
    'maintenance_ease',
  ],
}

export function buildEmptyDetailedRatings(defaultValue = RATING_MAX) {
  return Object.fromEntries(
    Object.entries(OPINION_RATING_SECTIONS).map(([section, keys]) => [
      section,
      Object.fromEntries(keys.map((key) => [key, defaultValue])),
    ]),
  )
}

export function normalizeDetailedRatings(raw) {
  const empty = buildEmptyDetailedRatings()
  if (!raw || typeof raw !== 'object') return empty

  const normalized = buildEmptyDetailedRatings()
  Object.entries(OPINION_RATING_SECTIONS).forEach(([section, keys]) => {
    const sectionData = raw[section] || {}
    keys.forEach((key) => {
      const value = Number(sectionData[key])
      normalized[section][key] = Number.isFinite(value)
        ? Math.min(RATING_MAX, Math.max(RATING_MIN, Math.round(value)))
        : empty[section][key]
    })
  })
  return normalized
}

export function buildOpinionDraftFromApi(opinion) {
  return {
    title: opinion?.title || '',
    content: opinion?.content || '',
    car_model: opinion?.car_id ? String(opinion.car_id) : '',
    detailed_ratings: normalizeDetailedRatings(opinion?.detailed_ratings),
    fuel_consumption_min: opinion?.fuel_consumption_min ?? '',
    fuel_consumption_max: opinion?.fuel_consumption_max ?? '',
  }
}

export function computeFuelAverage(minValue, maxValue) {
  const min = Number(minValue)
  const max = Number(maxValue)
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null
  return Math.round(((min + max) / 2) * 100) / 100
}

export function buildOpinionPayload(draft) {
  const fuelMinRaw = String(draft.fuel_consumption_min ?? '').trim()
  const fuelMaxRaw = String(draft.fuel_consumption_max ?? '').trim()

  return {
    car_model: draft.car_model ? Number.parseInt(draft.car_model, 10) : undefined,
    title: String(draft.title || '').trim(),
    content: String(draft.content || '').trim(),
    detailed_ratings: normalizeDetailedRatings(draft.detailed_ratings),
    fuel_consumption_min: fuelMinRaw === '' ? null : Number(fuelMinRaw),
    fuel_consumption_max: fuelMaxRaw === '' ? null : Number(fuelMaxRaw),
  }
}

export function validateOpinionDraft(draft, { requireCarModel = false } = {}) {
  const title = String(draft?.title || '').trim()
  const content = String(draft?.content || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  if (!title || !content) return false
  if (requireCarModel && !draft?.car_model) return false

  const fuelMinRaw = String(draft.fuel_consumption_min ?? '').trim()
  const fuelMaxRaw = String(draft.fuel_consumption_max ?? '').trim()
  if (fuelMinRaw && fuelMaxRaw) {
    const min = Number(fuelMinRaw)
    const max = Number(fuelMaxRaw)
    if (Number.isFinite(min) && Number.isFinite(max) && min > max) return false
  }
  return true
}

export function formatStarDisplay(value, max = RATING_MAX) {
  const numeric = Number(value)
  const normalized = Number.isFinite(numeric) ? Math.min(max, Math.max(RATING_MIN, numeric)) : RATING_MAX
  const rounded = Math.round(normalized)
  return `${'★'.repeat(rounded)}${'☆'.repeat(max - rounded)} (${normalized})`
}
