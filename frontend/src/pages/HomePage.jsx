import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from '../i18n'
import api from '../services/api'
import { getCarImage, handleCarImageError } from '../utils/carImages'
import { isAdminUser } from '../utils/auth'
import { normalizeMediaUrl } from '../utils/mediaUrl'

const FALLBACK_HERO_IMAGE = 'https://images.unsplash.com/photo-1494905998402-395d579af36f?auto=format&fit=crop&w=1800&q=80'
const HERO_BACKGROUND_CONTENT_KEY = 'home.heroSearchBackgroundUrl'
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'
const API_ORIGIN = import.meta.env.VITE_API_URL
  ? API_BASE_URL.replace(/\/api\/?$/, '')
  : import.meta.env.DEV
    ? 'http://localhost:8000'
    : ''

function resolveMediaUrl(url) {
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return normalizeMediaUrl(url)
  if (url.startsWith('/')) return normalizeMediaUrl(`${API_ORIGIN}${url}`)
  return normalizeMediaUrl(`${API_ORIGIN}/${url}`)
}

const parsePriceRange = (car) => {
  const priceMin = Number.parseFloat(String(car.price_min || ''))
  const priceMax = Number.parseFloat(String(car.price_max || ''))
  
  const min = Number.isFinite(priceMin) ? priceMin : null
  const max = Number.isFinite(priceMax) ? priceMax : null
  
  return { min, max }
}

export default function HomePage() {
  const { t, lang } = useTranslation()
  const [cars, setCars] = useState([])
  const [featuredReviews, setFeaturedReviews] = useState([])
  const [featuredSlideIndex, setFeaturedSlideIndex] = useState(0)
  const [selectedBrand, setSelectedBrand] = useState('all')
  const [engineSearch, setEngineSearch] = useState('')
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [keywordSearch, setKeywordSearch] = useState('')
  const [yearFrom, setYearFrom] = useState('')
  const [yearTo, setYearTo] = useState('')
  const [horsepowerFrom, setHorsepowerFrom] = useState('')
  const [horsepowerTo, setHorsepowerTo] = useState('')
  const [topSpeedFrom, setTopSpeedFrom] = useState('')
  const [topSpeedTo, setTopSpeedTo] = useState('')
  const [fuelConsumptionSearch, setFuelConsumptionSearch] = useState('')
  const [priceFrom, setPriceFrom] = useState('')
  const [priceTo, setPriceTo] = useState('')
  const [isAdvancedSearchOpen, setIsAdvancedSearchOpen] = useState(false)
  const [heroBackgroundImage, setHeroBackgroundImage] = useState(FALLBACK_HERO_IMAGE)
  const [isHeroImageEditorOpen, setIsHeroImageEditorOpen] = useState(false)
  const [heroImageFile, setHeroImageFile] = useState(null)
  const [heroImageSaving, setHeroImageSaving] = useState(false)
  const [heroImageMessage, setHeroImageMessage] = useState('')
  const [heroImageError, setHeroImageError] = useState('')
  const isAdmin = isAdminUser()

  useEffect(() => {
    const loadCars = async () => {
      try {
        const response = await api.get('/cars/?page_size=200')
        setCars(response.data.results || response.data || [])
      } catch {
        setCars([])
      }
    }

    loadCars()
  }, [])

  useEffect(() => {
    const loadFeaturedReviews = async () => {
      try {
        const response = await api.get('/reviews/featured/?limit=8')
        setFeaturedReviews(response.data || [])
      } catch {
        setFeaturedReviews([])
      }
    }

    loadFeaturedReviews()
  }, [])

  useEffect(() => {
    if (featuredReviews.length <= 1) {
      setFeaturedSlideIndex(0)
      return
    }

    const timer = setInterval(() => {
      setFeaturedSlideIndex((prev) => (prev + 1) % featuredReviews.length)
    }, 5000)

    return () => clearInterval(timer)
  }, [featuredReviews])

  useEffect(() => {
    const loadHeroBackgroundImage = async () => {
      try {
        const response = await api.get(`/common/content/?key=${encodeURIComponent(HERO_BACKGROUND_CONTENT_KEY)}`)
        const records = response.data.results || response.data || []
        const preferredRecord =
          records.find((record) => record.lang === lang && String(record.value || '').trim())
          || records.find((record) => record.lang === 'en' && String(record.value || '').trim())
          || records.find((record) => String(record.value || '').trim())

        const backgroundUrl = preferredRecord ? resolveMediaUrl(String(preferredRecord.value || '').trim()) : ''
        setHeroBackgroundImage(backgroundUrl || FALLBACK_HERO_IMAGE)
      } catch {
        setHeroBackgroundImage(FALLBACK_HERO_IMAGE)
      }
    }

    loadHeroBackgroundImage()
  }, [lang])

  const vehicleTypes = useMemo(() => {
    const values = new Set(cars.map((car) => String(car.vehicle_type || '').trim()).filter(Boolean))
    return Array.from(values).sort((a, b) => a.localeCompare(b))
  }, [cars])

  const engineTypes = useMemo(() => {
    const values = new Set(cars.map((car) => String(car.engine_type || '').trim()).filter(Boolean))
    return Array.from(values).sort((a, b) => a.localeCompare(b))
  }, [cars])

  const brands = useMemo(() => {
    const values = new Set(cars.map((car) => String(car.brand_name || '').trim()).filter(Boolean))
    return Array.from(values).sort((a, b) => a.localeCompare(b))
  }, [cars])

  const filteredCars = useMemo(() => {
    const normalizedKeyword = String(keywordSearch || '').trim().toLowerCase()
    const normalizedEngine = String(engineSearch || '').trim().toLowerCase()
    const normalizedFuelConsumption = String(fuelConsumptionSearch || '').trim().toLowerCase()
    const parsedYearFrom = Number.parseInt(String(yearFrom || '').trim(), 10)
    const parsedYearTo = Number.parseInt(String(yearTo || '').trim(), 10)
    const parsedHorsepowerFrom = Number.parseInt(String(horsepowerFrom || '').trim(), 10)
    const parsedHorsepowerTo = Number.parseInt(String(horsepowerTo || '').trim(), 10)
    const parsedTopSpeedFrom = Number.parseInt(String(topSpeedFrom || '').trim(), 10)
    const parsedTopSpeedTo = Number.parseInt(String(topSpeedTo || '').trim(), 10)
    const parsedPriceFrom = Number.parseInt(String(priceFrom || '').trim(), 10)
    const parsedPriceTo = Number.parseInt(String(priceTo || '').trim(), 10)

    return cars.filter((car) => {
      const haystack = `${car.brand_name || ''} ${car.name || ''} ${car.description || ''} ${car.engine_type || ''} ${car.price_range_display || ''}`.toLowerCase()
      if (normalizedKeyword && !haystack.includes(normalizedKeyword)) return false
      if (selectedBrand !== 'all' && String(car.brand_name || '') !== selectedBrand) return false
      if (normalizedEngine && !String(car.engine_type || '').toLowerCase().includes(normalizedEngine)) return false
      if (vehicleTypeFilter !== 'all' && String(car.vehicle_type || '') !== vehicleTypeFilter) return false
      if (statusFilter !== 'all' && String(car.production_status || '') !== statusFilter) return false
      if (normalizedFuelConsumption && !String(car.fuel_consumption || '').toLowerCase().includes(normalizedFuelConsumption)) return false

      const yearIntroduced = Number.parseInt(String(car.year_introduced || '').trim(), 10)
      if (Number.isFinite(parsedYearFrom) && Number.isFinite(yearIntroduced) && yearIntroduced < parsedYearFrom) return false
      if (Number.isFinite(parsedYearTo) && Number.isFinite(yearIntroduced) && yearIntroduced > parsedYearTo) return false

      const horsepower = Number.parseInt(String(car.horsepower || '').trim(), 10)
      if (Number.isFinite(parsedHorsepowerFrom) && Number.isFinite(horsepower) && horsepower < parsedHorsepowerFrom) return false
      if (Number.isFinite(parsedHorsepowerTo) && Number.isFinite(horsepower) && horsepower > parsedHorsepowerTo) return false

      const topSpeed = Number.parseInt(String(car.top_speed || '').trim(), 10)
      if (Number.isFinite(parsedTopSpeedFrom) && Number.isFinite(topSpeed) && topSpeed < parsedTopSpeedFrom) return false
      if (Number.isFinite(parsedTopSpeedTo) && Number.isFinite(topSpeed) && topSpeed > parsedTopSpeedTo) return false

      const { min: carPriceMin, max: carPriceMax } = parsePriceRange(car)
      if (Number.isFinite(parsedPriceFrom) && Number.isFinite(carPriceMax) && carPriceMax < parsedPriceFrom) return false
      if (Number.isFinite(parsedPriceTo) && Number.isFinite(carPriceMin) && carPriceMin > parsedPriceTo) return false
      return true
    })
  }, [
    cars,
    keywordSearch,
    selectedBrand,
    engineSearch,
    vehicleTypeFilter,
    statusFilter,
    fuelConsumptionSearch,
    yearFrom,
    yearTo,
    horsepowerFrom,
    horsepowerTo,
    topSpeedFrom,
    topSpeedTo,
    priceFrom,
    priceTo,
  ])

  const carById = useMemo(() => {
    const byId = new Map()
    cars.forEach((car) => {
      if (car?.id != null) byId.set(car.id, car)
    })
    return byId
  }, [cars])

  const handleSaveHeroBackgroundImage = async () => {
    if (!isAdmin || !heroImageFile) return

    try {
      setHeroImageSaving(true)
      setHeroImageMessage('')
      setHeroImageError('')

      const uploadFormData = new FormData()
      uploadFormData.append('file', heroImageFile)
      const uploadResponse = await api.post('/common/content/upload/', uploadFormData)
      const uploadedUrl = String(uploadResponse.data?.url || '').trim()

      if (!uploadedUrl) {
        throw new Error('missing_upload_url')
      }

      const existingResponse = await api.get(`/common/content/?key=${encodeURIComponent(HERO_BACKGROUND_CONTENT_KEY)}`)
      const existingRecords = existingResponse.data.results || existingResponse.data || []

      await Promise.all(['en', 'pl'].map(async (languageCode) => {
        const existingRecord = existingRecords.find((record) => record.lang === languageCode)
        const payload = {
          key: HERO_BACKGROUND_CONTENT_KEY,
          lang: languageCode,
          value: uploadedUrl,
        }

        if (existingRecord?.id) {
          await api.patch(`/common/content/${existingRecord.id}/`, payload)
          return
        }

        await api.post('/common/content/', payload)
      }))

      setHeroBackgroundImage(resolveMediaUrl(uploadedUrl))
      setHeroImageFile(null)
      setHeroImageMessage(t.adminInline.saved)
      setIsHeroImageEditorOpen(false)
    } catch {
      setHeroImageError(t.adminInline.saveError)
    } finally {
      setHeroImageSaving(false)
    }
  }

  return (
    <div className="home-wrap">
      <section className="home-hero-search">
        <div
          className="home-hero-search-container"
          style={{
            backgroundImage: `linear-gradient(110deg, rgba(35, 54, 116, 0.78) 0%, rgba(73, 39, 132, 0.55) 45%, rgba(17, 24, 39, 0.35) 100%), url('${heroBackgroundImage}')`,
          }}
        >
          {isAdmin && (
            <div className={`home-hero-admin-tools ${isHeroImageEditorOpen ? 'is-open' : ''}`}>
              <button
                type="button"
                className={`admin-inline-toggle admin-inline-gear home-hero-admin-gear ${isHeroImageEditorOpen ? 'is-open' : ''}`}
                onClick={() => {
                  setIsHeroImageEditorOpen((prev) => !prev)
                  setHeroImageMessage('')
                  setHeroImageError('')
                }}
                aria-expanded={isHeroImageEditorOpen}
                aria-label={isHeroImageEditorOpen ? t.adminPanel.hideImageEditor : t.adminPanel.editImage}
                title={isHeroImageEditorOpen ? t.adminPanel.hideImageEditor : t.adminPanel.editImage}
              >
                <svg className="admin-inline-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.3 7.3 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.49-.42h-3.84a.5.5 0 0 0-.49.42l-.36 2.54c-.58.22-1.12.53-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.7 8.84a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.82 14.52a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96c.5.4 1.05.72 1.63.94l.36 2.54a.5.5 0 0 0 .49.42h3.84a.5.5 0 0 0 .49-.42l.36-2.54c.58-.22 1.12-.53 1.63-.94l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z" />
                </svg>
              </button>

              {isHeroImageEditorOpen && (
                <div className="home-hero-admin-panel">
                  <input
                    id="home-hero-image-upload"
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      setHeroImageFile(e.target.files?.[0] || null)
                      setHeroImageMessage('')
                      setHeroImageError('')
                    }}
                  />
                  <div className="admin-file-picker-row">
                    <label htmlFor="home-hero-image-upload" className="btn btn-secondary btn-sm">{t.adminInline.chooseFile}</label>
                    <span className="admin-file-picker-name">{heroImageFile ? heroImageFile.name : t.adminInline.noFileSelected}</span>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={!heroImageFile || heroImageSaving}
                      onClick={handleSaveHeroBackgroundImage}
                    >
                      {heroImageSaving ? t.pages.loading : t.adminInline.save}
                    </button>
                  </div>
                  {heroImageMessage && <p className="form-success">{heroImageMessage}</p>}
                  {heroImageError && <p className="form-error">{heroImageError}</p>}
                </div>
              )}
            </div>
          )}

          <div className="home-hero-search-filters">
            <div className="home-search-layout">
              <div className="home-hero-search-card">
                <div className="home-search-card-head">
                  <h2>{t.pages.modelSearchTitle}</h2>
                </div>

                <div className="home-search-basic-grid">
                  <div className="home-filter-section">
                    <label className="home-filter-label">{t.pages.brandLabel}</label>
                    <select
                      className="form-input"
                      value={selectedBrand}
                      onChange={(e) => setSelectedBrand(e.target.value)}
                    >
                      <option value="all">{t.pages.allLabel}</option>
                      {brands.map((brand) => (
                        <option key={brand} value={brand}>{brand}</option>
                      ))}
                    </select>
                  </div>

                  <div className="home-filter-section">
                    <label className="home-filter-label">{t.pages.engineFilter}</label>
                    <input
                      type="text"
                      className="form-input"
                      value={engineSearch}
                      onChange={(e) => setEngineSearch(e.target.value)}
                      placeholder={t.pages.engineFilterPlaceholder}
                      list="engineTypes"
                    />
                    <datalist id="engineTypes">
                      {engineTypes.map((type) => (
                        <option key={type} value={type} />
                      ))}
                    </datalist>
                  </div>

                  <div className="home-filter-section">
                    <label className="home-filter-label">{t.pages.typeFilter}</label>
                    <select
                      className="form-input"
                      value={vehicleTypeFilter}
                      onChange={(e) => setVehicleTypeFilter(e.target.value)}
                    >
                      <option value="all">{t.pages.allLabel}</option>
                      {vehicleTypes.map((type) => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>

                  <div className="home-filter-section">
                    <label className="home-filter-label">{t.pages.productionStatus}</label>
                    <select
                      className="form-input"
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                    >
                      <option value="all">{t.pages.allLabel}</option>
                      <option value="active">{t.pages.statusActive}</option>
                      <option value="discontinued">{t.pages.statusDiscontinued}</option>
                      <option value="upcoming">{t.pages.statusUpcoming}</option>
                    </select>
                  </div>
                </div>

                <Link
                  to="/cars"
                  className="home-filter-cta"
                  style={{ textDecoration: 'none', display: 'block', textAlign: 'center' }}
                >
                  {t.pages.searchCta} {filteredCars.length} {t.pages.modelsAvailable} →
                </Link>
              </div>

              <button
                type="button"
                className={`home-search-advanced-tab ${isAdvancedSearchOpen ? 'is-open' : ''}`}
                onClick={() => setIsAdvancedSearchOpen((prev) => !prev)}
                aria-expanded={isAdvancedSearchOpen}
                aria-controls="home-advanced-search-panel"
                aria-label={isAdvancedSearchOpen ? t.pages.closeAdvancedSearch : t.pages.advancedSearch}
                title={isAdvancedSearchOpen ? t.pages.closeAdvancedSearch : t.pages.advancedSearch}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M10 6l6 6-6 6" />
                </svg>
              </button>

              <aside
                id="home-advanced-search-panel"
                className={`home-search-advanced-panel ${isAdvancedSearchOpen ? 'is-open' : ''}`}
                aria-hidden={!isAdvancedSearchOpen}
              >
                <div className="home-search-advanced-panel-head">
                  <div>
                    <p className="home-search-advanced-kicker">{t.pages.advancedSearchTitle}</p>
                    <h3>{t.pages.advancedSearch}</h3>
                  </div>
                  <button
                    type="button"
                    className="home-search-advanced-close"
                    onClick={() => setIsAdvancedSearchOpen(false)}
                    aria-label={t.pages.closeAdvancedSearch}
                    title={t.pages.closeAdvancedSearch}
                  >
                    ×
                  </button>
                </div>

                <div className="home-filter-section">
                  <label className="home-filter-label">{t.pages.searchModels}</label>
                  <input
                    type="text"
                    className="form-input"
                    value={keywordSearch}
                    onChange={(e) => setKeywordSearch(e.target.value)}
                    placeholder={t.pages.searchModelsPlaceholder}
                  />
                </div>

                <div className="home-search-advanced-grid">
                  <div className="home-filter-section">
                    <label className="home-filter-label">Rok od</label>
                    <input
                      type="number"
                      className="form-input"
                      value={yearFrom}
                      onChange={(e) => setYearFrom(e.target.value)}
                      placeholder="2018"
                      min="1900"
                      max="2100"
                    />
                  </div>

                  <div className="home-filter-section">
                    <label className="home-filter-label">Rok do</label>
                    <input
                      type="number"
                      className="form-input"
                      value={yearTo}
                      onChange={(e) => setYearTo(e.target.value)}
                      placeholder="2026"
                      min="1900"
                      max="2100"
                    />
                  </div>

                  <div className="home-filter-section">
                    <label className="home-filter-label">Moc od</label>
                    <input
                      type="number"
                      className="form-input"
                      value={horsepowerFrom}
                      onChange={(e) => setHorsepowerFrom(e.target.value)}
                      placeholder="150"
                      min="0"
                    />
                  </div>

                  <div className="home-filter-section">
                    <label className="home-filter-label">Moc do</label>
                    <input
                      type="number"
                      className="form-input"
                      value={horsepowerTo}
                      onChange={(e) => setHorsepowerTo(e.target.value)}
                      placeholder="500"
                      min="0"
                    />
                  </div>

                  <div className="home-filter-section">
                    <label className="home-filter-label">Prędkość od</label>
                    <input
                      type="number"
                      className="form-input"
                      value={topSpeedFrom}
                      onChange={(e) => setTopSpeedFrom(e.target.value)}
                      placeholder="160"
                      min="0"
                    />
                  </div>

                  <div className="home-filter-section">
                    <label className="home-filter-label">Prędkość do</label>
                    <input
                      type="number"
                      className="form-input"
                      value={topSpeedTo}
                      onChange={(e) => setTopSpeedTo(e.target.value)}
                      placeholder="250"
                      min="0"
                    />
                  </div>
                </div>

                <div className="home-search-advanced-grid home-search-advanced-grid-secondary">
                  <div className="home-filter-section">
                    <label className="home-filter-label">Zużycie paliwa</label>
                    <input
                      type="text"
                      className="form-input"
                      value={fuelConsumptionSearch}
                      onChange={(e) => setFuelConsumptionSearch(e.target.value)}
                      placeholder="5.5, EV, hybrid..."
                    />
                  </div>

                  <div className="home-filter-section">
                    <label className="home-filter-label">Zakres cenowy od</label>
                    <input
                      type="number"
                      className="form-input"
                      value={priceFrom}
                      onChange={(e) => setPriceFrom(e.target.value)}
                      placeholder="90000"
                      min="0"
                    />
                  </div>

                  <div className="home-filter-section home-filter-section-last">
                    <label className="home-filter-label">Zakres cenowy do</label>
                    <input
                      type="number"
                      className="form-input"
                      value={priceTo}
                      onChange={(e) => setPriceTo(e.target.value)}
                      placeholder="250000"
                      min="0"
                    />
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </div>
      </section>

      <section className="features-grid">
        <article className="feature-tile feature-tile-red">
          <h3>{t.home.feature1Title}</h3>
          <p>{t.home.feature1Text}</p>
        </article>
        <article className="feature-tile feature-tile-amber">
          <h3>{t.home.feature2Title}</h3>
          <p>{t.home.feature2Text}</p>
        </article>
        <article className="feature-tile feature-tile-slate">
          <h3>{t.home.feature3Title}</h3>
          <p>{t.home.feature3Text}</p>
        </article>
      </section>

      <section className="home-featured-reviews">
        <div className="home-featured-reviews-head">
          <div>
            <h2>{t.home.featuredReviewsTitle}</h2>
            <p>{t.home.featuredReviewsIntro}</p>
          </div>
          <Link to="/reviews" className="home-featured-reviews-link">{t.home.readAllReviews}</Link>
        </div>

        {featuredReviews.length > 0 ? (
          <div className="home-featured-reviews-slider" aria-live="polite">
            <div
              className="home-featured-reviews-track"
              style={{ transform: `translateX(-${featuredSlideIndex * 100}%)` }}
            >
              {featuredReviews.map((review) => (
                <article key={review.id} className="home-featured-review-card">
                  <div className="home-featured-review-main">
                    <div className="home-featured-review-content">
                      <div className="home-featured-review-heading">
                        <p className="home-featured-review-meta">{review.car_brand_name} {review.car_name}</p>
                        <h3>{review.title}</h3>
                      </div>
                      <p className="home-featured-review-description-label">{t.pages.description}</p>
                      <p className="home-featured-review-summary">{review.summary || String(review.content || '').slice(0, 160)}</p>
                      <span className="home-featured-review-source">{review.publication_name}</span>
                    </div>
                    <div className="home-featured-review-rail">
                      <img
                        className="home-featured-review-thumb"
                        src={getCarImage(carById.get(review.car_id))}
                        alt={`${review.car_brand_name} ${review.car_name}`.trim()}
                        loading="lazy"
                        onError={handleCarImageError}
                      />
                      <Link to={`/cars/${review.car_id}/reviews`} className="home-featured-review-open-link">{t.home.openFeaturedReview}</Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            {featuredReviews.length > 1 && (
              <div className="home-featured-reviews-dots" role="tablist" aria-label="Featured reviews slider">
                {featuredReviews.map((review, index) => (
                  <button
                    key={review.id}
                    type="button"
                    className={`home-featured-reviews-dot${index === featuredSlideIndex ? ' active' : ''}`}
                    aria-label={`Go to slide ${index + 1}`}
                    aria-selected={index === featuredSlideIndex}
                    onClick={() => setFeaturedSlideIndex(index)}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="home-featured-reviews-empty">{t.home.noFeaturedReviews}</p>
        )}
      </section>

      <section className="home-cta">
        <h2>
          {t.home.ctaTitle}
        </h2>
        <p>
          {t.home.ctaText}
        </p>
      </section>
    </div>
  )
}
