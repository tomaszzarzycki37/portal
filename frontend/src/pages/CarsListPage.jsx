import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import { useTranslation } from '../i18n'
import { createBrandPlaceholderUrl, getBrandLogoOrPlaceholder } from '../utils/brandLogos'
import { getCarImage, handleCarImageError } from '../utils/carImages'
import { isAdminUser } from '../utils/auth'

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
  const [expandedBrandDescriptions, setExpandedBrandDescriptions] = useState(() => new Set())
  const { t, lang } = useTranslation()
  const isAdmin = isAdminUser()

  const toggleBrandDescription = (brandId) => {
    setExpandedBrandDescriptions((prev) => {
      const next = new Set(prev)
      if (next.has(brandId)) {
        next.delete(brandId)
      } else {
        next.add(brandId)
      }
      return next
    })
  }

  useEffect(() => {
    fetchCatalog()
  }, [])

  const fetchCatalog = async () => {
    setLoading(true)

    let nextBrands = []
    let nextCars = []

    try {
      const brandsResponse = await api.get('/cars/brands/')
      const brandsPayload = brandsResponse?.data
      nextBrands = Array.isArray(brandsPayload)
        ? brandsPayload
        : Array.isArray(brandsPayload?.results)
          ? brandsPayload.results
          : []
    } catch (error) {
      console.error('Error fetching brands:', error)
    }

    try {
      const carsResponse = await api.get('/cars/?page_size=200')
      const carsPayload = carsResponse?.data
      nextCars = Array.isArray(carsPayload)
        ? carsPayload
        : Array.isArray(carsPayload?.results)
          ? carsPayload.results
          : []
    } catch (error) {
      console.error('Error fetching cars with page_size:', error)

      try {
        // Fallback for environments where page_size can be ignored or rejected.
        const fallbackCarsResponse = await api.get('/cars/')
        const fallbackPayload = fallbackCarsResponse?.data
        nextCars = Array.isArray(fallbackPayload)
          ? fallbackPayload
          : Array.isArray(fallbackPayload?.results)
            ? fallbackPayload.results
            : []
      } catch (fallbackError) {
        console.error('Error fetching cars fallback:', fallbackError)
      }
    }

    setBrands(nextBrands)
    setCars(nextCars)
    setLoading(false)
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

    const brandIdsMatchingSearch = new Set(
      brands
        .filter((brand) => {
          if (!normalizedSearch) return false
          const brandHaystack = `${brand.name || ''} ${brand.description || ''} ${brand.description_en || ''} ${brand.description_pl || ''}`.toLowerCase()
          return brandHaystack.includes(normalizedSearch)
        })
        .map((brand) => brand.id),
    )

    return sortedCars.filter((car) => {
      const haystack = `${car.brand_name || ''} ${car.name || ''} ${car.description || ''} ${car.engine_type || ''}`.toLowerCase()

      if (
        normalizedSearch &&
        !haystack.includes(normalizedSearch) &&
        !brandIdsMatchingSearch.has(car.brand_id)
      ) {
        return false
      }
      if (normalizedEngine && !String(car.engine_type || '').toLowerCase().includes(normalizedEngine)) return false
      if (vehicleTypeFilter !== 'all' && String(car.vehicle_type || '') !== vehicleTypeFilter) return false
      if (productionStatusFilter !== 'all' && String(car.production_status || '') !== productionStatusFilter) return false
      if (driveTypeFilter !== 'all' && detectDriveType(car.engine_type) !== driveTypeFilter) return false
      return true
    })
  }, [sortedCars, brands, searchTerm, engineSearch, vehicleTypeFilter, productionStatusFilter, driveTypeFilter])

  const brandIdsMatchingSearch = useMemo(() => {
    const normalizedSearch = String(searchTerm || '').trim().toLowerCase()
    if (!normalizedSearch) {
      return new Set()
    }

    return new Set(
      brands
        .filter((brand) => {
          const brandHaystack = `${brand.name || ''} ${brand.description || ''} ${brand.description_en || ''} ${brand.description_pl || ''}`.toLowerCase()
          return brandHaystack.includes(normalizedSearch)
        })
        .map((brand) => brand.id),
    )
  }, [brands, searchTerm])

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

  const groupedModelFamiliesByBrand = useMemo(() => {
    const families = new Map()

    groupedCarsByBrand.forEach((brandCars, brandId) => {
      const byName = new Map()

      brandCars.forEach((car) => {
        const familyKey = String(car.name || '').trim().toLowerCase()
        if (!familyKey) return

        if (!byName.has(familyKey)) {
          byName.set(familyKey, {
            key: `${brandId}-${familyKey}`,
            name: car.name,
            variants: [],
          })
        }

        byName.get(familyKey).variants.push(car)
      })

      const familiesList = Array.from(byName.values()).map((family) => ({
        ...family,
        variants: [...family.variants].sort((a, b) => Number(b.year_introduced || 0) - Number(a.year_introduced || 0)),
      }))

      families.set(brandId, familiesList)
    })

    return families
  }, [groupedCarsByBrand])

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
    return brands.filter(
      (brand) => (matchedCountByBrand.get(brand.id) || 0) > 0 || brandIdsMatchingSearch.has(brand.id),
    )
  }, [brands, searchTerm, engineSearch, vehicleTypeFilter, productionStatusFilter, driveTypeFilter, matchedCountByBrand, brandIdsMatchingSearch])

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
          <section className="admin-form-card catalog-search-card">
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
            const brandCars = groupedModelFamiliesByBrand.get(brand.id) || []
            const modelLabel = formatModelLabel(matchedCount, lang)
            const brandDescription = lang === 'pl'
              ? (brand.description_pl || brand.description_en || brand.description)
              : (brand.description_en || brand.description)
            const isDescriptionExpanded = expandedBrandDescriptions.has(brand.id)
            const shouldShowDescriptionToggle = String(brandDescription || '').trim().length > 420

            return (
              <section key={brand.slug || brand.name} className="brand-catalog-card">
                <div className="brand-catalog-header brand-catalog-header-static">
                  <div className="brand-catalog-identity">
                    <img
                      src={brandLogo}
                      alt={brand.name}
                      className="brand-catalog-logo"
                      onError={(event) => {
                        event.currentTarget.onerror = null
                        event.currentTarget.src = createBrandPlaceholderUrl(brand.name)
                      }}
                    />

                    <div>
                      <div className="brand-catalog-title-row">
                        <h2 className="brand-catalog-title">{brand.name}</h2>
                        <span className="brand-catalog-badge">{matchedCount} {modelLabel}</span>
                      </div>
                      {brandDescription && (
                        <>
                          <p className={`brand-catalog-description${isDescriptionExpanded ? '' : ' brand-catalog-description-collapsed'}`}>
                            {brandDescription}
                          </p>
                          {shouldShowDescriptionToggle && (
                            <button
                              type="button"
                              className="brand-description-toggle"
                              onClick={() => toggleBrandDescription(brand.id)}
                            >
                              {isDescriptionExpanded ? t.pages.showLess : t.pages.readMore}
                            </button>
                          )}
                        </>
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

                <div className="brand-catalog-models-list">
                  {brandCars.length === 0 ? (
                    <div className="page-card">
                      <div className="brand-empty-models-content">
                        <p>{hasActiveFilters ? t.pages.noModelsFound : t.pages.noModelsInBrand}</p>
                        {isAdmin && !hasActiveFilters && (
                          <Link
                            to={`/admin?section=create-model&brandId=${brand.id}`}
                            className="admin-inline-toggle admin-inline-gear"
                            title={t.adminPanel.createModel}
                            aria-label={t.adminPanel.createModel}
                          >
                            <svg className="admin-inline-icon" viewBox="0 0 24 24" aria-hidden="true">
                              <path d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.3 7.3 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.49-.42h-3.84a.5.5 0 0 0-.49.42l-.36 2.54c-.58.22-1.12.53-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.7 8.84a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.82 14.52a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96c.5.4 1.05.72 1.63.94l.36 2.54a.5.5 0 0 0 .49.42h3.84a.5.5 0 0 0 .49-.42l.36-2.54c.58-.22 1.12-.53 1.63-.94l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z" />
                            </svg>
                          </Link>
                        )}
                      </div>
                    </div>
                  ) : (
                    brandCars.map((family) => {
                      const primaryVariant = family.variants[0]
                      const familyYears = family.variants
                        .map((variant) => variant.year_introduced)
                        .filter(Boolean)
                        .join(' / ')

                      return (
                      <article key={family.key} className="brand-catalog-card brand-catalog-model-family-card">
                        <div className="brand-catalog-header brand-catalog-header-static brand-catalog-model-family-header">
                          <div className="brand-catalog-identity brand-catalog-model-family-identity">
                            <img
                              src={getCarImage(primaryVariant)}
                              alt={family.name}
                              onError={handleCarImageError}
                              className="brand-catalog-model-family-image"
                            />
                            <div>
                              <div className="brand-catalog-title-row">
                                <h3 className="brand-catalog-title brand-catalog-model-family-title">{family.name}</h3>
                                <span className="brand-catalog-badge brand-catalog-model-family-badge">{primaryVariant.vehicle_type || '-'}</span>
                                {familyYears && (
                                  <span className="brand-catalog-badge brand-catalog-model-family-badge">{familyYears}</span>
                                )}
                              </div>
                              {family.variants.map((variant) => (
                                <div key={variant.id} className="brand-catalog-meta-row brand-catalog-model-family-meta-row">
                                  <span className="brand-catalog-meta-pill brand-catalog-model-family-pill">{t.pages.year}: {variant.year_introduced || '-'}</span>
                                  <span className="brand-catalog-meta-pill brand-catalog-model-family-pill">{t.pages.engine}: {variant.engine_type || '-'}</span>
                                  <span className="brand-catalog-meta-pill brand-catalog-model-family-pill">{t.pages.productionStatus}: {variant.production_status || '-'}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="brand-catalog-actions brand-catalog-model-family-actions">
                            <Link to={`/cars/${primaryVariant.id}`} className="catalog-action-btn">
                              {t.pages.readMore}
                            </Link>
                          </div>
                        </div>
                      </article>
                    )})
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
