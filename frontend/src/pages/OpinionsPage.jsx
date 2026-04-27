import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from '../i18n'
import api from '../services/api'

export default function OpinionsPage() {
  const { t, lang } = useTranslation()
  const [opinions, setOpinions] = useState([])
  const [loading, setLoading] = useState(true)
  const [ratingFilter, setRatingFilter] = useState('all')
  const [sortBy, setSortBy] = useState('newest')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedBrand, setSelectedBrand] = useState('all')
  const [selectedModel, setSelectedModel] = useState('all')

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

  const brands = useMemo(() => {
    const values = new Set(opinions.map((opinion) => String(opinion.car_brand_name || '').trim()).filter(Boolean))
    return Array.from(values).sort((a, b) => a.localeCompare(b))
  }, [opinions])

  const models = useMemo(() => {
    const byModelId = new Map()

    opinions.forEach((opinion) => {
      if (selectedBrand !== 'all' && opinion.car_brand_name !== selectedBrand) return
      if (!opinion.car_id || !opinion.car_name) return
      byModelId.set(opinion.car_id, opinion.car_name)
    })

    return Array.from(byModelId.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [opinions, selectedBrand])

  useEffect(() => {
    if (selectedModel === 'all') return
    const stillAvailable = models.some((model) => String(model.id) === String(selectedModel))
    if (!stillAvailable) {
      setSelectedModel('all')
    }
  }, [models, selectedModel])

  const filteredAndSortedOpinions = useMemo(() => {
    let filtered = opinions

    if (selectedBrand !== 'all') {
      filtered = filtered.filter((op) => op.car_brand_name === selectedBrand)
    }

    if (selectedModel !== 'all') {
      filtered = filtered.filter((op) => String(op.car_id) === String(selectedModel))
    }

    if (ratingFilter !== 'all') {
      filtered = filtered.filter((op) => op.rating === Number(ratingFilter))
    }

    if (searchTerm.trim()) {
      const normalizedSearch = searchTerm.toLowerCase()
      filtered = filtered.filter((op) => {
        const searchableText = `${op.title || ''} ${op.content || ''} ${op.car_name || ''} ${op.car_brand_name || ''} ${op.author?.username || ''}`.toLowerCase()
        return searchableText.includes(normalizedSearch)
      })
    }

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
  }, [opinions, selectedBrand, selectedModel, ratingFilter, sortBy, searchTerm])

  const groupedByBrandAndModel = useMemo(() => {
    const brandMap = new Map()

    filteredAndSortedOpinions.forEach((opinion) => {
      const brandName = opinion.car_brand_name || t.pages.unknownBrand
      const modelName = opinion.car_name || '-'
      const modelId = opinion.car_id || `no-id-${modelName}`

      if (!brandMap.has(brandName)) {
        brandMap.set(brandName, new Map())
      }

      const modelMap = brandMap.get(brandName)
      if (!modelMap.has(modelId)) {
        modelMap.set(modelId, { modelName, modelId, opinions: [] })
      }

      modelMap.get(modelId).opinions.push(opinion)
    })

    return Array.from(brandMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([brandName, modelMap]) => ({
        brandName,
        models: Array.from(modelMap.values()).sort((a, b) => a.modelName.localeCompare(b.modelName)),
      }))
  }, [filteredAndSortedOpinions, t.pages.unknownBrand])

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
      <h1 className="page-title">{t.nav.opinions}</h1>
      <p className="admin-subtitle">{t.pages.opinionsCatalogIntro}</p>

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
          <select className="form-input" value={selectedBrand} onChange={(e) => setSelectedBrand(e.target.value)}>
            <option value="all">{t.pages.allLabel}</option>
            {brands.map((brand) => (
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
          <label className="form-label">{t.pages.averageRating}</label>
          <select className="form-input" value={ratingFilter} onChange={(e) => setRatingFilter(e.target.value)}>
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

          {groupedByBrandAndModel.map((brandGroup) => (
            <section key={brandGroup.brandName} style={{ marginBottom: '1.5rem' }}>
              <h2 className="detail-section-title">{brandGroup.brandName}</h2>

              {brandGroup.models.map((modelGroup) => (
                <div key={`${brandGroup.brandName}-${modelGroup.modelId}`} style={{ marginBottom: '1rem' }}>
                  <h3 className="opinion-title" style={{ marginBottom: '0.75rem' }}>{modelGroup.modelName}</h3>
                  <div className="opinions-list">
                    {modelGroup.opinions.map((opinion) => (
                      <article key={opinion.id} className="opinion-list-item">
                        <div className="opinion-list-header">
                          <h4 className="opinion-title">{opinion.title}</h4>
                          <span className="opinion-rating">★ {opinion.rating}/5</span>
                        </div>

                        <div className="opinion-list-meta">
                          <span className="opinion-author">{opinion.author?.username || t.pages.unknownAuthor}</span>
                          <span className="opinion-date">{formatDate(opinion.created_at)}</span>
                        </div>

                        <p className="opinion-content">{opinion.content}</p>

                        <div className="opinion-list-footer">
                          <span className="opinion-votes">👍 {opinion.helpful_count} | 👎 {opinion.unhelpful_count}</span>
                          {opinion.car_id && (
                            <Link to={`/cars/${opinion.car_id}`} className="opinion-view-car">
                              {t.pages.viewCar}
                            </Link>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
