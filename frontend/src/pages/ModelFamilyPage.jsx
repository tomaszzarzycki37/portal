import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import api from '../services/api'
import { useTranslation } from '../i18n'
import { getBrandLogoOrPlaceholder } from '../utils/brandLogos'
import { getCarImage, handleCarImageError } from '../utils/carImages'
import { filterCarsForCatalogSearch, parseCatalogSearchParams } from '../utils/catalogSearch'
import { aggregateOpinionRatings } from '../utils/aggregateOpinionRatings'
import { buildModelFamilyPath, modelNameFromSlug } from '../utils/modelSlug'
import { formatStarDisplay, OPINION_RATING_SECTIONS } from '../constants/opinionRatings'
import StarRating from '../components/StarRating'
import { formatEngineVariantCount, formatVariantSelectLabel } from '../utils/carLabels'
import { isAdminUser } from '../utils/auth'

function stripHtml(value) {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function authorName(author, fallback) {
  const full = `${author?.first_name || ''} ${author?.last_name || ''}`.trim()
  return full || author?.username || fallback
}

function formatVariantLabel(variant, t) {
  const parts = [
    variant.year_introduced,
    variant.engine_type || t.pages.engineUnknown,
  ].filter(Boolean)
  return parts.join(' · ')
}

function extractApiErrorMessage(error, fallbackMessage) {
  const payload = error?.response?.data
  if (!payload) return fallbackMessage
  if (typeof payload === 'string') return payload
  if (typeof payload.detail === 'string' && payload.detail.trim()) return payload.detail.trim()
  return fallbackMessage
}

export default function ModelFamilyPage() {
  const { slug, modelSlug } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { t, lang } = useTranslation()
  const isAdmin = isAdminUser()

  const [brand, setBrand] = useState(null)
  const [variants, setVariants] = useState([])
  const [opinions, setOpinions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isModelNameEditorOpen, setIsModelNameEditorOpen] = useState(false)
  const [modelNameDraft, setModelNameDraft] = useState('')
  const [modelNameSaving, setModelNameSaving] = useState(false)
  const [modelNameError, setModelNameError] = useState('')

  const catalogFilters = useMemo(
    () => parseCatalogSearchParams(searchParams),
    [searchParams],
  )

  const modelName = useMemo(() => {
    const names = variants.map((variant) => variant.name)
    return modelNameFromSlug(modelSlug, names) || decodeURIComponent(String(modelSlug || '').replace(/-/g, ' '))
  }, [modelSlug, variants])

  const filteredVariants = useMemo(
    () => filterCarsForCatalogSearch(variants, catalogFilters),
    [variants, catalogFilters],
  )

  const selectedVariantId = searchParams.get('variant')
  const selectedVariant = useMemo(() => {
    if (!filteredVariants.length) return null
    if (selectedVariantId) {
      const match = filteredVariants.find((variant) => String(variant.id) === String(selectedVariantId))
      if (match) return match
    }
    return filteredVariants[0]
  }, [filteredVariants, selectedVariantId])

  const ratingSummary = useMemo(
    () => aggregateOpinionRatings(opinions),
    [opinions],
  )

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        setError('')

        const brandResponse = await api.get(`/cars/brands/${slug}/`)
        const carsResponse = await api.get(`/cars/?brand=${brandResponse.data.id}&page_size=200`)
        const carsPayload = carsResponse.data
        const carsList = Array.isArray(carsPayload)
          ? carsPayload
          : Array.isArray(carsPayload?.results)
            ? carsPayload.results
            : []

        const resolvedName = modelNameFromSlug(
          modelSlug,
          [...new Set(carsList.map((car) => car.name).filter(Boolean))],
        ) || decodeURIComponent(String(modelSlug || '').replace(/-/g, ' '))

        const familyVariants = carsList
          .filter((car) => String(car.name || '').toLowerCase() === String(resolvedName || '').toLowerCase())
          .sort((a, b) => (b.year_introduced || 0) - (a.year_introduced || 0))

        setBrand(brandResponse.data)
        setVariants(familyVariants)

        if (familyVariants.length > 0) {
          const opinionsResponse = await api.get(
            `/opinions/?brand_slug=${encodeURIComponent(slug)}&model_name=${encodeURIComponent(resolvedName)}&page_size=50&ordering=-created_at`,
          )
          const opinionsPayload = opinionsResponse.data
          setOpinions(Array.isArray(opinionsPayload) ? opinionsPayload : opinionsPayload?.results || [])
        } else {
          setOpinions([])
        }
      } catch (loadError) {
        console.error(loadError)
        setError(t.pages.modelFamilyLoadError)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [slug, modelSlug, t.pages.modelFamilyLoadError])

  const handleVariantChange = (variantId) => {
    const next = new URLSearchParams(searchParams)
    next.set('variant', String(variantId))
    setSearchParams(next, { replace: true })
  }

  const handleOpenModelNameEditor = () => {
    if (!isAdmin) return
    setModelNameDraft(modelName)
    setModelNameError('')
    setIsModelNameEditorOpen(true)
  }

  const handleCloseModelNameEditor = () => {
    setIsModelNameEditorOpen(false)
    setModelNameDraft('')
    setModelNameError('')
  }

  const handleSaveModelName = async () => {
    const trimmedName = modelNameDraft.trim()
    if (!trimmedName || variants.length === 0) return

    try {
      setModelNameSaving(true)
      setModelNameError('')

      await Promise.all(
        variants.map((variant) => api.patch(`/cars/${variant.id}/`, { name: trimmedName })),
      )

      const query = searchParams.toString()
      const nextPath = buildModelFamilyPath(slug, trimmedName, query ? `?${query}` : '')
      handleCloseModelNameEditor()
      navigate(nextPath, { replace: true })
    } catch (saveError) {
      setModelNameError(extractApiErrorMessage(saveError, t.adminInline.saveError))
    } finally {
      setModelNameSaving(false)
    }
  }

  if (loading) {
    return <div className="page-loading">{t.pages.loading}</div>
  }

  if (error || !brand) {
    return (
      <div className="page-card">
        <p>{error || t.pages.brandNotFound}</p>
        <Link to="/cars" className="btn btn-secondary">{t.pages.backToCatalog}</Link>
      </div>
    )
  }

  if (variants.length === 0) {
    return (
      <div className="page-card">
        <p>{t.pages.modelFamilyNotFound}</p>
        <Link to={`/cars/brands/${slug}`} className="btn btn-secondary">{t.pages.backToBrand}</Link>
      </div>
    )
  }

  const brandLogo = getBrandLogoOrPlaceholder(brand.logo || '', brand.name)
  const heroImage = selectedVariant ? getCarImage(selectedVariant) : getCarImage(filteredVariants[0])

  return (
    <div className="model-family-page">
      <nav className="model-family-breadcrumbs">
        <Link to="/cars">{t.pages.carsCatalog}</Link>
        <span aria-hidden="true"> / </span>
        <Link to={`/cars/brands/${slug}`}>{brand.name}</Link>
        <span aria-hidden="true"> / </span>
        <span>{modelName}</span>
      </nav>

      <section className="page-card model-family-hero">
        <div className="model-family-hero-grid">
          <img
            src={heroImage}
            alt={modelName}
            className="model-family-hero-image"
            onError={handleCarImageError}
          />
          <div className="model-family-hero-copy">
            <div className="model-family-brand-row">
              <img src={brandLogo} alt={brand.name} className="model-family-brand-logo" />
              <div>
                <p className="model-family-brand-name">{brand.name}</p>
                {isAdmin ? (
                  <h1
                    className="page-title model-family-title review-inline-editable-block"
                    role="button"
                    tabIndex={0}
                    onClick={handleOpenModelNameEditor}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        handleOpenModelNameEditor()
                      }
                    }}
                    aria-label={`${t.adminInline.quickEdit}: ${t.adminInline.modelName}`}
                    title={`${t.adminInline.quickEdit}: ${t.adminInline.modelName}`}
                  >
                    {modelName}
                  </h1>
                ) : (
                  <h1 className="page-title model-family-title">{modelName}</h1>
                )}
              </div>
            </div>
            <p className="model-family-variant-count">
              {formatEngineVariantCount(filteredVariants.length, t, lang)}
            </p>
          </div>
        </div>
      </section>

      <section className="page-card model-family-variant-picker">
        <h2 id="model-family-variant-heading" className="detail-section-title">{t.pages.modelFamilyVariantTitle}</h2>
        <p className="admin-subtitle">{t.pages.modelFamilyVariantHint}</p>

        <select
          id="model-family-variant-select"
          className="form-input model-family-variant-select"
          aria-labelledby="model-family-variant-heading"
          value={selectedVariant?.id || ''}
          onChange={(event) => handleVariantChange(event.target.value)}
        >
          {filteredVariants.map((variant) => (
            <option key={variant.id} value={variant.id}>
              {formatVariantSelectLabel(variant, t)}
            </option>
          ))}
        </select>

        {selectedVariant && (
          <div className="model-family-selected-variant">
            <div>
              <h3 className="model-family-selected-title">{formatVariantLabel(selectedVariant, t)}</h3>
              <p className="model-family-selected-description">{stripHtml(selectedVariant.description).slice(0, 220)}{(selectedVariant.description || '').length > 220 ? '…' : ''}</p>
            </div>
            <Link to={`/cars/${selectedVariant.id}`} className="btn btn-primary">
              {t.pages.modelFamilyVariantDetails}
            </Link>
          </div>
        )}
      </section>

      <section className="page-card model-family-ratings">
        <div className="model-family-section-head">
          <div>
            <h2 className="detail-section-title">{t.pages.modelFamilyRatingsTitle}</h2>
            <p className="admin-subtitle">{t.pages.modelFamilyRatingsHint}</p>
          </div>
          {ratingSummary.overall != null && (
            <div className="model-family-overall-rating">
              <span className="model-family-overall-value">{ratingSummary.overall.toFixed(1)}</span>
              <span className="model-family-overall-stars">{formatStarDisplay(ratingSummary.overall)}</span>
              <span className="model-family-overall-count">
                {ratingSummary.count} {ratingSummary.count === 1 ? t.pages.opinionSingle : t.pages.opinionPlural}
              </span>
            </div>
          )}
        </div>

        {ratingSummary.count === 0 ? (
          <p className="model-family-empty">{t.pages.modelFamilyNoRatings}</p>
        ) : (
          <div className="model-family-ratings-grid">
            {Object.entries(OPINION_RATING_SECTIONS).map(([sectionKey, keys]) => (
              <div key={sectionKey} className="model-family-rating-section">
                <h3 className="model-family-rating-section-title">
                  {t.pages.opinionRatingSections?.[sectionKey] || sectionKey}
                </h3>
                <ul className="model-family-rating-list">
                  {keys.map((key) => {
                    const value = ratingSummary.sections?.[sectionKey]?.[key]
                    if (value == null) return null
                    return (
                      <li key={key} className="model-family-rating-row">
                        <span>{t.pages.opinionRatingCategories?.[key] || key}</span>
                        <StarRating value={value} readOnly size="sm" />
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="page-card model-family-opinions">
        <h2 className="detail-section-title">{t.pages.modelFamilyLatestOpinions}</h2>
        {opinions.length === 0 ? (
          <p className="model-family-empty">{t.pages.modelFamilyNoOpinions}</p>
        ) : (
          <div className="model-family-opinion-feed">
            {opinions.map((opinion) => (
              <article key={opinion.id} className="model-family-opinion-card">
                <div className="model-family-opinion-head">
                  <div>
                    <p className="model-family-opinion-author">
                      {authorName(opinion.author, t.pages.unknownAuthor)}
                    </p>
                    <p className="model-family-opinion-variant">
                      {[opinion.car_year, opinion.car_engine_type].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <div className="model-family-opinion-rating">
                    {formatStarDisplay(opinion.rating)}
                  </div>
                </div>
                <h3 className="model-family-opinion-title">{opinion.title}</h3>
                <p className="model-family-opinion-excerpt">{stripHtml(opinion.content).slice(0, 240)}{stripHtml(opinion.content).length > 240 ? '…' : ''}</p>
                <div className="model-family-opinion-foot">
                  <span className="model-family-opinion-date">
                    {new Date(opinion.created_at).toLocaleDateString(lang === 'pl' ? 'pl-PL' : 'en-US')}
                  </span>
                  <Link to={`/opinions/${opinion.id}`} className="model-family-opinion-link">
                    {t.pages.modelFamilyReadOpinion} →
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {isAdmin && isModelNameEditorOpen && (
        <div className="review-inline-editor-backdrop" onClick={handleCloseModelNameEditor}>
          <div className="review-inline-editor-modal" onClick={(event) => event.stopPropagation()}>
            <h3 className="review-inline-editor-title">
              {t.adminInline.quickEdit}: {t.adminInline.modelName}
            </h3>
            <input
              className="form-input"
              value={modelNameDraft}
              onChange={(event) => setModelNameDraft(event.target.value)}
              aria-label={t.adminInline.modelName}
            />
            {modelNameError && <p className="form-error">{modelNameError}</p>}
            <div className="admin-actions-row">
              <button type="button" className="btn btn-secondary" onClick={handleCloseModelNameEditor}>
                {t.pages.cancelLabel}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!modelNameDraft.trim() || modelNameSaving}
                onClick={handleSaveModelName}
              >
                {modelNameSaving ? t.pages.loading : t.pages.saveLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
