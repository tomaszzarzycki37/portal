import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from '../i18n'
import api from '../services/api'
import { getCarImage } from '../utils/carImages'

const FALLBACK_HERO_IMAGE = 'https://images.unsplash.com/photo-1494905998402-395d579af36f?auto=format&fit=crop&w=1800&q=80'

export default function HomePage() {
  const { t } = useTranslation()
  const [cars, setCars] = useState([])
  const [featuredReviews, setFeaturedReviews] = useState([])
  const [featuredSlideIndex, setFeaturedSlideIndex] = useState(0)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedBrand, setSelectedBrand] = useState('all')
  const [engineSearch, setEngineSearch] = useState('')
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

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
    const normalizedSearch = String(searchTerm || '').trim().toLowerCase()
    const normalizedEngine = String(engineSearch || '').trim().toLowerCase()

    return cars.filter((car) => {
      const haystack = `${car.brand_name || ''} ${car.name || ''} ${car.description || ''} ${car.engine_type || ''}`.toLowerCase()
      if (normalizedSearch && !haystack.includes(normalizedSearch)) return false
      if (selectedBrand !== 'all' && String(car.brand_name || '') !== selectedBrand) return false
      if (normalizedEngine && !String(car.engine_type || '').toLowerCase().includes(normalizedEngine)) return false
      if (vehicleTypeFilter !== 'all' && String(car.vehicle_type || '') !== vehicleTypeFilter) return false
      if (statusFilter !== 'all' && String(car.production_status || '') !== statusFilter) return false
      return true
    })
  }, [cars, searchTerm, selectedBrand, engineSearch, vehicleTypeFilter, statusFilter])

  const carById = useMemo(() => {
    const byId = new Map()
    cars.forEach((car) => {
      if (car?.id != null) byId.set(car.id, car)
    })
    return byId
  }, [cars])

  const heroBackgroundImage = FALLBACK_HERO_IMAGE

  return (
    <div className="home-wrap">
      <section className="home-hero-search">
        <div
          className="home-hero-search-container"
          style={{
            backgroundImage: `linear-gradient(110deg, rgba(35, 54, 116, 0.78) 0%, rgba(73, 39, 132, 0.55) 45%, rgba(17, 24, 39, 0.35) 100%), url('${heroBackgroundImage}')`,
          }}
        >
          <div className="home-hero-search-filters">
            <div className="home-hero-search-card">
              <h2>{t.pages.modelSearchTitle}</h2>
              
              <div className="home-filter-group">
                <label className="home-filter-checkbox">
                  <input 
                    type="text" 
                    className="form-input"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder={t.pages.searchInputPlaceholder}
                    list="searchModels"
                  />
                  <datalist id="searchModels">
                    {brands.map((brand) => (
                      <option key={brand} value={brand} />
                    ))}
                  </datalist>
                </label>
              </div>

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

              <Link 
                to="/cars" 
                className="home-filter-cta"
                style={{ textDecoration: 'none', display: 'block', textAlign: 'center' }}
              >
                {t.pages.searchCta} {filteredCars.length} {t.pages.modelsAvailable} →
              </Link>
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
