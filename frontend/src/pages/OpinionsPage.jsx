import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from '../i18n'
import api from '../services/api'

export default function OpinionsPage() {
  const { t } = useTranslation()
  const [opinions, setOpinions] = useState([])
  const [loading, setLoading] = useState(true)
  const [ratingFilter, setRatingFilter] = useState('all')
  const [sortBy, setSortBy] = useState('newest')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    const fetchOpinions = async () => {
      try {
        setLoading(true)
        const response = await api.get('/opinions/?page_size=200&ordering=-created_at')
        setOpinions(response.data.results || response.data)
      } catch (error) {
        console.error('Error fetching opinions:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchOpinions()
  }, [])

  const filteredAndSortedOpinions = useMemo(() => {
    let filtered = opinions

    // Filter by rating
    if (ratingFilter !== 'all') {
      filtered = filtered.filter((op) => op.rating === Number(ratingFilter))
    }

    // Filter by search term
    if (searchTerm.trim()) {
      const normalizedSearch = searchTerm.toLowerCase()
      filtered = filtered.filter((op) => {
        const searchableText = `${op.title} ${op.content} ${op.car_name} ${op.author?.username || ''}`.toLowerCase()
        return searchableText.includes(normalizedSearch)
      })
    }

    // Sort
    const sorted = [...filtered]
    if (sortBy === 'newest') {
      sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    } else if (sortBy === 'oldest') {
      sorted.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    } else if (sortBy === 'highest-rated') {
      sorted.sort((a, b) => b.rating - a.rating)
    } else if (sortBy === 'most-helpful') {
      sorted.sort((a, b) => b.helpful_count - a.helpful_count)
    }

    return sorted
  }, [opinions, ratingFilter, sortBy, searchTerm])

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  }

  return (
    <div className="opinions-page-wrap">
      <h1 className="page-title">{t.nav.opinions}</h1>
      <p className="admin-subtitle">{t.pages.opinionsCatalogIntro}</p>

      {/* Filters */}
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
          <label className="form-label">{t.pages.averageRating}</label>
          <select
            className="form-input"
            value={ratingFilter}
            onChange={(e) => setRatingFilter(e.target.value)}
          >
            <option value="all">{t.pages.allLabel}</option>
            <option value="5">⭐ 5</option>
            <option value="4">⭐ 4</option>
            <option value="3">⭐ 3</option>
            <option value="2">⭐ 2</option>
            <option value="1">⭐ 1</option>
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
      ) : filteredAndSortedOpinions.length === 0 ? (
        <div className="page-card">{t.pages.noOpinionsInCatalog}</div>
      ) : (
        <div className="opinions-list-wrap">
          <p className="admin-subtitle">
            {filteredAndSortedOpinions.length} {filteredAndSortedOpinions.length === 1 ? t.pages.opinionSingle : t.pages.opinionPlural}
          </p>
          <div className="opinions-list">
            {filteredAndSortedOpinions.map((opinion) => (
              <article key={opinion.id} className="opinion-list-item">
                <div className="opinion-list-header">
                  <h3 className="opinion-title">{opinion.title}</h3>
                  <span className="opinion-rating">★ {opinion.rating}/5</span>
                </div>

                <div className="opinion-list-meta">
                  <span className="opinion-author">{opinion.author?.username || t.pages.unknownAuthor}</span>
                  <span className="opinion-date">{formatDate(opinion.created_at)}</span>
                  {opinion.car_name && (
                    <Link to={`/cars/${opinion.car_model}`} className="opinion-car-link">
                      {opinion.car_name} →
                    </Link>
                  )}
                </div>

                <p className="opinion-content">{opinion.content}</p>

                <div className="opinion-list-footer">
                  <span className="opinion-votes">
                    👍 {opinion.helpful_count} | 👎 {opinion.unhelpful_count}
                  </span>
                  {opinion.car_model && (
                    <Link to={`/cars/${opinion.car_model}`} className="opinion-view-car">
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
