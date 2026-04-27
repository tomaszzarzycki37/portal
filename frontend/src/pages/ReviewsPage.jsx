import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from '../i18n'
import api from '../services/api'

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
            {filteredAndSortedReviews.map((review) => (
              <article key={review.id} className="opinion-list-item">
                <div className="opinion-list-header">
                  <h4 className="opinion-title">{review.title}</h4>
                  <span className="opinion-rating">★ {review.rating}/5</span>
                </div>

                <div className="opinion-list-meta">
                  <span className="opinion-author">{review.publication_name}{review.author_name ? ` - ${review.author_name}` : ''}</span>
                  <span className="opinion-date">{formatDate(review.published_at)}</span>
                </div>

                <p className="opinion-content">{review.content}</p>

                <div className="opinion-list-footer">
                  <span className="opinion-votes">{review.published_at}</span>
                  {review.publication_url && (
                    <a href={review.publication_url} target="_blank" rel="noreferrer" className="opinion-view-car">
                      {t.pages.openSourceArticle}
                    </a>
                  )}
                  {review.car_id && (
                    <Link to={`/cars/${review.car_id}`} className="opinion-view-car">
                      {t.pages.viewCar}
                    </Link>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
