import { serializeTestResultRows } from './reviewTestResults'

export function parseReviewContent(content) {
  const normalizedContent = String(content || '').trim()
  if (!normalizedContent) {
    return { overview: '', images: [], secondImages: [], testResults: [], verdict: '' }
  }

  if (normalizedContent.startsWith('{')) {
    try {
      const parsed = JSON.parse(normalizedContent)
      return {
        overview: String(parsed.overview || ''),
        images: Array.isArray(parsed.images) ? parsed.images.filter(Boolean) : [],
        secondImages: Array.isArray(parsed.secondImages)
          ? parsed.secondImages.filter(Boolean)
          : Array.isArray(parsed.imagesAfterTests)
            ? parsed.imagesAfterTests.filter(Boolean)
            : [],
        testResults: Array.isArray(parsed.testResults)
          ? parsed.testResults
            .filter((item) => item && (item.key || item.value))
            .map((item) => ({ key: String(item.key || ''), value: String(item.value || '') }))
          : [],
        verdict: String(parsed.verdict || ''),
      }
    } catch {
      // Fall back to legacy section parsing.
    }
  }

  const lines = String(content || '').split(/\r?\n/)
  const overview = []
  const images = []
  const secondImages = []
  const testResults = []
  const verdict = []
  let section = null
  let hasExplicitSections = false

  for (const line of lines) {
    const trimmed = line.trim()
    const normalizedHeading = trimmed.toLowerCase().replace(/:$/, '')

    if (normalizedHeading === 'overview') { section = 'overview'; hasExplicitSections = true; continue }
    if (normalizedHeading === 'example photo gallery') { section = 'gallery'; hasExplicitSections = true; continue }
    if (normalizedHeading === 'test results') { section = 'results'; hasExplicitSections = true; continue }
    if (normalizedHeading === 'second photo gallery') { section = 'gallery2'; hasExplicitSections = true; continue }
    if (normalizedHeading === 'verdict') { section = 'verdict'; hasExplicitSections = true; continue }
    if (!trimmed) continue

    if (section === 'overview') overview.push(trimmed)
    else if (section === 'gallery') {
      const match = trimmed.match(/^\d+\.\s+((?:https?:\/\/|\/media\/).+)/)
      if (match) images.push(match[1].trim())
    } else if (section === 'gallery2') {
      const match = trimmed.match(/^\d+\.\s+((?:https?:\/\/|\/media\/).+)/)
      if (match) secondImages.push(match[1].trim())
    } else if (section === 'results') {
      const match = trimmed.match(/^-\s+(.+?):\s+(.+)/)
      if (match) testResults.push({ key: match[1].trim(), value: match[2].trim() })
    } else if (section === 'verdict') verdict.push(trimmed)
  }

  if (!hasExplicitSections) {
    return { overview: normalizedContent, images: [], secondImages: [], testResults: [], verdict: '' }
  }

  return { overview: overview.join(' '), images, secondImages, testResults, verdict: verdict.join(' ') }
}

export function getSafeOverviewValue(parsedOverview, fallbackSummary = '') {
  const candidate = String(parsedOverview || '').replace(/\s+/g, ' ').trim()
  if (!candidate) return String(fallbackSummary || '').trim()

  const looksLikeWholeArticle = /(example photo gallery|test results|second photo gallery|verdict|\/media\/)/i.test(candidate)
  if (looksLikeWholeArticle) {
    return String(fallbackSummary || '').trim()
  }

  return candidate
}

export function buildReviewContent({ overview, images, secondImages, testResults, verdict }) {
  const sections = []

  if (overview && overview.trim()) {
    sections.push('Overview')
    sections.push(overview.trim())
  }

  if (Array.isArray(images) && images.length > 0) {
    if (sections.length > 0) sections.push('')
    sections.push('Example photo gallery')
    images.forEach((image, index) => {
      if (image && String(image).trim()) {
        sections.push(`${index + 1}. ${String(image).trim()}`)
      }
    })
  }

  if (Array.isArray(testResults) && testResults.length > 0) {
    if (sections.length > 0) sections.push('')
    sections.push('Test results')
    testResults.forEach((result) => {
      const key = String(result?.key || '').trim()
      const value = String(result?.value || '').trim()
      if (key && value) {
        sections.push(`- ${key}: ${value}`)
      }
    })
  }

  if (Array.isArray(secondImages) && secondImages.length > 0) {
    if (sections.length > 0) sections.push('')
    sections.push('Second photo gallery')
    secondImages.forEach((image, index) => {
      if (image && String(image).trim()) {
        sections.push(`${index + 1}. ${String(image).trim()}`)
      }
    })
  }

  if (verdict && verdict.trim()) {
    if (sections.length > 0) sections.push('')
    sections.push('Verdict')
    sections.push(verdict.trim())
  }

  return sections.join('\n')
}

export function hasStructuredReviewContent(content) {
  const normalized = String(content || '').trim()
  if (!normalized) return false

  if (normalized.startsWith('{')) {
    try {
      const parsed = JSON.parse(normalized)
      return ['overview', 'images', 'secondImages', 'imagesAfterTests', 'testResults', 'verdict']
        .some((key) => Object.prototype.hasOwnProperty.call(parsed, key))
    } catch {
      // Continue to legacy marker detection.
    }
  }

  const markers = [
    'overview',
    'example photo gallery',
    'test results',
    'second photo gallery',
    'verdict',
  ]

  return normalized
    .split(/\r?\n/)
    .map((line) => String(line || '').trim().toLowerCase().replace(/:$/, ''))
    .some((line) => markers.includes(line))
}

export function assembleReviewContentForSave({
  content,
  verdict,
  summary,
  firstSliderImages = [],
  secondSliderImages = [],
  testResults = [],
  newFirstSliderUrls = [],
  newSecondSliderUrls = [],
  isStructuredContent = false,
}) {
  const serializedTestResults = serializeTestResultRows(testResults)
  const allFirst = [...firstSliderImages, ...newFirstSliderUrls].filter(Boolean)
  const allSecond = [...secondSliderImages, ...newSecondSliderUrls].filter(Boolean)
  const overview = String(content || '').trim()
  const verdictContent = String(verdict || '').trim()
  const summaryText = String(summary || '').trim()

  const shouldUseStructured = isStructuredContent
    || allFirst.length > 0
    || allSecond.length > 0
    || serializedTestResults.length > 0
    || verdictContent

  if (!shouldUseStructured) {
    return overview
  }

  return buildReviewContent({
    overview: overview || summaryText,
    images: allFirst,
    secondImages: allSecond,
    testResults: serializedTestResults,
    verdict: verdictContent,
  })
}
