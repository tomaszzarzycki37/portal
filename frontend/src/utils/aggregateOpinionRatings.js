import {
  OPINION_RATING_SECTIONS,
  RATING_MAX,
  RATING_MIN,
  normalizeDetailedRatings,
} from '../constants/opinionRatings'

export function aggregateOpinionRatings(opinions) {
  const list = Array.isArray(opinions) ? opinions.filter(Boolean) : []
  if (list.length === 0) {
    return {
      count: 0,
      overall: null,
      sections: {},
    }
  }

  const sectionTotals = {}
  const sectionCounts = {}

  Object.entries(OPINION_RATING_SECTIONS).forEach(([section, keys]) => {
    sectionTotals[section] = Object.fromEntries(keys.map((key) => [key, 0]))
    sectionCounts[section] = Object.fromEntries(keys.map((key) => [key, 0]))
  })

  let overallSum = 0
  let overallCount = 0

  list.forEach((opinion) => {
    const rating = Number(opinion.rating)
    if (Number.isFinite(rating)) {
      overallSum += rating
      overallCount += 1
    }

    const detailed = normalizeDetailedRatings(opinion.detailed_ratings)
    Object.entries(OPINION_RATING_SECTIONS).forEach(([section, keys]) => {
      keys.forEach((key) => {
        const value = Number(detailed[section]?.[key])
        if (!Number.isFinite(value)) return
        sectionTotals[section][key] += value
        sectionCounts[section][key] += 1
      })
    })
  })

  const sections = {}
  Object.entries(OPINION_RATING_SECTIONS).forEach(([section, keys]) => {
    sections[section] = {}
    keys.forEach((key) => {
      const count = sectionCounts[section][key]
      sections[section][key] = count > 0
        ? Math.round((sectionTotals[section][key] / count) * 10) / 10
        : null
    })
  })

  return {
    count: list.length,
    overall: overallCount > 0 ? Math.round((overallSum / overallCount) * 10) / 10 : null,
    sections,
  }
}

export function clampRatingDisplay(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return null
  return Math.min(RATING_MAX, Math.max(RATING_MIN, numeric))
}
