import { useEffect, useMemo, useState } from 'react'
import DOMPurify from 'dompurify'
import { Link } from 'react-router-dom'
import { useTranslation } from '../i18n'
import api from '../services/api'

function sanitizeEditorialHtml(value) {
  return DOMPurify.sanitize(String(value || ''))
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function formatEditorialText(value) {
  let html = escapeHtml(value)

  html = html.replace(/\[size=(sm|md|lg)\]([\s\S]*?)\[\/size\]/g, (_, size, content) => {
    return `<span class="review-font-${size}">${content}</span>`
  })

  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/_([^_]+)_/g, '<em>$1</em>')
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
  html = html.replace(/^##\s+(.+)$/gm, '<h4>$1</h4>')
  html = html.replace(/^-\s+(.+)$/gm, '<li>$1</li>')
  html = html.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
  html = html.replace(/\n/g, '<br/>')

  return html
}

function parseReviewContent(content) {
  const lines = (content || '').split('\n')
  const overview = []
  const images = []
  const testResults = []
  const verdict = []
  let section = null

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed === 'Overview') { section = 'overview'; continue }
    if (trimmed === 'Example photo gallery') { section = 'gallery'; continue }
    if (trimmed === 'Test results') { section = 'results'; continue }
    if (trimmed === 'Verdict') { section = 'verdict'; continue }
    if (!trimmed) continue

    if (section === 'overview') overview.push(trimmed)
    else if (section === 'gallery') {
      const match = trimmed.match(/^\d+\.\s+(https?:\/\/.+)/)
      if (match) images.push(match[1].trim())
    } else if (section === 'results') {
      const match = trimmed.match(/^-\s+(.+?):\s+(.+)/)
      if (match) testResults.push({ key: match[1].trim(), value: match[2].trim() })
    } else if (section === 'verdict') verdict.push(trimmed)
  }

  return { overview: overview.join(' '), images, testResults, verdict: verdict.join(' ') }
}

export default function ReviewsPage() {
  const { t, lang } = useTranslation()
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState('newest')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedBrand, setSelectedBrand] = useState('all')
  const [selectedModel, setSelectedModel] = useState('all')

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const reviewsResponse = await api.get('/reviews/?page_size=200&ordering=-published_at')

        const reviewsList = reviewsResponse.data.results || reviewsResponse.data || []

        setReviews(reviewsList)
      } catch (error) {
        console.error('Error fetching reviews:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const normalizedReviews = useMemo(
    () => reviews.map((review) => ({ ...review, _brandName: String(review.car_brand_name || '').trim() })),
    [reviews],
  )

  const availableBrands = useMemo(() => {
    const values = new Set(normalizedReviews.map((review) => String(review._brandName || '').trim()).filter(Boolean))
    return Array.from(values).sort((a, b) => a.localeCompare(b))
  }, [normalizedReviews])

  const models = useMemo(() => {
    const byModelId = new Map()
    normalizedReviews.forEach((review) => {
      if (selectedBrand !== 'all' && review._brandName !== selectedBrand) return
      if (!review.car_id || !review.car_name) return
      byModelId.set(review.car_id, review.car_name)
    })

    return Array.from(byModelId.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [normalizedReviews, selectedBrand])

  useEffect(() => {
    if (selectedModel === 'all') return
    const stillAvailable = models.some((model) => String(model.id) === String(selectedModel))
    if (!stillAvailable) setSelectedModel('all')
  }, [models, selectedModel])

  const filteredAndSortedReviews = useMemo(() => {
    let filtered = normalizedReviews

    if (selectedBrand !== 'all') filtered = filtered.filter((review) => review._brandName === selectedBrand)
    if (selectedModel !== 'all') filtered = filtered.filter((review) => String(review.car_id) === String(selectedModel))
    if (searchTerm.trim()) {
      const normalizedSearch = searchTerm.toLowerCase()
      filtered = filtered.filter((review) => {
        const searchableText = `${review.title || ''} ${review.content || ''} ${review.car_name || ''} ${review._brandName || ''} ${review.author?.username || ''}`.toLowerCase()
        return searchableText.includes(normalizedSearch)
      })
    }

    const sorted = [...filtered]
    if (sortBy === 'newest') sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    if (sortBy === 'oldest') sorted.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    if (sortBy === 'highest-rated') sorted.sort((a, b) => new Date(b.published_at) - new Date(a.published_at))
    if (sortBy === 'most-helpful') sorted.sort((a, b) => new Date(b.published_at) - new Date(a.published_at))
    return sorted
  }, [normalizedReviews, selectedBrand, selectedModel, sortBy, searchTerm])

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString(lang === 'pl' ? 'pl-PL' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <div className="opinions-page-wrap">
      <h1 className="page-title">{t.nav.reviews}</h1>
      <p className="admin-subtitle">{t.pages.reviewsCatalogIntro}</p>

      <div className="opinions-filters">
        <div className="filter-group">
          <label className="form-label">{t.pages.searchModels}</label>
          <input
            type="text"
            className="form-input"
            placeholder={t.pages.searchModelsPlaceholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <label className="form-label">{t.pages.brandLabel}</label>
          <select
            className="form-input"
            value={selectedBrand}
            onChange={(e) => {
              setSelectedBrand(e.target.value)
              setSelectedModel('all')
            }}
          >
            <option value="all">{t.pages.allLabel}</option>
            {availableBrands.map((brand) => (
              <option key={brand} value={brand}>{brand}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label className="form-label">{t.pages.modelFilterLabel}</label>
          <select className="form-input" value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)}>
            <option value="all">{t.pages.allLabel}</option>
            {models.map((model) => (
              <option key={model.id} value={model.id}>{model.name}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label className="form-label">{t.pages.sortBy}</label>
          <select className="form-input" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="newest">{t.pages.sortNewest}</option>
            <option value="oldest">{t.pages.sortOldest}</option>
            <option value="highest-rated">{t.pages.sortHighestRated}</option>
            <option value="most-helpful">{t.pages.sortMostHelpful}</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="page-loading">{t.pages.loading}</div>
      ) : filteredAndSortedReviews.length === 0 ? (
        <div className="page-card">{t.pages.noReviewsInCatalog}</div>
      ) : (
        <div className="opinions-list-wrap">
          <p className="admin-subtitle">
            {filteredAndSortedReviews.length} {filteredAndSortedReviews.length === 1 ? t.pages.reviewSingle : t.pages.reviewPlural}
          </p>

          <div className="opinions-list">
            {filteredAndSortedReviews.map((review) => {
              const content = String(review.content || '')
              const isHtmlContent = /<\/?[a-z][\s\S]*>/i.test(content)
              const parsed = isHtmlContent ? null : parseReviewContent(content)
              return (
                <article key={review.id} className="review-card-rich">
                  {/* Header */}
                  <div className="review-card-header">
                    <div className="review-card-meta-top">
                      <span className="review-publication">{review.publication_name}</span>
                      {review.author_name && <span className="review-author-name"> · {review.author_name}</span>}
                      <span className="review-date-tag"> · {formatDate(review.published_at)}</span>
                      {review.reading_time_minutes ? <span className="review-date-tag"> · {review.reading_time_minutes} min read</span> : null}
                    </div>
                    <h3 className="review-card-title">{review.title}</h3>
                    {review.summary && <p className="review-card-summary">{review.summary}</p>}
                    {review.category && <p className="admin-meta">{String(review.category).toUpperCase()}</p>}
                    {review.tags && <p className="admin-meta">{review.tags}</p>}
                    {(review.car_brand_name || review.car_name) && (
                      <div className="review-car-tag">
                        {review.car_id ? (
                          <Link to={`/cars/${review.car_id}`}>{review.car_brand_name} {review.car_name}</Link>
                        ) : (
                          <span>{review.car_brand_name} {review.car_name}</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Image gallery (legacy content only) */}
                  {parsed && parsed.images.length > 0 && (
                    <div className="review-gallery">
                      <img
                        src={parsed.images[0]}
                        alt={review.title}
                        className="review-gallery-main"
                        loading="lazy"
                      />
                      {parsed.images.length > 1 && (
                        <div className="review-gallery-thumbs">
                          {parsed.images.slice(1).map((img, i) => (
                            <img
                              key={i}
                              src={img}
                              alt={`${review.title} ${i + 2}`}
                              className="review-gallery-thumb"
                              loading="lazy"
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Rich HTML content */}
                  {isHtmlContent && (
                    <div
                      className="review-html-content"
                      dangerouslySetInnerHTML={{ __html: sanitizeEditorialHtml(content) }}
                    />
                  )}

                  {/* Overview (legacy content only) */}
                  {parsed && parsed.overview && (
                    <p className="review-overview-text" dangerouslySetInnerHTML={{ __html: formatEditorialText(parsed.overview) }} />
                  )}

                  {/* Test results (legacy content only) */}
                  {parsed && parsed.testResults.length > 0 && (
                    <div className="review-results">
                      <h4 className="review-results-title">Test Results</h4>
                      <div className="review-results-grid">
                        {parsed.testResults.map((result, i) => (
                          <div key={i} className="review-result-item">
                            <span className="review-result-value">{result.value}</span>
                            <span className="review-result-key">{result.key}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Verdict (legacy content only) */}
                  {parsed && parsed.verdict && (
                    <div className="review-verdict">
                      <span className="review-verdict-label">Verdict</span>
                      <p className="review-verdict-text" dangerouslySetInnerHTML={{ __html: formatEditorialText(parsed.verdict) }} />
                    </div>
                  )}

                  {/* Footer links */}
                  <div className="review-card-footer">
                    {review.car_id && (
                      <Link to={`/cars/${review.car_id}`} className="btn btn-primary btn-sm">
                        {t.pages.viewCar}
                      </Link>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
