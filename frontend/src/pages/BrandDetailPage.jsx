import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import api from '../services/api'
import { useTranslation } from '../i18n'
import { getBrandLogoOrPlaceholder } from '../utils/brandLogos'
import { getCarImage, handleCarImageError } from '../utils/carImages'
import { isAdminUser } from '../utils/auth'
import { filterCarsForCatalogSearch, parseCatalogSearchParams } from '../utils/catalogSearch'
import { buildModelFamilyPath } from '../utils/modelSlug'

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

export default function BrandDetailPage() {
  const { slug } = useParams()
  const [searchParams] = useSearchParams()
  const { t, lang } = useTranslation()
  const isAdmin = isAdminUser()
  const [themeMode, setThemeMode] = useState(() => localStorage.getItem('admin_theme_mode') || 'light')

  const [brand, setBrand] = useState(null)
  const [cars, setCars] = useState([])
  const [loading, setLoading] = useState(true)

  const [brandDescriptionEn, setBrandDescriptionEn] = useState('')
  const [brandDescriptionPl, setBrandDescriptionPl] = useState('')
  const [descriptionEditorLang, setDescriptionEditorLang] = useState(lang === 'pl' ? 'pl' : 'en')
  const [brandAnecdoteEn, setBrandAnecdoteEn] = useState('')
  const [brandAnecdotePl, setBrandAnecdotePl] = useState('')
  const [anecdoteEditorLang, setAnecdoteEditorLang] = useState(lang === 'pl' ? 'pl' : 'en')
  const [brandFoundedYear, setBrandFoundedYear] = useState('')
  const [brandWebsite, setBrandWebsite] = useState('')
  const [brandLogoUrl, setBrandLogoUrl] = useState('')
  const [brandLogoFile, setBrandLogoFile] = useState(null)
  const [brandLogoCleared, setBrandLogoCleared] = useState(false)
  const [brandSaving, setBrandSaving] = useState(false)
  const [brandMessage, setBrandMessage] = useState('')
  const [brandError, setBrandError] = useState('')
  const [isBrandEditorOpen, setIsBrandEditorOpen] = useState(false)
  const isDarkTheme = themeMode === 'dark' || (typeof document !== 'undefined' && document.body.classList.contains('app-theme-dark'))

  useEffect(() => {
    const loadBrandPage = async () => {
      try {
        setLoading(true)
        const brandResponse = await api.get(`/cars/brands/${slug}/`)
        const brandData = brandResponse.data
        setBrand(brandData)
        setBrandDescriptionEn(brandData.description_en || brandData.description || '')
        setBrandDescriptionPl(brandData.description_pl || '')
        setBrandAnecdoteEn(brandData.brand_anecdote_en || '')
        setBrandAnecdotePl(brandData.brand_anecdote_pl || '')
        setBrandFoundedYear(brandData.founded_year ? String(brandData.founded_year) : '')
        setBrandWebsite(brandData.website || '')
        setBrandLogoUrl(brandData.logo || '')
        setBrandLogoFile(null)
        setBrandLogoCleared(false)

        const carsResponse = await api.get(`/cars/?brand=${brandData.id}&page_size=200`)
        const carList = carsResponse.data.results || carsResponse.data || []
        setCars(carList)
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

  useEffect(() => {
    const readTheme = () => localStorage.getItem('admin_theme_mode') || 'light'
    const syncTheme = (nextMode) => setThemeMode(nextMode || readTheme())

    const handleStorage = (event) => {
      if (event.key === 'admin_theme_mode') syncTheme(event.newValue)
    }

    const handleThemeChange = (event) => syncTheme(event?.detail)

    syncTheme(readTheme())
    window.addEventListener('storage', handleStorage)
    window.addEventListener('theme-mode-changed', handleThemeChange)

    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener('theme-mode-changed', handleThemeChange)
    }
  }, [])

  const brandLogo = useMemo(() => getBrandLogoOrPlaceholder(brand?.logo || '', brand?.name), [brand])
  const editableBrandLogo = useMemo(
    () => getBrandLogoOrPlaceholder(brandLogoUrl || '', brand?.name),
    [brandLogoUrl, brand?.name],
  )

  const catalogSearchFilters = useMemo(
    () => parseCatalogSearchParams(searchParams),
    [searchParams],
  )

  const filteredCars = useMemo(
    () => filterCarsForCatalogSearch(cars, catalogSearchFilters),
    [cars, catalogSearchFilters],
  )

  const groupedCars = useMemo(() => {
    const buckets = new Map()

    filteredCars.forEach((car) => {
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
  }, [filteredCars])

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

  const handleDeleteBrand = async () => {
    if (!isAdmin || !brand) return
    if (!window.confirm(`${t.pages.brandDeleteConfirm} "${brand.name}"?`)) return
    try {
      setBrandSaving(true)
      setBrandMessage('')
      setBrandError('')
      await api.delete(`/cars/brands/${brand.slug}/`)
      window.location.href = '/cars'
    } catch {
      setBrandError(t.pages.brandDeleteError)
      setBrandSaving(false)
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
      formData.append('brand_anecdote_en', brandAnecdoteEn)
      formData.append('brand_anecdote_pl', brandAnecdotePl)
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
      setBrandAnecdoteEn(response.data.brand_anecdote_en || '')
      setBrandAnecdotePl(response.data.brand_anecdote_pl || '')
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

  if (loading) {
    return <div className="page-loading">{t.pages.loading}</div>
  }

  if (!brand) {
    return <div className="page-card">{t.pages.brandNotFound}</div>
  }

  return (
    <div className={`brand-detail-layout ${isDarkTheme ? 'brand-detail-dark' : ''}`}>
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

        {(brand.brand_anecdote_pl || brand.brand_anecdote_en) && (
          <div className="brand-anecdote-section">
            <p className="brand-anecdote-text">
              {lang === 'pl'
                ? (brand.brand_anecdote_pl || brand.brand_anecdote_en)
                : (brand.brand_anecdote_en || brand.brand_anecdote_pl)}
            </p>
          </div>
        )}
      </section>

      {isAdmin && (
        <section className="detail-admin-card">
          <div
            className="detail-section-header detail-collapsible-header"
            style={{ marginBottom: isBrandEditorOpen ? '0.75rem' : 0 }}
          >
            <h2 className="detail-section-title">{t.pages.brandEditorTitle}</h2>
            <button
              type="button"
              className={`admin-inline-toggle admin-inline-gear ${isBrandEditorOpen ? 'is-open' : ''}`}
              onClick={() => setIsBrandEditorOpen((prev) => !prev)}
              aria-expanded={isBrandEditorOpen}
              aria-label={t.pages.brandEditorTitle}
              title={t.pages.brandEditorTitle}
            >
              <svg className="admin-inline-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.3 7.3 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.49-.42h-3.84a.5.5 0 0 0-.49.42l-.36 2.54c-.58.22-1.12.53-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.7 8.84a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.82 14.52a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96c.5.4 1.05.72 1.63.94l.36 2.54a.5.5 0 0 0 .49.42h3.84a.5.5 0 0 0 .49-.42l.36-2.54c.58-.22 1.12-.53 1.63-.94l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z" />
              </svg>
            </button>
          </div>

          {isBrandEditorOpen && (
          <form className="admin-form-card" onSubmit={handleBrandSave}>
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
                <div className="custom-file-input-wrapper">
                  <input
                    id="brand-logo-file"
                    type="file"
                    accept="image/*"
                    className="custom-file-input"
                    onChange={handleBrandLogoFileChange}
                  />
                  <label htmlFor="brand-logo-file" className="custom-file-input-label">
                    <span>{brandLogoFile?.name || t.pages.chooseFile}</span>
                  </label>
                </div>
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

              <div className="admin-form-grid-full">
                <div className="brand-description-switch-row">
                  <label className="form-label">{t.adminPanel.textLanguage}</label>
                  <div className="brand-description-switch" role="tablist" aria-label={t.adminPanel.textLanguage}>
                    <button
                      type="button"
                      className={`brand-description-switch-btn ${anecdoteEditorLang === 'en' ? 'is-active' : ''}`}
                      onClick={() => setAnecdoteEditorLang('en')}
                    >
                      EN
                    </button>
                    <button
                      type="button"
                      className={`brand-description-switch-btn ${anecdoteEditorLang === 'pl' ? 'is-active' : ''}`}
                      onClick={() => setAnecdoteEditorLang('pl')}
                    >
                      PL
                    </button>
                  </div>
                </div>

                <label className="form-label" htmlFor="brand-anecdote-language">
                  {anecdoteEditorLang === 'pl' ? t.adminPanel.brandAnecdoteEditLabel : t.adminPanel.brandAnecdoteEditLabel}
                </label>
                <textarea
                  id="brand-anecdote-language"
                  className="form-input form-textarea"
                  rows={3}
                  placeholder={t.pages.brandAnecdotePlaceholder}
                  value={anecdoteEditorLang === 'pl' ? brandAnecdotePl : brandAnecdoteEn}
                  onChange={(e) => {
                    if (anecdoteEditorLang === 'pl') {
                      setBrandAnecdotePl(e.target.value)
                    } else {
                      setBrandAnecdoteEn(e.target.value)
                    }
                  }}
                />
              </div>
            </div>

            {brandMessage && <p className="form-success" style={{ marginTop: '1.5rem' }}>{brandMessage}</p>}
            {brandError && <p className="form-error">{brandError}</p>}

            <div className="admin-actions-row">
              <button type="submit" className="btn btn-primary" disabled={brandSaving}>
                {brandSaving ? t.pages.loading : t.pages.brandSave}
              </button>
              <Link
                to={`/admin?section=create-model&brandId=${brand.id}`}
                className="btn btn-secondary"
              >
                {t.pages.addModel}
              </Link>
              <button type="button" className="btn btn-danger" disabled={brandSaving} onClick={handleDeleteBrand}>
                {t.pages.brandDelete}
              </button>
            </div>
          </form>
          )}
        </section>
      )}

      <section>
        <div className="brand-detail-top">
          <h2 className="page-title brand-section-title">{t.pages.brandLineup}</h2>
          {isAdmin && cars.length === 0 && (
            <p className="admin-meta">{t.adminPanel.ownerLabel}: admin</p>
          )}
        </div>

        {filteredCars.length === 0 ? (
          <div className="page-card brand-empty-models-card">
            <div className="brand-empty-models-content">
              <p>{t.pages.noModelsInBrand}</p>
              {isAdmin && (
                <Link to={`/admin?section=create-model&brandId=${brand.id}`} className="admin-inline-toggle admin-inline-gear" title={t.adminPanel.createModel} aria-label={t.adminPanel.createModel}>
                  <svg className="admin-inline-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.3 7.3 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.49-.42h-3.84a.5.5 0 0 0-.49.42l-.36 2.54c-.58.22-1.12.53-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.7 8.84a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.82 14.52a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96c.5.4 1.05.72 1.63.94l.36 2.54a.5.5 0 0 0 .49.42h3.84a.5.5 0 0 0 .49-.42l.36-2.54c.58-.22 1.12-.53 1.63-.94l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z" />
                  </svg>
                </Link>
              )}
            </div>
          </div>
        ) : (
          <div className="brand-lineup-model-list">
            {groupedCars.map((group) => {
              const primaryVariant = group.cars[0]
              const familyYears = group.cars
                .map((car) => car.year_introduced)
                .filter(Boolean)
                .sort((a, b) => a - b)
                .join('–')
              const totalOpinions = group.cars.reduce((sum, car) => sum + (Number(car.opinions_count) || 0), 0)
              const avgRating = group.cars.reduce((sum, car) => sum + (Number(car.avg_rating) || 0), 0) / group.cars.length

              return (
                <article
                  key={group.key}
                  className="page-card brand-lineup-model-card"
                  style={isDarkTheme ? { background: '#262c36', borderColor: '#3f4754' } : undefined}
                >
                  <div className="brand-lineup-model-card-grid">
                    <img
                      src={getCarImage(primaryVariant)}
                      alt={group.label}
                      className="brand-lineup-model-image"
                      onError={handleCarImageError}
                    />
                    <div className="brand-lineup-model-copy">
                      <h3 className="brand-lineup-model-title">
                        <Link to={buildModelFamilyPath(slug, group.label)} className="brand-lineup-group-title-link">
                          {group.label}
                        </Link>
                      </h3>
                      <p className="brand-lineup-model-meta">
                        {primaryVariant.vehicle_type || '-'}
                        {familyYears ? ` · ${familyYears}` : ''}
                      </p>
                      <p className="brand-lineup-model-meta">
                        {group.cars.length} {group.cars.length === 1 ? t.pages.modelFamilyVariantSingle : t.pages.modelFamilyVariantPlural}
                        {' · '}
                        ★ {avgRating.toFixed(1)}
                        {' · '}
                        {totalOpinions} {t.pages.reviewsLabel}
                      </p>
                    </div>
                    <Link to={buildModelFamilyPath(slug, group.label)} className="btn btn-primary brand-lineup-model-cta">
                      {t.pages.openModel}
                    </Link>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
