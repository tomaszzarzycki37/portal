import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import api from '../services/api'
import { useTranslation } from '../i18n'
import { getBrandLogoOrPlaceholder } from '../utils/brandLogos'
import { getCarImage } from '../utils/carImages'
import { isAdminUser } from '../utils/auth'

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('file_read_failed'))
    reader.readAsDataURL(file)
  })
}

const CURRENCY_CONFIG = {
  USD: { symbol: '$', rateToUsd: 1 },
  EUR: { symbol: 'EUR ', rateToUsd: 1.09 },
  PLN: { symbol: 'PLN ', rateToUsd: 0.25 },
  GBP: { symbol: 'GBP ', rateToUsd: 1.27 },
}

const CURRENCY_KEYS = Object.keys(CURRENCY_CONFIG)

function parsePriceRange(priceText) {
  const price = String(priceText || '')
  const detectedCurrencies = CURRENCY_KEYS.filter(
    (key) => price.includes(`${key} `) || (key === 'USD' && price.includes('$')),
  )
  const currency = detectedCurrencies[0] || 'USD'
  const numericMatches = [...price.matchAll(/(\d+(?:[\.,]\d+)?)\s*k?/gi)]
    .map((match) => Number.parseFloat(match[1].replace(',', '.')))
    .filter((n) => !Number.isNaN(n))

  return {
    minK: numericMatches.length >= 1 ? String(numericMatches[0]) : '',
    maxK: numericMatches.length >= 2 ? String(numericMatches[1]) : '',
    currency,
  }
}

function formatPriceRange(minK, maxK, currency) {
  const minValue = Number.parseFloat(String(minK || '').replace(',', '.'))
  const maxValue = Number.parseFloat(String(maxK || '').replace(',', '.'))
  const config = CURRENCY_CONFIG[currency]

  if (!config || Number.isNaN(minValue) || Number.isNaN(maxValue) || minValue <= 0 || maxValue <= 0 || minValue > maxValue) {
    return ''
  }

  const formatK = (value) => {
    if (Number.isInteger(value)) return `${value}`
    return value.toFixed(1)
  }

  if (currency === 'USD') {
    return `${config.symbol}${formatK(minValue)}k-${formatK(maxValue)}k`
  }

  return `${config.symbol}${formatK(minValue)}k-${formatK(maxValue)}k`
}

function convertPriceValue(value, fromCurrency, toCurrency) {
  const parsedValue = Number.parseFloat(String(value || '').replace(',', '.'))
  if (Number.isNaN(parsedValue)) return ''

  const fromConfig = CURRENCY_CONFIG[fromCurrency]
  const toConfig = CURRENCY_CONFIG[toCurrency]
  if (!fromConfig || !toConfig) return String(value || '')

  const valueInUsd = parsedValue * fromConfig.rateToUsd
  const converted = valueInUsd / toConfig.rateToUsd
  const rounded = Math.round(converted * 10) / 10
  return String(rounded)
}

export default function BrandDetailPage() {
  const { slug } = useParams()
  const { t, lang } = useTranslation()
  const isAdmin = isAdminUser()

  const [brand, setBrand] = useState(null)
  const [cars, setCars] = useState([])
  const [loading, setLoading] = useState(true)
  const [drafts, setDrafts] = useState({})
  const [openEditorId, setOpenEditorId] = useState(null)
  const [savingId, setSavingId] = useState(null)
  const [statusById, setStatusById] = useState({})

  const [brandDescriptionEn, setBrandDescriptionEn] = useState('')
  const [brandDescriptionPl, setBrandDescriptionPl] = useState('')
  const [descriptionEditorLang, setDescriptionEditorLang] = useState(lang === 'pl' ? 'pl' : 'en')
  const [brandFoundedYear, setBrandFoundedYear] = useState('')
  const [brandWebsite, setBrandWebsite] = useState('')
  const [brandLogoUrl, setBrandLogoUrl] = useState('')
  const [brandLogoFile, setBrandLogoFile] = useState(null)
  const [brandLogoCleared, setBrandLogoCleared] = useState(false)
  const [brandSaving, setBrandSaving] = useState(false)
  const [brandMessage, setBrandMessage] = useState('')
  const [brandError, setBrandError] = useState('')

  useEffect(() => {
    const loadBrandPage = async () => {
      try {
        setLoading(true)
        const brandResponse = await api.get(`/cars/brands/${slug}/`)
        const brandData = brandResponse.data
        setBrand(brandData)
        setBrandDescriptionEn(brandData.description_en || brandData.description || '')
        setBrandDescriptionPl(brandData.description_pl || '')
        setBrandFoundedYear(brandData.founded_year ? String(brandData.founded_year) : '')
        setBrandWebsite(brandData.website || '')
        setBrandLogoUrl(brandData.logo || '')
        setBrandLogoFile(null)
        setBrandLogoCleared(false)

        const carsResponse = await api.get(`/cars/?brand=${brandData.id}&page_size=200`)
        const carList = carsResponse.data.results || carsResponse.data || []
        setCars(carList)

        const initialDrafts = {}
        carList.forEach((car) => {
          const parsedPrice = parsePriceRange(car.price_range)
          initialDrafts[car.id] = {
            name: car.name || '',
            year_introduced: car.year_introduced ? String(car.year_introduced) : '',
            vehicle_type: car.vehicle_type || 'sedan',
            engine_type: car.engine_type || '',
            price_min_k: parsedPrice.minK,
            price_max_k: parsedPrice.maxK,
            price_currency: parsedPrice.currency,
            production_status: car.production_status || 'active',
            is_featured: !!car.is_featured,
          }
        })
        setDrafts(initialDrafts)
      } catch {
        setBrand(null)
        setCars([])
      } finally {
        setLoading(false)
      }
    }

    loadBrandPage()
  }, [slug])

  useEffect(() => {
    setDescriptionEditorLang(lang === 'pl' ? 'pl' : 'en')
  }, [lang])

  const brandLogo = useMemo(() => getBrandLogoOrPlaceholder(brand?.logo || '', brand?.name), [brand])
  const editableBrandLogo = useMemo(
    () => getBrandLogoOrPlaceholder(brandLogoUrl || '', brand?.name),
    [brandLogoUrl, brand?.name],
  )

  const groupedCars = useMemo(() => {
    const buckets = new Map()

    cars.forEach((car) => {
      const rawName = String(car.name || '').trim()
      const key = rawName.toLowerCase() || 'unknown-model'

      if (!buckets.has(key)) {
        buckets.set(key, {
          label: rawName || 'Unknown model',
          cars: [],
        })
      }

      buckets.get(key).cars.push(car)
    })

    return Array.from(buckets.entries())
      .sort((a, b) => a[1].label.localeCompare(b[1].label))
      .map(([key, group]) => ({
        key,
        label: group.label,
        cars: [...group.cars].sort((a, b) => (b.year_introduced || 0) - (a.year_introduced || 0)),
      }))
  }, [cars])

  const handleBrandLogoFileChange = async (e) => {
    const file = e.target.files?.[0] || null
    if (!file) return

    try {
      setBrandError('')
      setBrandLogoCleared(false)
      setBrandLogoFile(file)
      const previewUrl = await readFileAsDataUrl(file)
      setBrandLogoUrl(previewUrl)
    } catch {
      setBrandError(t.pages.brandLogoUploadError)
    } finally {
      e.target.value = ''
    }
  }

  const handleBrandSave = async (e) => {
    e.preventDefault()
    if (!isAdmin || !brand) return

    try {
      setBrandSaving(true)
      setBrandMessage('')
      setBrandError('')

      const foundedYearValue = String(brandFoundedYear || '').trim()
      const parsedYear = foundedYearValue ? Number.parseInt(foundedYearValue, 10) : null
      if (foundedYearValue && Number.isNaN(parsedYear)) {
        setBrandError(t.pages.brandSaveError)
        return
      }

      const formData = new FormData()
      formData.append('description_en', brandDescriptionEn)
      formData.append('description_pl', brandDescriptionPl)
      formData.append('founded_year', parsedYear === null ? '' : String(parsedYear))
      formData.append('website', brandWebsite)
      if (brandLogoFile) {
        formData.append('logo', brandLogoFile)
      } else if (brandLogoCleared) {
        formData.append('logo', '')
      }

      const response = await api.patch(`/cars/brands/${brand.slug}/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setBrand(response.data)
      setBrandDescriptionEn(response.data.description_en || '')
      setBrandDescriptionPl(response.data.description_pl || '')
      setBrandFoundedYear(response.data.founded_year ? String(response.data.founded_year) : '')
      setBrandWebsite(response.data.website || '')
      setBrandLogoUrl(response.data.logo || '')
      setBrandLogoFile(null)
      setBrandLogoCleared(false)
      setBrandMessage(t.pages.brandSaved)
    } catch {
      setBrandError(t.pages.brandSaveError)
    } finally {
      setBrandSaving(false)
    }
  }

  const handleDraftChange = (carId, field, value) => {
    setDrafts((prev) => ({
      ...prev,
      [carId]: {
        ...(prev[carId] || {}),
        [field]: value,
      },
    }))
  }

  const handleToggleEditor = (carId) => {
    setStatusById((prev) => ({ ...prev, [carId]: '' }))
    setOpenEditorId((prev) => (prev === carId ? null : carId))
  }

  const handlePriceCurrencyChange = (carId, nextCurrency) => {
    const currentDraft = drafts[carId] || {}
    const previousCurrency = currentDraft.price_currency || 'USD'

    setDrafts((prev) => ({
      ...prev,
      [carId]: {
        ...(prev[carId] || {}),
        price_currency: nextCurrency,
        price_min_k: convertPriceValue(prev[carId]?.price_min_k, previousCurrency, nextCurrency),
        price_max_k: convertPriceValue(prev[carId]?.price_max_k, previousCurrency, nextCurrency),
      },
    }))
  }

  const handleQuickSave = async (carId) => {
    if (!isAdmin) return

    const draft = drafts[carId]
    if (!draft) return

    const parsedYear = Number.parseInt(String(draft.year_introduced || '').trim(), 10)
    if (Number.isNaN(parsedYear)) {
      setStatusById((prev) => ({ ...prev, [carId]: t.adminInline.yearRequired }))
      return
    }

    try {
      setSavingId(carId)
      setStatusById((prev) => ({ ...prev, [carId]: '' }))

      const payload = {
        year_introduced: parsedYear,
        vehicle_type: draft.vehicle_type,
        engine_type: draft.engine_type,
        price_range: formatPriceRange(draft.price_min_k, draft.price_max_k, draft.price_currency),
        production_status: draft.production_status,
        is_featured: !!draft.is_featured,
      }

      const trimmedName = String(draft.name || '').trim()
      if (trimmedName) {
        payload.name = trimmedName
      }

      const response = await api.patch(`/cars/${carId}/`, payload)

      const updatedCar = response.data
      setCars((prev) => prev.map((car) => (car.id === carId ? { ...car, ...updatedCar } : car)))
      setStatusById((prev) => ({ ...prev, [carId]: t.adminInline.saved }))
      setOpenEditorId(null)
    } catch {
      setStatusById((prev) => ({ ...prev, [carId]: t.adminInline.saveError }))
    } finally {
      setSavingId(null)
    }
  }

  if (loading) {
    return <div className="page-loading">{t.pages.loading}</div>
  }

  if (!brand) {
    return <div className="page-card">{t.pages.brandNotFound}</div>
  }

  return (
    <div className="brand-detail-layout">
      <section className="page-card brand-detail-hero">
        <div className="brand-detail-header">
          <img src={brandLogo} alt={brand.name} className="brand-detail-logo" />
          <div>
            <h1 className="page-title">{brand.name}</h1>
            {brand.founded_year && (
              <p className="page-subtitle">
                {t.pages.brandFounded}: {brand.founded_year}
              </p>
            )}
            {brand.website && (
              <a href={brand.website} target="_blank" rel="noreferrer" className="brand-detail-link">
                {t.pages.brandWebsite}
              </a>
            )}
          </div>
        </div>

        {(brand.description_pl || brand.description_en || brand.description) && (
          <p className="brand-detail-description">
            {lang === 'pl'
              ? (brand.description_pl || brand.description_en || brand.description)
              : (brand.description_en || brand.description)}
          </p>
        )}
      </section>

      {isAdmin && (
        <section className="admin-form-card">
          <h2 className="admin-section-heading">{t.pages.brandEditorTitle}</h2>
          <form onSubmit={handleBrandSave}>
            <div className="admin-form-grid">
              <div>
                <label className="form-label" htmlFor="brand-founded">{t.pages.brandFounded}</label>
                <input
                  id="brand-founded"
                  type="number"
                  className="form-input"
                  value={brandFoundedYear}
                  onChange={(e) => setBrandFoundedYear(e.target.value)}
                />
              </div>

              <div>
                <label className="form-label" htmlFor="brand-website">{t.pages.brandWebsite}</label>
                <input
                  id="brand-website"
                  className="form-input"
                  value={brandWebsite}
                  onChange={(e) => setBrandWebsite(e.target.value)}
                />
              </div>

              <div className="admin-form-grid-full">
                <div className="brand-description-switch-row">
                  <label className="form-label">{t.adminPanel.textLanguage}</label>
                  <div className="brand-description-switch" role="tablist" aria-label={t.adminPanel.textLanguage}>
                    <button
                      type="button"
                      className={`brand-description-switch-btn ${descriptionEditorLang === 'en' ? 'is-active' : ''}`}
                      onClick={() => setDescriptionEditorLang('en')}
                    >
                      EN
                    </button>
                    <button
                      type="button"
                      className={`brand-description-switch-btn ${descriptionEditorLang === 'pl' ? 'is-active' : ''}`}
                      onClick={() => setDescriptionEditorLang('pl')}
                    >
                      PL
                    </button>
                  </div>
                </div>

                <label className="form-label" htmlFor="brand-description-language">
                  {descriptionEditorLang === 'pl' ? t.adminPanel.descriptionPl : t.adminPanel.descriptionEn}
                </label>
                <textarea
                  id="brand-description-language"
                  className="form-input form-textarea"
                  rows={4}
                  value={descriptionEditorLang === 'pl' ? brandDescriptionPl : brandDescriptionEn}
                  onChange={(e) => {
                    if (descriptionEditorLang === 'pl') {
                      setBrandDescriptionPl(e.target.value)
                    } else {
                      setBrandDescriptionEn(e.target.value)
                    }
                  }}
                />
              </div>

              <div>
                <label className="form-label" htmlFor="brand-logo-file">{t.pages.brandLogoUpload}</label>
                <input
                  id="brand-logo-file"
                  type="file"
                  accept="image/*"
                  className="form-input"
                  onChange={handleBrandLogoFileChange}
                />
              </div>

              <div>
                <label className="form-label">{t.pages.brandLogoActions}</label>
                <button
                  type="button"
                  className="btn btn-secondary admin-inline-action-btn"
                  onClick={() => {
                    setBrandLogoFile(null)
                    setBrandLogoUrl('')
                    setBrandLogoCleared(true)
                    setBrandMessage('')
                    setBrandError('')
                  }}
                >
                  {t.pages.brandLogoClear}
                </button>
              </div>

              <div className="admin-form-grid-full">
                <img src={editableBrandLogo} alt={brand.name} className="admin-brand-logo-preview" />
              </div>
            </div>

            {brandMessage && <p className="form-success">{brandMessage}</p>}
            {brandError && <p className="form-error">{brandError}</p>}

            <div className="admin-actions-row">
              <button type="submit" className="btn btn-primary" disabled={brandSaving}>
                {brandSaving ? t.pages.loading : t.pages.brandSave}
              </button>
            </div>
          </form>
        </section>
      )}

      <section>
        <div className="brand-detail-top">
          <h2 className="page-title brand-section-title">{t.pages.brandLineup}</h2>
          {isAdmin && <p className="admin-meta">{t.adminPanel.ownerLabel}: admin</p>}
        </div>

        {cars.length === 0 ? (
          <div className="page-card">{t.pages.noModelsInBrand}</div>
        ) : (
          <div className="brand-lineup-groups">
            {groupedCars.map((group) => (
              <section key={group.key} className="brand-lineup-group">
                <div className="brand-lineup-group-header">
                  <h3 className="brand-lineup-group-title">{group.label}</h3>
                  <span className="brand-lineup-group-count">
                    {group.cars.length} {t.pages.modelsLabel}
                  </span>
                </div>

                <div className="cars-grid">
                  {group.cars.map((car) => (
                    <article key={car.id} className={`car-card-item ${isAdmin ? 'car-card-admin' : ''}`}>
                      <Link to={`/cars/${car.id}`} className="car-card-link">
                        <img src={getCarImage(car)} alt={car.name} className="car-thumb" />
                        <h3 className="car-name">{car.name}</h3>
                        <p className="car-meta">
                          {brand.name} &bull; {car.year_introduced}
                        </p>
                        <p className="car-type">{car.vehicle_type}</p>
                        <div className="car-rating-row">
                          <span className="rating">★ {car.avg_rating}</span>
                          <span className="car-count-badge">
                            {car.opinions_count} {t.pages.reviewsLabel}
                          </span>
                        </div>
                      </Link>

                      {isAdmin && (
                        <div className="admin-inline-wrap">
                          <button
                            type="button"
                            className="admin-inline-toggle admin-inline-gear"
                            onClick={() => handleToggleEditor(car.id)}
                            aria-expanded={openEditorId === car.id}
                            aria-label={openEditorId === car.id ? t.adminInline.hideSettings : t.adminInline.showSettings}
                            title={openEditorId === car.id ? t.adminInline.hideSettings : t.adminInline.showSettings}
                          >
                            <svg className="admin-inline-icon" viewBox="0 0 24 24" aria-hidden="true">
                              <path d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.3 7.3 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.49-.42h-3.84a.5.5 0 0 0-.49.42l-.36 2.54c-.58.22-1.12.53-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.7 8.84a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.82 14.52a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96c.5.4 1.05.72 1.63.94l.36 2.54a.5.5 0 0 0 .49.42h3.84a.5.5 0 0 0 .49-.42l.36-2.54c.58-.22 1.12-.53 1.63-.94l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z" />
                            </svg>
                          </button>

                          {openEditorId === car.id && (
                            <div className="admin-inline-card">
                              <p className="admin-inline-title">{t.adminInline.quickEdit}</p>

                              <p className="admin-inline-section-title">{t.adminInline.sectionBasics}</p>
                              <div className="admin-inline-grid">
                                <div>
                                  <label className="form-label" htmlFor={`name-${car.id}`}>{t.adminInline.modelName}</label>
                                  <input
                                    id={`name-${car.id}`}
                                    className="form-input"
                                    value={drafts[car.id]?.name || ''}
                                    onChange={(e) => handleDraftChange(car.id, 'name', e.target.value)}
                                  />
                                </div>

                                <div>
                                  <label className="form-label" htmlFor={`year-${car.id}`}>{t.pages.year}</label>
                                  <input
                                    id={`year-${car.id}`}
                                    type="number"
                                    className="form-input"
                                    value={drafts[car.id]?.year_introduced || ''}
                                    onChange={(e) => handleDraftChange(car.id, 'year_introduced', e.target.value)}
                                  />
                                </div>

                                <div>
                                  <label className="form-label" htmlFor={`type-${car.id}`}>{t.pages.type}</label>
                                  <select
                                    id={`type-${car.id}`}
                                    className="form-input"
                                    value={drafts[car.id]?.vehicle_type || 'sedan'}
                                    onChange={(e) => handleDraftChange(car.id, 'vehicle_type', e.target.value)}
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
                                  <label className="form-label" htmlFor={`engine-${car.id}`}>{t.pages.engine}</label>
                                  <input
                                    id={`engine-${car.id}`}
                                    className="form-input"
                                    value={drafts[car.id]?.engine_type || ''}
                                    onChange={(e) => handleDraftChange(car.id, 'engine_type', e.target.value)}
                                  />
                                </div>
                              </div>

                              <p className="admin-inline-section-title">{t.pages.sectionMarket}</p>
                              <div className="admin-inline-grid">
                                <div>
                                  <label className="form-label" htmlFor={`price-currency-${car.id}`}>{t.adminPanel.baseCurrency}</label>
                                  <select
                                    id={`price-currency-${car.id}`}
                                    className="form-input"
                                    value={drafts[car.id]?.price_currency || 'USD'}
                                    onChange={(e) => handlePriceCurrencyChange(car.id, e.target.value)}
                                  >
                                    <option value="USD">USD</option>
                                    <option value="EUR">EUR</option>
                                    <option value="PLN">PLN</option>
                                    <option value="GBP">GBP</option>
                                  </select>
                                </div>

                                <div>
                                  <label className="form-label" htmlFor={`price-min-${car.id}`}>{t.adminPanel.priceMinK}</label>
                                  <input
                                    id={`price-min-${car.id}`}
                                    className="form-input"
                                    inputMode="decimal"
                                    value={drafts[car.id]?.price_min_k || ''}
                                    onChange={(e) => handleDraftChange(car.id, 'price_min_k', e.target.value)}
                                  />
                                </div>

                                <div>
                                  <label className="form-label" htmlFor={`price-max-${car.id}`}>{t.adminPanel.priceMaxK}</label>
                                  <input
                                    id={`price-max-${car.id}`}
                                    className="form-input"
                                    inputMode="decimal"
                                    value={drafts[car.id]?.price_max_k || ''}
                                    onChange={(e) => handleDraftChange(car.id, 'price_max_k', e.target.value)}
                                  />
                                </div>

                                <div>
                                  <label className="form-label" htmlFor={`status-${car.id}`}>{t.pages.productionStatus}</label>
                                  <select
                                    id={`status-${car.id}`}
                                    className="form-input"
                                    value={drafts[car.id]?.production_status || 'active'}
                                    onChange={(e) => handleDraftChange(car.id, 'production_status', e.target.value)}
                                  >
                                    <option value="active">{t.pages.statusActive}</option>
                                    <option value="discontinued">{t.pages.statusDiscontinued}</option>
                                    <option value="upcoming">{t.pages.statusUpcoming}</option>
                                  </select>
                                </div>
                              </div>

                              <label className="form-checkbox-row">
                                <input
                                  type="checkbox"
                                  checked={!!drafts[car.id]?.is_featured}
                                  onChange={(e) => handleDraftChange(car.id, 'is_featured', e.target.checked)}
                                />
                                {t.adminInline.featured}
                              </label>

                              <button
                                type="button"
                                className="btn btn-secondary"
                                disabled={savingId === car.id}
                                onClick={() => handleQuickSave(car.id)}
                              >
                                {savingId === car.id ? t.pages.loading : t.adminInline.save}
                              </button>

                              {statusById[car.id] && (
                                <p className={statusById[car.id] === t.adminInline.saved ? 'form-success' : 'form-error'}>
                                  {statusById[car.id]}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
