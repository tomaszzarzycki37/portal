import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from '../i18n'
import api from '../services/api'

export default function HomePage() {
  const { t } = useTranslation()
  const [cars, setCars] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
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

  const vehicleTypes = useMemo(() => {
    const values = new Set(cars.map((car) => String(car.vehicle_type || '').trim()).filter(Boolean))
    return Array.from(values).sort((a, b) => a.localeCompare(b))
  }, [cars])

  const filteredCars = useMemo(() => {
    const normalizedSearch = String(searchTerm || '').trim().toLowerCase()
    const normalizedEngine = String(engineSearch || '').trim().toLowerCase()

    return cars.filter((car) => {
      const haystack = `${car.brand_name || ''} ${car.name || ''} ${car.description || ''} ${car.engine_type || ''}`.toLowerCase()
      if (normalizedSearch && !haystack.includes(normalizedSearch)) return false
      if (normalizedEngine && !String(car.engine_type || '').toLowerCase().includes(normalizedEngine)) return false
      if (vehicleTypeFilter !== 'all' && String(car.vehicle_type || '') !== vehicleTypeFilter) return false
      if (statusFilter !== 'all' && String(car.production_status || '') !== statusFilter) return false
      return true
    })
  }, [cars, searchTerm, engineSearch, vehicleTypeFilter, statusFilter])

  return (
    <div className="home-wrap">
      <section className="home-hero-search">
        <div className="home-hero-search-container">
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
                    placeholder="Szukaj marki, modelu..."
                  />
                </label>
              </div>

              <div className="home-filter-section">
                <label className="home-filter-label">{t.pages.engineFilter}</label>
                <input 
                  type="text"
                  className="form-input"
                  value={engineSearch}
                  onChange={(e) => setEngineSearch(e.target.value)}
                  placeholder="np. 1.6L, 2.0T..."
                />
              </div>

              <div className="home-filter-section">
                <label className="home-filter-label">{t.pages.type}</label>
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
                Sprawdź {filteredCars.length} aut →
              </Link>
            </div>
          </div>

          <div className="home-hero-search-image">
            <img 
              src="https://images.unsplash.com/photo-1605559424843-9e4c3ca856d1?w=1000&q=80" 
              alt="Car"
              onError={(e) => e.target.style.display = 'none'}
            />
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
