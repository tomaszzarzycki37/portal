import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import { useTranslation } from '../i18n'
import { createBrandPlaceholderUrl, getBrandLogoOrPlaceholder } from '../utils/brandLogos'
import { getCarImage, handleCarImageError } from '../utils/carImages'
import { isAdminUser, isAuthenticatedUser } from '../utils/auth'

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('file_read_failed'))
    reader.readAsDataURL(file)
  })
}

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
  const [previewImageUrl, setPreviewImageUrl] = useState('')
  const [previewImageAlt, setPreviewImageAlt] = useState('')
  const [logoEditorBrand, setLogoEditorBrand] = useState(null)
  const [logoEditorFile, setLogoEditorFile] = useState(null)
  const [logoEditorPreviewUrl, setLogoEditorPreviewUrl] = useState('')
  const [logoEditorCleared, setLogoEditorCleared] = useState(false)
  const [logoEditorSaving, setLogoEditorSaving] = useState(false)
  const [logoEditorMessage, setLogoEditorMessage] = useState('')
  const [logoEditorError, setLogoEditorError] = useState('')
  const [createModelBrand, setCreateModelBrand] = useState(null)
  const [newModelName, setNewModelName] = useState('')
  const [newModelYear, setNewModelYear] = useState('')
  const [newModelType, setNewModelType] = useState('sedan')
  const [newModelEngine, setNewModelEngine] = useState('')
  const [newModelPriceMin, setNewModelPriceMin] = useState('')
  const [newModelPriceMax, setNewModelPriceMax] = useState('')
  const [newModelCurrency, setNewModelCurrency] = useState('CNY')
  const [newModelDescription, setNewModelDescription] = useState('')
  const [newModelStatus, setNewModelStatus] = useState('active')
  const [newModelFeatured, setNewModelFeatured] = useState(false)
  const [creatingModel, setCreatingModel] = useState(false)
  const [createModelMessage, setCreateModelMessage] = useState('')
  const [createModelError, setCreateModelError] = useState('')
  const [brandTextEditor, setBrandTextEditor] = useState(null)
  const [brandTextDraftEn, setBrandTextDraftEn] = useState('')
  const [brandTextDraftPl, setBrandTextDraftPl] = useState('')
  const [brandTextDraftFoundedYear, setBrandTextDraftFoundedYear] = useState('')
  const [brandDescriptionEditorLang, setBrandDescriptionEditorLang] = useState('pl')
  const [brandTextSaving, setBrandTextSaving] = useState(false)
  const [brandTextError, setBrandTextError] = useState('')
  const { t, lang } = useTranslation()
  const isAdmin = isAdminUser()
  const isLoggedIn = isAuthenticatedUser()

  const isImagePreviewOpen = Boolean(previewImageUrl)
  const isLogoEditorOpen = Boolean(logoEditorBrand)
  const isCreateModelOpen = Boolean(createModelBrand)
  const isBrandTextEditorOpen = Boolean(brandTextEditor)

  const logoEditorDisplayUrl = useMemo(() => {
    if (logoEditorPreviewUrl) return logoEditorPreviewUrl
    if (logoEditorCleared) return createBrandPlaceholderUrl(logoEditorBrand?.name)
    return getBrandLogoOrPlaceholder(logoEditorBrand?.logo || '', logoEditorBrand?.name)
  }, [logoEditorBrand, logoEditorPreviewUrl, logoEditorCleared])

  const openGuestImagePreview = (imageUrl, imageAlt) => {
    if (isLoggedIn || !imageUrl) return
    setPreviewImageUrl(imageUrl)
    setPreviewImageAlt(imageAlt || 'Car model image')
  }

  const closeGuestImagePreview = () => {
    setPreviewImageUrl('')
    setPreviewImageAlt('')
  }

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

  const fetchCatalog = async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true)
    }

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
    if (!silent) {
      setLoading(false)
    }
  }

  const resetCreateModelForm = () => {
    setNewModelName('')
    setNewModelYear('')
    setNewModelType('sedan')
    setNewModelEngine('')
    setNewModelPriceMin('')
    setNewModelPriceMax('')
    setNewModelCurrency('CNY')
    setNewModelDescription('')
    setNewModelStatus('active')
    setNewModelFeatured(false)
    setCreateModelMessage('')
    setCreateModelError('')
  }

  const handleOpenCreateModel = (brand) => {
    if (!isAdmin || !brand) return
    resetCreateModelForm()
    setCreateModelBrand(brand)
  }

  const handleCloseCreateModel = () => {
    setCreateModelBrand(null)
    resetCreateModelForm()
  }

  const handleCreateModel = async (event) => {
    event.preventDefault()
    if (!createModelBrand) return

    setCreateModelMessage('')
    setCreateModelError('')

    const name = newModelName.trim()
    const parsedYear = Number.parseInt(newModelYear.trim(), 10)
    const brandId = Number.parseInt(String(createModelBrand.id), 10)
    if (!name || Number.isNaN(parsedYear) || Number.isNaN(brandId)) {
      setCreateModelError(t.adminPanel.createModelValidation)
      return
    }

    if (!newModelDescription.trim()) {
      setCreateModelError(t.adminPanel.createModelValidation)
      return
    }

    try {
      setCreatingModel(true)
      await api.post('/cars/', {
        brand_id: brandId,
        name,
        year_introduced: parsedYear,
        vehicle_type: newModelType,
        description: newModelDescription,
        engine_type: newModelEngine,
        price_min: newModelPriceMin ? parseFloat(newModelPriceMin) : null,
        price_max: newModelPriceMax ? parseFloat(newModelPriceMax) : null,
        currency: newModelCurrency,
        production_status: newModelStatus,
        is_featured: newModelFeatured,
      })

      await fetchCatalog({ silent: true })
      handleCloseCreateModel()
    } catch {
      setCreateModelError(t.adminPanel.modelCreateError)
    } finally {
      setCreatingModel(false)
    }
  }

  const handleOpenLogoEditor = (brand) => {
    if (!isAdmin || !brand) return
    setLogoEditorBrand(brand)
    setLogoEditorFile(null)
    setLogoEditorPreviewUrl('')
    setLogoEditorCleared(false)
    setLogoEditorMessage('')
    setLogoEditorError('')
  }

  const handleCloseLogoEditor = () => {
    setLogoEditorBrand(null)
    setLogoEditorFile(null)
    setLogoEditorPreviewUrl('')
    setLogoEditorCleared(false)
    setLogoEditorMessage('')
    setLogoEditorError('')
  }

  const handleLogoFileChange = async (event) => {
    const file = event.target.files?.[0] || null
    if (!file) return

    try {
      setLogoEditorError('')
      setLogoEditorCleared(false)
      setLogoEditorFile(file)
      const previewUrl = await readFileAsDataUrl(file)
      setLogoEditorPreviewUrl(previewUrl)
    } catch {
      setLogoEditorError(t.pages.brandLogoUploadError)
    } finally {
      event.target.value = ''
    }
  }

  const handleLogoClear = () => {
    setLogoEditorFile(null)
    setLogoEditorPreviewUrl('')
    setLogoEditorCleared(true)
    setLogoEditorMessage('')
    setLogoEditorError('')
  }

  const handleLogoSave = async () => {
    if (!isAdmin || !logoEditorBrand || (!logoEditorFile && !logoEditorCleared)) return

    try {
      setLogoEditorSaving(true)
      setLogoEditorMessage('')
      setLogoEditorError('')

      const formData = new FormData()
      if (logoEditorFile) {
        formData.append('logo', logoEditorFile)
      } else if (logoEditorCleared) {
        formData.append('logo', '')
      }

      const response = await api.patch(`/cars/brands/${logoEditorBrand.slug}/`, formData)
      setBrands((prev) => prev.map((brand) => (
        brand.id === logoEditorBrand.id ? { ...brand, logo: response.data.logo } : brand
      )))
      setLogoEditorMessage(t.pages.brandSaved)
      handleCloseLogoEditor()
    } catch {
      setLogoEditorError(t.pages.brandSaveError)
    } finally {
      setLogoEditorSaving(false)
    }
  }

  const handleLogoEditorKeyDown = (event, brand) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handleOpenLogoEditor(brand)
    }
  }

  const handleEditableKeyDown = (event, action) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      action()
    }
  }

  const getBrandTextFieldLabel = (field) => {
    if (field === 'description') return t.adminPanel.description
    if (field === 'founded_year') return t.pages.brandFounded
    return t.pages.editLabel
  }

  const handleOpenBrandTextEditor = (brand, field) => {
    if (!isAdmin || !brand) return
    setBrandTextError('')
    setBrandDescriptionEditorLang(lang === 'pl' ? 'pl' : 'en')
    setBrandTextDraftEn(brand.description_en || brand.description || '')
    setBrandTextDraftPl(brand.description_pl || '')
    setBrandTextDraftFoundedYear(brand.founded_year ? String(brand.founded_year) : '')
    setBrandTextEditor({ brand, field })
  }

  const handleCloseBrandTextEditor = () => {
    setBrandTextEditor(null)
    setBrandTextError('')
  }

  const handleSaveBrandText = async () => {
    if (!brandTextEditor?.brand) return

    const { brand, field } = brandTextEditor

    try {
      setBrandTextSaving(true)
      setBrandTextError('')

      const payload = {}
      if (field === 'description') {
        payload.description_en = brandTextDraftEn
        payload.description_pl = brandTextDraftPl
      } else if (field === 'founded_year') {
        const foundedYearValue = String(brandTextDraftFoundedYear || '').trim()
        const parsedYear = foundedYearValue ? Number.parseInt(foundedYearValue, 10) : null
        if (foundedYearValue && Number.isNaN(parsedYear)) {
          setBrandTextError(t.pages.brandSaveError)
          return
        }
        payload.founded_year = parsedYear
      }

      const response = await api.patch(`/cars/brands/${brand.slug}/`, payload)
      setBrands((prev) => prev.map((item) => (item.id === brand.id ? { ...item, ...response.data } : item)))
      handleCloseBrandTextEditor()
    } catch {
      setBrandTextError(t.pages.brandSaveError)
    } finally {
      setBrandTextSaving(false)
    }
  }

  useEffect(() => {
    if (!isImagePreviewOpen && !isLogoEditorOpen && !isCreateModelOpen && !isBrandTextEditorOpen) return undefined

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        if (isBrandTextEditorOpen) {
          handleCloseBrandTextEditor()
        } else if (isCreateModelOpen) {
          handleCloseCreateModel()
        } else if (isLogoEditorOpen) {
          handleCloseLogoEditor()
        } else {
          closeGuestImagePreview()
        }
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isImagePreviewOpen, isLogoEditorOpen, isCreateModelOpen, isBrandTextEditorOpen])

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
                    {isAdmin ? (
                      <div
                        className="brand-catalog-logo-wrap review-inline-editable-block"
                        role="button"
                        tabIndex={0}
                        onClick={() => handleOpenLogoEditor(brand)}
                        onKeyDown={(event) => handleLogoEditorKeyDown(event, brand)}
                        aria-label={`${t.pages.editLabel}: ${t.pages.brandLogo}`}
                        title={`${t.pages.editLabel}: ${t.pages.brandLogo}`}
                      >
                        <img
                          src={brandLogo}
                          alt={brand.name}
                          className="brand-catalog-logo"
                          onError={(event) => {
                            event.currentTarget.onerror = null
                            event.currentTarget.src = createBrandPlaceholderUrl(brand.name)
                          }}
                        />
                      </div>
                    ) : (
                      <img
                        src={brandLogo}
                        alt={brand.name}
                        className="brand-catalog-logo"
                        onError={(event) => {
                          event.currentTarget.onerror = null
                          event.currentTarget.src = createBrandPlaceholderUrl(brand.name)
                        }}
                      />
                    )}

                    <div>
                      <div className="brand-catalog-title-row">
                        <h2 className="brand-catalog-title">{brand.name}</h2>
                        <span className="brand-catalog-badge">{matchedCount} {modelLabel}</span>
                      </div>
                      {(brandDescription || isAdmin) && (
                        <>
                          {isAdmin ? (
                            <p
                              className={`brand-catalog-description review-inline-editable-block${isDescriptionExpanded ? '' : ' brand-catalog-description-collapsed'}${brandDescription ? '' : ' review-section-empty'}`}
                              role="button"
                              tabIndex={0}
                              onClick={() => handleOpenBrandTextEditor(brand, 'description')}
                              onKeyDown={(event) => handleEditableKeyDown(event, () => handleOpenBrandTextEditor(brand, 'description'))}
                              title={`${t.pages.editLabel}: ${t.adminPanel.description}`}
                            >
                              {brandDescription || t.pages.brandDescriptionClickToEdit}
                            </p>
                          ) : (
                            <p className={`brand-catalog-description${isDescriptionExpanded ? '' : ' brand-catalog-description-collapsed'}`}>
                              {brandDescription}
                            </p>
                          )}
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
                        {(brand.founded_year || isAdmin) && (
                          isAdmin ? (
                            <span
                              className={`brand-catalog-meta-pill review-inline-editable-block${brand.founded_year ? '' : ' review-section-empty'}`}
                              role="button"
                              tabIndex={0}
                              onClick={() => handleOpenBrandTextEditor(brand, 'founded_year')}
                              onKeyDown={(event) => handleEditableKeyDown(event, () => handleOpenBrandTextEditor(brand, 'founded_year'))}
                              title={`${t.pages.editLabel}: ${t.pages.brandFounded}`}
                            >
                              {t.pages.brandFounded}: {brand.founded_year || '—'}
                            </span>
                          ) : (
                            <span className="brand-catalog-meta-pill">{t.pages.brandFounded}: {brand.founded_year}</span>
                          )
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
                          <button
                            type="button"
                            className="admin-inline-toggle admin-inline-gear"
                            title={t.adminPanel.createModel}
                            aria-label={t.adminPanel.createModel}
                            onClick={() => handleOpenCreateModel(brand)}
                          >
                            <svg className="admin-inline-icon" viewBox="0 0 24 24" aria-hidden="true">
                              <path d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.3 7.3 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.49-.42h-3.84a.5.5 0 0 0-.49.42l-.36 2.54c-.58.22-1.12.53-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.7 8.84a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.82 14.52a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96c.5.4 1.05.72 1.63.94l.36 2.54a.5.5 0 0 0 .49.42h3.84a.5.5 0 0 0 .49-.42l.36-2.54c.58-.22 1.12-.53 1.63-.94l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z" />
                            </svg>
                          </button>
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
                            {isLoggedIn ? (
                              <img
                                src={getCarImage(primaryVariant)}
                                alt={family.name}
                                onError={handleCarImageError}
                                className="brand-catalog-model-family-image"
                              />
                            ) : (
                              <button
                                type="button"
                                className="brand-catalog-model-family-image-btn"
                                onClick={() => openGuestImagePreview(getCarImage(primaryVariant), family.name)}
                                aria-label={lang === 'pl' ? `Powieksz zdjecie modelu ${family.name}` : `Enlarge model image ${family.name}`}
                              >
                                <img
                                  src={getCarImage(primaryVariant)}
                                  alt={family.name}
                                  onError={handleCarImageError}
                                  className="brand-catalog-model-family-image"
                                />
                              </button>
                            )}
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

      {isImagePreviewOpen && (
        <div className="image-preview-overlay" onClick={closeGuestImagePreview} role="presentation">
          <div className="image-preview-modal" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="image-preview-close"
              onClick={closeGuestImagePreview}
              aria-label={lang === 'pl' ? 'Zamknij podglad zdjecia' : 'Close image preview'}
            >
              ×
            </button>
            <img src={previewImageUrl} alt={previewImageAlt} className="image-preview-full" />
          </div>
        </div>
      )}

      {isAdmin && isLogoEditorOpen && (
        <div className="review-inline-editor-backdrop" onClick={handleCloseLogoEditor}>
          <div className="review-inline-editor-modal" onClick={(event) => event.stopPropagation()}>
            <h3 className="review-inline-editor-title">
              {t.pages.editLabel}: {t.pages.brandLogo}
              {logoEditorBrand?.name ? ` (${logoEditorBrand.name})` : ''}
            </h3>
            <div className="review-image-editor">
              <div className="review-gallery-main-container brand-logo-editor-preview">
                <div className="review-gallery-main-wrapper">
                  <img
                    src={logoEditorDisplayUrl}
                    alt={logoEditorBrand?.name || t.pages.brandLogo}
                    className="review-gallery-main brand-logo-editor-image"
                    onError={(event) => {
                      event.currentTarget.onerror = null
                      event.currentTarget.src = createBrandPlaceholderUrl(logoEditorBrand?.name)
                    }}
                  />
                </div>
              </div>
              <div className="review-image-upload-area">
                <input
                  id="brand-logo-modal-input"
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleLogoFileChange}
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => document.getElementById('brand-logo-modal-input')?.click()}
                  disabled={logoEditorSaving}
                >
                  {t.adminInline.chooseFile}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleLogoClear}
                  disabled={logoEditorSaving}
                >
                  {t.pages.brandLogoClear}
                </button>
                <span className="admin-file-picker-name">
                  {logoEditorFile ? logoEditorFile.name : t.adminInline.noFileSelected}
                </span>
              </div>
              {logoEditorMessage && <p className="form-success">{logoEditorMessage}</p>}
              {logoEditorError && <p className="form-error">{logoEditorError}</p>}
              <div className="admin-actions-row">
                <button type="button" className="btn btn-secondary" onClick={handleCloseLogoEditor}>
                  {t.pages.cancelLabel}
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={(!logoEditorFile && !logoEditorCleared) || logoEditorSaving}
                  onClick={handleLogoSave}
                >
                  {logoEditorSaving ? t.pages.loading : t.pages.saveLabel}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isAdmin && isCreateModelOpen && (
        <div className="review-inline-editor-backdrop" onClick={handleCloseCreateModel}>
          <div className="review-inline-editor-modal catalog-create-model-modal" onClick={(event) => event.stopPropagation()}>
            <h3 className="review-inline-editor-title">
              {t.adminPanel.createModel}
              {createModelBrand?.name ? ` — ${createModelBrand.name}` : ''}
            </h3>
            <p className="admin-field-note" style={{ marginBottom: '0.85rem' }}>{t.adminPanel.createModelSubtitle}</p>
            <form onSubmit={handleCreateModel}>
              <div className="admin-form-grid">
                <div>
                  <label className="form-label" htmlFor="catalog-new-model-name">{t.adminInline.modelName}</label>
                  <input
                    id="catalog-new-model-name"
                    className="form-input"
                    value={newModelName}
                    onChange={(e) => setNewModelName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="form-label" htmlFor="catalog-new-model-year">{t.pages.year}</label>
                  <input
                    id="catalog-new-model-year"
                    type="number"
                    className="form-input"
                    value={newModelYear}
                    onChange={(e) => setNewModelYear(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="form-label" htmlFor="catalog-new-model-type">{t.pages.type}</label>
                  <select
                    id="catalog-new-model-type"
                    className="form-input"
                    value={newModelType}
                    onChange={(e) => setNewModelType(e.target.value)}
                  >
                    <option value="sedan">Sedan</option>
                    <option value="suv">SUV</option>
                    <option value="crossover">Crossover</option>
                    <option value="hatchback">Hatchback</option>
                    <option value="coupe">Coupe</option>
                    <option value="van">Van</option>
                    <option value="truck">Truck</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="form-label" htmlFor="catalog-new-model-engine">{t.pages.engine}</label>
                  <input
                    id="catalog-new-model-engine"
                    className="form-input"
                    value={newModelEngine}
                    onChange={(e) => setNewModelEngine(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label" htmlFor="catalog-new-model-price-min">{t.adminPanel.priceMinK}</label>
                  <input
                    id="catalog-new-model-price-min"
                    type="number"
                    className="form-input"
                    value={newModelPriceMin}
                    onChange={(e) => setNewModelPriceMin(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label" htmlFor="catalog-new-model-price-max">{t.adminPanel.priceMaxK}</label>
                  <input
                    id="catalog-new-model-price-max"
                    type="number"
                    className="form-input"
                    value={newModelPriceMax}
                    onChange={(e) => setNewModelPriceMax(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label" htmlFor="catalog-new-model-currency">{t.adminPanel.baseCurrency}</label>
                  <select
                    id="catalog-new-model-currency"
                    className="form-input"
                    value={newModelCurrency}
                    onChange={(e) => setNewModelCurrency(e.target.value)}
                  >
                    <option value="CNY">¥ CNY</option>
                    <option value="USD">$ USD</option>
                    <option value="EUR">€ EUR</option>
                    <option value="GBP">£ GBP</option>
                    <option value="JPY">¥ JPY</option>
                    <option value="PLN">zł PLN</option>
                    <option value="INR">₹ INR</option>
                  </select>
                </div>
                <div>
                  <label className="form-label" htmlFor="catalog-new-model-status">{t.pages.productionStatus}</label>
                  <select
                    id="catalog-new-model-status"
                    className="form-input"
                    value={newModelStatus}
                    onChange={(e) => setNewModelStatus(e.target.value)}
                  >
                    <option value="active">{t.pages.statusActive}</option>
                    <option value="discontinued">{t.pages.statusDiscontinued}</option>
                    <option value="upcoming">{t.pages.statusUpcoming}</option>
                  </select>
                </div>
                <div className="admin-form-grid-full">
                  <label className="form-label" htmlFor="catalog-new-model-description">{t.adminPanel.description}</label>
                  <textarea
                    id="catalog-new-model-description"
                    className="form-input form-textarea"
                    rows={4}
                    value={newModelDescription}
                    onChange={(e) => setNewModelDescription(e.target.value)}
                    required
                  />
                </div>
              </div>
              <label className="form-checkbox-row">
                <input
                  type="checkbox"
                  checked={newModelFeatured}
                  onChange={(e) => setNewModelFeatured(e.target.checked)}
                />
                {t.adminInline.featured}
              </label>
              {createModelMessage && <p className="form-success">{createModelMessage}</p>}
              {createModelError && <p className="form-error">{createModelError}</p>}
              <div className="admin-actions-row">
                <button type="button" className="btn btn-secondary" onClick={handleCloseCreateModel}>
                  {t.pages.cancelLabel}
                </button>
                <button type="submit" className="btn btn-primary" disabled={creatingModel}>
                  {creatingModel ? t.pages.loading : t.adminPanel.createModel}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isAdmin && isBrandTextEditorOpen && (
        <div className="review-inline-editor-backdrop" onClick={handleCloseBrandTextEditor}>
          <div className="review-inline-editor-modal catalog-create-model-modal" onClick={(event) => event.stopPropagation()}>
            <h3 className="review-inline-editor-title">
              {t.pages.editLabel}: {getBrandTextFieldLabel(brandTextEditor.field)}
              {brandTextEditor.brand?.name ? ` — ${brandTextEditor.brand.name}` : ''}
            </h3>
            {brandTextEditor.field === 'description' ? (
              <div>
                <div className="brand-description-switch-row" style={{ marginBottom: '0.75rem' }}>
                  <label className="form-label">{t.adminPanel.textLanguage}</label>
                  <div className="brand-description-switch" role="tablist" aria-label={t.adminPanel.textLanguage}>
                    <button
                      type="button"
                      className={`brand-description-switch-btn ${brandDescriptionEditorLang === 'en' ? 'is-active' : ''}`}
                      onClick={() => setBrandDescriptionEditorLang('en')}
                    >
                      EN
                    </button>
                    <button
                      type="button"
                      className={`brand-description-switch-btn ${brandDescriptionEditorLang === 'pl' ? 'is-active' : ''}`}
                      onClick={() => setBrandDescriptionEditorLang('pl')}
                    >
                      PL
                    </button>
                  </div>
                </div>
                <label className="form-label" htmlFor="catalog-brand-description">
                  {brandDescriptionEditorLang === 'pl' ? t.adminPanel.descriptionPl : t.adminPanel.descriptionEn}
                </label>
                <textarea
                  id="catalog-brand-description"
                  className="form-input form-textarea"
                  rows={6}
                  value={brandDescriptionEditorLang === 'pl' ? brandTextDraftPl : brandTextDraftEn}
                  onChange={(e) => {
                    if (brandDescriptionEditorLang === 'pl') {
                      setBrandTextDraftPl(e.target.value)
                    } else {
                      setBrandTextDraftEn(e.target.value)
                    }
                  }}
                />
              </div>
            ) : (
              <div>
                <label className="form-label" htmlFor="catalog-brand-founded">{t.pages.brandFounded}</label>
                <input
                  id="catalog-brand-founded"
                  type="number"
                  className="form-input"
                  value={brandTextDraftFoundedYear}
                  onChange={(e) => setBrandTextDraftFoundedYear(e.target.value)}
                />
              </div>
            )}
            {brandTextError && <p className="form-error">{brandTextError}</p>}
            <div className="admin-actions-row">
              <button type="button" className="btn btn-secondary" onClick={handleCloseBrandTextEditor}>
                {t.pages.cancelLabel}
              </button>
              <button type="button" className="btn btn-primary" disabled={brandTextSaving} onClick={handleSaveBrandText}>
                {brandTextSaving ? t.pages.loading : t.pages.saveLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
