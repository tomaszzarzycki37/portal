import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import api from '../services/api'
import { useTranslation } from '../i18n'
import { getBrandLogoOrPlaceholder } from '../utils/brandLogos'
import { getCarImage, handleCarImageError } from '../utils/carImages'
import { filterCarsForCatalogSearch, parseCatalogSearchParams } from '../utils/catalogSearch'
import { aggregateOpinionRatings } from '../utils/aggregateOpinionRatings'
import { modelNameFromSlug } from '../utils/modelSlug'
import { formatStarDisplay, OPINION_RATING_SECTIONS } from '../constants/opinionRatings'
import StarRating from '../components/StarRating'

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

export default function ModelFamilyPage() {
  const { slug, modelSlug } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const { t, lang } = useTranslation()

  const [brand, setBrand] = useState(null)
  const [variants, setVariants] = useState([])
  const [opinions, setOpinions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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
                <h1 className="page-title model-family-title">{modelName}</h1>
              </div>
            </div>
            <p className="model-family-variant-count">
              {filteredVariants.length} {filteredVariants.length === 1 ? t.pages.modelFamilyVariantSingle : t.pages.modelFamilyVariantPlural}
            </p>
          </div>
        </div>
      </section>

      <section className="page-card model-family-variant-picker">
        <h2 className="detail-section-title">{t.pages.modelFamilyVariantTitle}</h2>
        <p className="admin-subtitle">{t.pages.modelFamilyVariantHint}</p>

        <label className="form-label" htmlFor="model-family-variant-select">{t.pages.modelFamilyVariantTitle}</label>
        <select
          id="model-family-variant-select"
          className="form-input model-family-variant-select"
          value={selectedVariant?.id || ''}
          onChange={(event) => handleVariantChange(event.target.value)}
        >
          {filteredVariants.map((variant) => (
            <option key={variant.id} value={variant.id}>
              {variant.year_introduced} · {variant.engine_type || t.pages.engineUnknown} · {variant.vehicle_type} · {variant.production_status}
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
    </div>
  )
}
