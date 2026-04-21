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
                <div className="home-filter-row">
                  <label className="home-filter-checkbox">
                    <input type="checkbox" defaultChecked />
                    <span>Leasing</span>
                  </label>
                  <label className="home-filter-checkbox">
                    <input type="checkbox" defaultChecked />
                    <span>Wynajem</span>
                  </label>
                  <label className="home-filter-checkbox">
                    <input type="checkbox" defaultChecked />
                    <span>Kredyt</span>
                  </label>
                </div>
                <div className="home-filter-row">
                  <label className="home-filter-checkbox">
                    <input type="checkbox" defaultChecked />
                    <span>Nowe</span>
                  </label>
                  <label className="home-filter-checkbox">
                    <input type="checkbox" defaultChecked />
                    <span>Używane</span>
                  </label>
                  <label className="home-filter-checkbox">
                    <input type="checkbox" defaultChecked />
                    <span>Demo</span>
                  </label>
                </div>
              </div>

              <div className="home-filter-section">
                <button className="home-filter-expandable">
                  <span>Rocznik</span>
                  <span>Wybierz</span>
                </button>
              </div>

              <div className="home-filter-section">
                <button className="home-filter-expandable">
                  <span>Marka</span>
                  <span>Wybierz</span>
                </button>
              </div>

              <div className="home-filter-section">
                <button className="home-filter-expandable home-filter-disabled">
                  <span>Model</span>
                  <span>Wybierz markę</span>
                </button>
              </div>

              <button className="home-filter-cta">Sprawdź 11 937 aut od ręki →</button>
            </div>
          </div>

          <div className="home-hero-search-image">
            <img 
              src="https://images.unsplash.com/photo-1552820728-8ac41f1ce891?w=800&q=80" 
              alt="Car"
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
