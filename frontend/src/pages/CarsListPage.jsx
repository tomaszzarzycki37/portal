import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import { useTranslation } from '../i18n'
import { getBrandLogoOrPlaceholder } from '../utils/brandLogos'
import { getCarImage } from '../utils/carImages'

function detectDriveType(engineType) {
  const text = String(engineType || '').toLowerCase()
  if (text.includes('awd') || text.includes('4x4') || text.includes('4wd')) return 'awd'
  if (text.includes('fwd')) return 'fwd'
  if (text.includes('rwd')) return 'rwd'
  return 'other'
}

function formatModelLabel(count, lang) {
  const value = Number(count) || 0
  if (lang === 'pl') {
    const mod10 = value % 10
    const mod100 = value % 100
    if (value === 1) return 'model'
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'modele'
    return 'modeli'
  }
  return value === 1 ? 'model' : 'models'
}

export default function CarsListPage() {
  const [brands, setBrands] = useState([])
  const [cars, setCars] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [engineSearch, setEngineSearch] = useState('')
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState('all')
  const [productionStatusFilter, setProductionStatusFilter] = useState('all')
  const [driveTypeFilter, setDriveTypeFilter] = useState('all')
  const { t, lang } = useTranslation()

  useEffect(() => {
    fetchCatalog()
  }, [])

  const fetchCatalog = async () => {
    try {
      setLoading(true)
      const [carsResponse, brandsResponse] = await Promise.all([
        api.get('/cars/?page_size=200'),
        api.get('/cars/brands/'),
      ])
      const list = carsResponse.data.results || carsResponse.data
      const brandsList = brandsResponse.data.results || brandsResponse.data || []
      setBrands(brandsList)
      setCars(list)
    } catch (error) {
      console.error('Error fetching cars:', error)
    } finally {
      setLoading(false)
    }
  }

  const sortedCars = useMemo(
    () => [...cars].sort((a, b) => `${a.brand_name} ${a.name}`.localeCompare(`${b.brand_name} ${b.name}`)),
    [cars],
  )

  const vehicleTypes = useMemo(() => {
    const values = new Set(cars.map((car) => String(car.vehicle_type || '').trim()).filter(Boolean))
    return Array.from(values).sort((a, b) => a.localeCompare(b))
  }, [cars])

  const filteredCars = useMemo(() => {
    const normalizedSearch = String(searchTerm || '').trim().toLowerCase()
    const normalizedEngine = String(engineSearch || '').trim().toLowerCase()

    return sortedCars.filter((car) => {
      const haystack = `${car.brand_name || ''} ${car.name || ''} ${car.description || ''} ${car.engine_type || ''}`.toLowerCase()

      if (normalizedSearch && !haystack.includes(normalizedSearch)) return false
      if (normalizedEngine && !String(car.engine_type || '').toLowerCase().includes(normalizedEngine)) return false
      if (vehicleTypeFilter !== 'all' && String(car.vehicle_type || '') !== vehicleTypeFilter) return false
      if (productionStatusFilter !== 'all' && String(car.production_status || '') !== productionStatusFilter) return false
      if (driveTypeFilter !== 'all' && detectDriveType(car.engine_type) !== driveTypeFilter) return false
      return true
    })
  }, [sortedCars, searchTerm, engineSearch, vehicleTypeFilter, productionStatusFilter, driveTypeFilter])

  const groupedCarsByBrand = useMemo(() => {
    const groups = new Map()

    filteredCars.forEach((car) => {
      const brandKey = car.brand_id
      if (!brandKey) return
      if (!groups.has(brandKey)) {
        groups.set(brandKey, [])
      }
      groups.get(brandKey).push(car)
    })

    return groups
  }, [filteredCars])

  const matchedCountByBrand = useMemo(() => {
    const byBrandId = new Map()
    filteredCars.forEach((car) => {
      const key = car.brand_id
      if (!key) return
      byBrandId.set(key, (byBrandId.get(key) || 0) + 1)
    })
    return byBrandId
  }, [filteredCars])

  const visibleBrands = useMemo(() => {
    if (
      !searchTerm.trim() &&
      !engineSearch.trim() &&
      vehicleTypeFilter === 'all' &&
      productionStatusFilter === 'all' &&
      driveTypeFilter === 'all'
    ) {
      return brands
    }
    return brands.filter((brand) => (matchedCountByBrand.get(brand.id) || 0) > 0)
  }, [brands, searchTerm, engineSearch, vehicleTypeFilter, productionStatusFilter, driveTypeFilter, matchedCountByBrand])

  const hasActiveFilters =
    Boolean(searchTerm.trim()) ||
    Boolean(engineSearch.trim()) ||
    vehicleTypeFilter !== 'all' ||
    productionStatusFilter !== 'all' ||
    driveTypeFilter !== 'all'

  return (
    <div>
      <h1 className="page-title">{t.pages.carsCatalog}</h1>
      <p className="admin-subtitle" style={{marginBottom: '1.5rem'}}>{t.pages.brandCatalogIntro}</p>

      {loading ? (
        <div className="page-loading">{t.pages.loading}</div>
      ) : (
        <>
          <section className="admin-form-card">
            <h2 className="detail-section-title">{t.pages.modelSearchTitle}</h2>
            <div className="admin-fields-grid">
              <div>
                <label className="form-label" htmlFor="catalog-search">{t.pages.searchModels}</label>
                <input
                  id="catalog-search"
                  className="form-input"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={t.pages.searchModelsPlaceholder}
                />
              </div>
              <div>
                <label className="form-label" htmlFor="catalog-engine">{t.pages.engineFilter}</label>
                <input
                  id="catalog-engine"
                  className="form-input"
                  value={engineSearch}
                  onChange={(e) => setEngineSearch(e.target.value)}
                  placeholder={t.pages.engineFilterPlaceholder}
                />
              </div>
              <div>
                <label className="form-label" htmlFor="catalog-type">{t.pages.type}</label>
                <select
                  id="catalog-type"
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
              <div>
                <label className="form-label" htmlFor="catalog-drive">{t.pages.driveType}</label>
                <select
                  id="catalog-drive"
                  className="form-input"
                  value={driveTypeFilter}
                  onChange={(e) => setDriveTypeFilter(e.target.value)}
                >
                  <option value="all">{t.pages.allLabel}</option>
                  <option value="awd">AWD/4WD</option>
                  <option value="fwd">FWD</option>
                  <option value="rwd">RWD</option>
                  <option value="other">{t.pages.otherDrive}</option>
                </select>
              </div>
              <div>
                <label className="form-label" htmlFor="catalog-status">{t.pages.productionStatus}</label>
                <select
                  id="catalog-status"
                  className="form-input"
                  value={productionStatusFilter}
                  onChange={(e) => setProductionStatusFilter(e.target.value)}
                >
                  <option value="all">{t.pages.allLabel}</option>
                  <option value="active">{t.pages.statusActive}</option>
                  <option value="discontinued">{t.pages.statusDiscontinued}</option>
                  <option value="upcoming">{t.pages.statusUpcoming}</option>
                </select>
              </div>
            </div>
          </section>

          <div className="brand-catalog-list">
            {visibleBrands.length === 0 ? (
              <div className="page-card">{t.pages.noModelsFound}</div>
            ) : visibleBrands.map((brand) => {
            const brandLogo = getBrandLogoOrPlaceholder(brand.logo || '', brand.name)
            const modelCount = Number.isFinite(Number(brand.model_count)) ? Number(brand.model_count) : 0
            const matchedCount = matchedCountByBrand.get(brand.id) || modelCount
            const brandCars = groupedCarsByBrand.get(brand.id) || []
            const modelLabel = formatModelLabel(matchedCount, lang)
            const brandDescription = lang === 'pl'
              ? (brand.description_pl || brand.description_en || brand.description)
              : (brand.description_en || brand.description)

            return (
              <section key={brand.slug || brand.name} className="brand-catalog-card">
                <div className="brand-catalog-header brand-catalog-header-static">
                  <div className="brand-catalog-identity">
                    <img src={brandLogo} alt={brand.name} className="brand-catalog-logo" />

                    <div>
                      <div className="brand-catalog-title-row">
                        <h2 className="brand-catalog-title">{brand.name}</h2>
                        <span className="brand-catalog-badge">{matchedCount} {modelLabel}</span>
                      </div>
                      {brandDescription && (
                        <p className="brand-catalog-description">{brandDescription}</p>
                      )}
                      <div className="brand-catalog-meta-row">
                        {brand.founded_year && (
                          <span className="brand-catalog-meta-pill">{t.pages.brandFounded}: {brand.founded_year}</span>
                        )}
                        <span className="brand-catalog-meta-pill">{matchedCount} {modelLabel}</span>
                      </div>
                    </div>
                  </div>
                  <div className="brand-catalog-actions">
                    <Link to={`/cars/brands/${brand.slug}`} className="catalog-action-btn">
                      {t.pages.openBrand}
                    </Link>
                  </div>
                </div>

                <div style={{ marginTop: '0.5rem', display: 'grid', gap: '0.5rem', padding: '0 0.75rem 0.75rem' }}>
                  {brandCars.length === 0 ? (
                    <div className="page-card">{hasActiveFilters ? t.pages.noModelsFound : t.pages.noModelsInBrand}</div>
                  ) : (
                    brandCars.map((car) => (
                      <article key={car.id} className="brand-catalog-card" style={{ margin: 0, boxShadow: 'none', borderRadius: '0.6rem', background: '#f8fafc' }}>
                        <div className="brand-catalog-header brand-catalog-header-static" style={{ padding: '0.4rem 0.65rem' }}>
                          <div className="brand-catalog-identity" style={{ gridTemplateColumns: '76px 1fr' }}>
                            <img
                              src={getCarImage(car)}
                              alt={car.name}
                              style={{ width: '76px', height: '48px', objectFit: 'cover', borderRadius: '0.4rem', border: '1px solid #dbe4f0', flexShrink: 0 }}
                            />
                            <div>
                              <div className="brand-catalog-title-row">
                                <h3 className="brand-catalog-title" style={{ fontSize: '0.88rem' }}>{car.name}</h3>
                                <span className="brand-catalog-badge" style={{ fontSize: '0.63rem', padding: '0.1rem 0.35rem' }}>{car.vehicle_type || '-'}</span>
                              </div>
                              <div className="brand-catalog-meta-row" style={{ marginTop: '0.2rem', gap: '0.2rem' }}>
                                <span className="brand-catalog-meta-pill" style={{ fontSize: '0.63rem', fontWeight: 600, padding: '0.08rem 0.3rem' }}>{t.pages.engine}: {car.engine_type || '-'}</span>
                                <span className="brand-catalog-meta-pill" style={{ fontSize: '0.63rem', fontWeight: 600, padding: '0.08rem 0.3rem' }}>{t.pages.year}: {car.year_introduced || '-'}</span>
                                <span className="brand-catalog-meta-pill" style={{ fontSize: '0.63rem', fontWeight: 600, padding: '0.08rem 0.3rem' }}>{t.pages.productionStatus}: {car.production_status || '-'}</span>
                              </div>
                            </div>
                          </div>
                          <div className="brand-catalog-actions">
                            <Link to={`/cars/${car.id}`} className="catalog-action-btn">
                              {t.pages.readMore}
                            </Link>
                          </div>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </section>
            )
          })}
          </div>
        </>
      )}
    </div>
  )
}
