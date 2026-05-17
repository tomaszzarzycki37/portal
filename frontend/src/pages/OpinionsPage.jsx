import { useEffect, useMemo, useState } from 'react'
import DOMPurify from 'dompurify'
import { Link } from 'react-router-dom'
import ReactQuill from 'react-quill'
import 'react-quill/dist/quill.snow.css'
import { useTranslation } from '../i18n'
import api from '../services/api'
import { getBrandLogoOrPlaceholder } from '../utils/brandLogos'
import { canEditByAuthorId, isAuthenticatedUser } from '../utils/auth'

const WORD_LIKE_MODULES = {
  toolbar: [
    [{ font: [] }, { size: ['small', false, 'large', 'huge'] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ color: [] }, { background: [] }],
    [{ align: [] }],
    [{ list: 'ordered' }, { list: 'bullet' }],
    [{ indent: '-1' }, { indent: '+1' }],
    ['blockquote', 'code-block'],
    ['link', 'clean'],
  ],
}

const WORD_LIKE_FORMATS = [
  'font', 'size',
  'bold', 'italic', 'underline', 'strike',
  'color', 'background',
  'align', 'list', 'bullet', 'indent',
  'blockquote', 'code-block',
  'link',
]

function sanitizeRichHtml(value) {
  return DOMPurify.sanitize(String(value || ''))
}

function getMeaningfulRichText(value) {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function RichTextEditor({ id, label, value, onChange, placeholder }) {
  return (
    <div className="admin-rich-editor admin-rich-editor-compact">
      <label className="form-label" htmlFor={id}>{label}</label>
      <ReactQuill
        id={id}
        theme="snow"
        value={value || ''}
        onChange={onChange}
        modules={WORD_LIKE_MODULES}
        formats={WORD_LIKE_FORMATS}
        placeholder={placeholder}
      />
    </div>
  )
}

function formatRatingDisplay(value) {
  const numeric = Number(value)
  const normalized = Number.isFinite(numeric) ? Math.min(5, Math.max(1, numeric)) : 5
  const rounded = Math.round(normalized)
  const stars = `${'★'.repeat(rounded)}${'☆'.repeat(5 - rounded)}`
  const numericLabel = Number.isInteger(normalized) ? String(normalized) : normalized.toFixed(1)
  return `${stars} (${numericLabel})`
}

export default function OpinionsPage() {
  const { t, lang } = useTranslation()
  const [opinions, setOpinions] = useState([])
  const [brandCatalog, setBrandCatalog] = useState([])
  const [carBrandById, setCarBrandById] = useState({})
  const [loading, setLoading] = useState(true)
  const [expandedBrands, setExpandedBrands] = useState(new Set())
  const [expandedModels, setExpandedModels] = useState(new Set())
  const [editingOpinionId, setEditingOpinionId] = useState(null)
  const [editingOpinionDraft, setEditingOpinionDraft] = useState(null)
  const [opinionActionSaving, setOpinionActionSaving] = useState(false)
  const [opinionVoteSaving, setOpinionVoteSaving] = useState({})
  const [opinionMessage, setOpinionMessage] = useState('')
  const [opinionError, setOpinionError] = useState('')

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const [opinionsResponse, brandsResponse, carsResponse] = await Promise.all([
          api.get('/opinions/?page_size=200&ordering=-created_at'),
          api.get('/cars/brands/?page_size=200'),
          api.get('/cars/?page_size=300'),
        ])

        const opinionsList = opinionsResponse.data.results || opinionsResponse.data || []
        const brandsList = brandsResponse.data.results || brandsResponse.data || []
        const carsList = carsResponse.data.results || carsResponse.data || []

        const nextCarBrandById = {}
        carsList.forEach((car) => {
          if (!car?.id) return
          nextCarBrandById[car.id] = car.brand_name || ''
        })

        setOpinions(opinionsList)
        setBrandCatalog(brandsList)
        setCarBrandById(nextCarBrandById)
      } catch (error) {
        console.error('Error fetching opinions:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const normalizedOpinions = useMemo(() => {
    return opinions.map((opinion) => {
      const fallbackBrandName = carBrandById[opinion.car_id] || ''
      const brandName = String(opinion.car_brand_name || fallbackBrandName || '').trim()
      return {
        ...opinion,
        _brandName: brandName,
      }
    })
  }, [opinions, carBrandById])

  const brandOpinionsCount = useMemo(() => {
    const counts = new Map()
    normalizedOpinions.forEach((opinion) => {
      const brandName = opinion._brandName || t.pages.unknownBrand
      counts.set(brandName, (counts.get(brandName) || 0) + 1)
    })
    return counts
  }, [normalizedOpinions, t.pages.unknownBrand])

  const brandSections = useMemo(() => {
    const logoByBrandName = new Map()
    brandCatalog.forEach((brand) => {
      logoByBrandName.set(String(brand.name || '').trim(), brand.logo || '')
    })

    return Array.from(brandOpinionsCount.entries())
      .map(([brandName, count]) => ({
        brandName,
        count,
        logo: logoByBrandName.get(brandName) || '',
      }))
      .sort((a, b) => a.brandName.localeCompare(b.brandName))
  }, [brandCatalog, brandOpinionsCount])

  const logoByBrandName = useMemo(() => {
    const map = new Map()
    brandCatalog.forEach((brand) => {
      map.set(String(brand.name || '').trim(), brand.logo || '')
    })
    return map
  }, [brandCatalog])

  const groupedByBrandAndModel = useMemo(() => {
    const brandMap = new Map()

    normalizedOpinions.forEach((opinion) => {
      const brandName = opinion._brandName || t.pages.unknownBrand
      const modelName = opinion.car_name || '-'
      const modelId = opinion.car_id || `no-id-${modelName}`

      if (!brandMap.has(brandName)) {
        brandMap.set(brandName, new Map())
      }

      const modelMap = brandMap.get(brandName)
      if (!modelMap.has(modelId)) {
        modelMap.set(modelId, { modelName, modelId, opinions: [] })
      }

      modelMap.get(modelId).opinions.push(opinion)
    })

    return Array.from(brandMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([brandName, modelMap]) => ({
        brandName,
        models: Array.from(modelMap.values()).sort((a, b) => a.modelName.localeCompare(b.modelName)),
      }))
  }, [normalizedOpinions, t.pages.unknownBrand])

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString(lang === 'pl' ? 'pl-PL' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const toggleBrand = (brandName) => {
    setExpandedBrands((prev) => {
      const next = new Set(prev)
      if (next.has(brandName)) next.delete(brandName)
      else next.add(brandName)
      return next
    })
  }

  const toggleModel = (key) => {
    setExpandedModels((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const reloadOpinions = async () => {
    const opinionsResponse = await api.get('/opinions/?page_size=200&ordering=-created_at')
    const opinionsList = opinionsResponse.data.results || opinionsResponse.data || []
    setOpinions(opinionsList)
  }

  const handleStartEditOpinion = (opinion) => {
    setEditingOpinionId(opinion.id)
    setEditingOpinionDraft({
      title: opinion.title || '',
      content: opinion.content || '',
      rating: String(opinion.rating || 5),
      car_model: String(opinion.car_id || ''),
    })
    setOpinionMessage('')
    setOpinionError('')
  }

  const handleSaveOpinion = async (opinionId) => {
    if (!editingOpinionDraft) return
    const ratingValue = Number.parseInt(String(editingOpinionDraft.rating || '').trim(), 10)
    const normalizedContent = String(editingOpinionDraft.content || '').trim()
    if (!editingOpinionDraft.title.trim() || !getMeaningfulRichText(normalizedContent) || !editingOpinionDraft.car_model || Number.isNaN(ratingValue) || ratingValue < 1 || ratingValue > 5) {
      setOpinionError(t.pages.opinionCreateValidation)
      return
    }

    try {
      setOpinionActionSaving(true)
      setOpinionError('')
      setOpinionMessage('')
      await api.patch(`/opinions/${opinionId}/`, {
        car_model: Number.parseInt(editingOpinionDraft.car_model, 10),
        title: editingOpinionDraft.title.trim(),
        content: normalizedContent,
        rating: ratingValue,
      })
      await reloadOpinions()
      setEditingOpinionId(null)
      setEditingOpinionDraft(null)
      setOpinionMessage(t.pages.opinionUpdated)
    } catch {
      setOpinionError(t.pages.opinionUpdateError)
    } finally {
      setOpinionActionSaving(false)
    }
  }

  const handleDeleteOpinion = async (opinionId) => {
    if (!window.confirm(t.pages.opinionDeleteConfirm)) return
    try {
      setOpinionActionSaving(true)
      setOpinionError('')
      setOpinionMessage('')
      await api.delete(`/opinions/${opinionId}/`)
      await reloadOpinions()
      if (editingOpinionId === opinionId) {
        setEditingOpinionId(null)
        setEditingOpinionDraft(null)
      }
      setOpinionMessage(t.pages.opinionDeleted)
    } catch {
      setOpinionError(t.pages.opinionDeleteError)
    } finally {
      setOpinionActionSaving(false)
    }
  }

  const handleVoteOpinion = async (opinionId, voteType) => {
    if (!['helpful', 'unhelpful'].includes(voteType)) return
    if (!isAuthenticatedUser()) {
      setOpinionError(t.pages.loginToContribute)
      return
    }

    try {
      setOpinionVoteSaving((prev) => ({ ...prev, [opinionId]: true }))
      setOpinionError('')
      setOpinionMessage('')
      await api.post(`/opinions/${opinionId}/vote/`, { vote_type: voteType })
      await reloadOpinions()
    } catch {
      setOpinionError(t.pages.opinionUpdateError)
    } finally {
      setOpinionVoteSaving((prev) => ({ ...prev, [opinionId]: false }))
    }
  }

  const opinionRatingCategories = [
    { key: 'rating_quality', label: t.pages.ratingQuality },
    { key: 'rating_workmanship', label: t.pages.ratingWorkmanship },
    { key: 'rating_economy', label: t.pages.ratingEconomy },
    { key: 'rating_safety', label: t.pages.ratingSafety },
    { key: 'rating_comfort', label: t.pages.ratingComfort },
    { key: 'rating_performance', label: t.pages.ratingPerformance },
    { key: 'rating_design', label: t.pages.ratingDesign },
    { key: 'rating_reliability', label: t.pages.ratingReliability },
  ]

  return (
    <div className="opinions-page-wrap">
      <h1 className="page-title">{t.nav.opinions}</h1>
      <p className="admin-subtitle">{t.pages.opinionsCatalogIntro}</p>
      {opinionMessage && <p className="form-success">{opinionMessage}</p>}
      {opinionError && <p className="form-error">{opinionError}</p>}

      {loading ? (
        <div className="page-loading">{t.pages.loading}</div>
      ) : groupedByBrandAndModel.length === 0 ? (
        <div className="page-card">{t.pages.noOpinionsInCatalog}</div>
      ) : (
        <div className="brand-catalog-list">
          <p className="admin-subtitle" style={{ marginBottom: '0.5rem' }}>
            {t.pages.allOpinionsLabel}: {normalizedOpinions.length}
          </p>

          {groupedByBrandAndModel.map((brandGroup) => {
            const logo = getBrandLogoOrPlaceholder(logoByBrandName.get(brandGroup.brandName) || '', brandGroup.brandName)
            const brandOpinionCount = brandGroup.models.reduce((acc, m) => acc + m.opinions.length, 0)
            const isBrandExpanded = expandedBrands.has(brandGroup.brandName)

            return (
              <section key={brandGroup.brandName} className="brand-catalog-card">
                <button type="button" className="brand-catalog-header" onClick={() => toggleBrand(brandGroup.brandName)}>
                  <div className="brand-catalog-identity">
                    <img src={logo} alt={brandGroup.brandName} className="brand-catalog-logo" />
                    <div>
                      <div className="brand-catalog-title-row">
                        <h2 className="brand-catalog-title">{brandGroup.brandName}</h2>
                        <span className="brand-catalog-badge">{brandOpinionCount} {brandOpinionCount === 1 ? t.pages.opinionSingle : t.pages.opinionPlural}</span>
                      </div>
                    </div>
                  </div>
                  <div className="brand-catalog-actions">
                    <span className="brand-catalog-toggle" style={{ fontSize: '0.85rem', padding: '0.3rem 0.6rem' }}>{isBrandExpanded ? '▲' : '▼'}</span>
                  </div>
                </button>

                {isBrandExpanded && (
                  <div style={{ padding: '0 1rem 1rem' }}>
                    {brandGroup.models.map((modelGroup) => {
                      const modelKey = `${brandGroup.brandName}::${modelGroup.modelId}`
                      const isModelExpanded = expandedModels.has(modelKey)

                      return (
                        <div key={modelKey} className="brand-catalog-card" style={{ margin: '0 0 0.75rem', boxShadow: 'none', background: '#f8fafc' }}>
                          <button
                            type="button"
                            className="brand-catalog-header"
                            style={{ padding: '0.65rem 0.9rem' }}
                            onClick={() => toggleModel(modelKey)}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                              <span className="brand-catalog-title" style={{ fontSize: '1rem' }}>{modelGroup.modelName}</span>
                              <span className="brand-catalog-badge" style={{ fontSize: '0.75rem' }}>{modelGroup.opinions.length} {modelGroup.opinions.length === 1 ? t.pages.opinionSingle : t.pages.opinionPlural}</span>
                            </div>
                            <span className="brand-catalog-toggle" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}>{isModelExpanded ? '▲' : '▼'}</span>
                          </button>

                          {isModelExpanded && (
                            <div style={{ padding: '0 0.9rem 0.9rem' }}>
                              <div className="opinions-list">
                                {modelGroup.opinions.map((opinion) => (
                                  <article key={opinion.id} className="opinion-list-item">
                                    {editingOpinionId === opinion.id && editingOpinionDraft ? (
                                      <div className="admin-form-card" style={{ marginBottom: '0.5rem' }}>
                                        <label className="form-label">{t.pages.opinionTitle}</label>
                                        <input
                                          className="form-input"
                                          value={editingOpinionDraft.title}
                                          onChange={(e) => setEditingOpinionDraft((prev) => ({ ...prev, title: e.target.value }))}
                                        />
                                        <RichTextEditor
                                          id={`opinion-content-${opinion.id}`}
                                          label={t.adminPanel.description}
                                          value={editingOpinionDraft.content}
                                          onChange={(nextValue) => setEditingOpinionDraft((prev) => ({ ...prev, content: nextValue }))}
                                          placeholder={t.adminPanel.reviewEditorPlaceholder}
                                        />
                                        <label className="form-label">{t.pages.averageRating}</label>
                                        <select
                                          className="form-input"
                                          value={editingOpinionDraft.rating}
                                          onChange={(e) => setEditingOpinionDraft((prev) => ({ ...prev, rating: e.target.value }))}
                                        >
                                          <option value={5}>5</option>
                                          <option value={4}>4</option>
                                          <option value={3}>3</option>
                                          <option value={2}>2</option>
                                          <option value={1}>1</option>
                                        </select>
                                        <div className="admin-actions-row">
                                          <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setEditingOpinionId(null); setEditingOpinionDraft(null) }}>
                                            {t.pages.cancelLabel}
                                          </button>
                                          <button type="button" className="btn btn-primary btn-sm" disabled={opinionActionSaving} onClick={() => handleSaveOpinion(opinion.id)}>
                                            {opinionActionSaving ? t.pages.loading : t.pages.saveLabel}
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <>
                                        <div className="opinion-list-header">
                                          <h4 className="opinion-title">{opinion.title}</h4>
                                          <span className="opinion-rating">{formatRatingDisplay(opinion.rating)}</span>
                                        </div>
                                        <div className="opinion-list-meta">
                                          <span className="opinion-author">{opinion.author?.username || t.pages.unknownAuthor}</span>
                                          <span className="opinion-date">{formatDate(opinion.created_at)}</span>
                                        </div>
                                        <div
                                          className="opinion-content"
                                          dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(opinion.content) }}
                                        />
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                                          {opinionRatingCategories.map((category) => (
                                            <div key={category.key} className="opinion-category-rating">
                                              <span style={{ fontSize: '0.85rem', color: '#666' }}>{category.label}</span>
                                              <span className="rating" style={{ fontSize: '0.95rem' }}>{formatRatingDisplay(opinion[category.key])}</span>
                                            </div>
                                          ))}
                                        </div>
                                        <div className="opinion-list-footer">
                                          <div className="opinion-votes" role="group" aria-label="Opinion votes">
                                            <button
                                              type="button"
                                              className="opinion-vote-btn"
                                              disabled={!!opinionVoteSaving[opinion.id]}
                                              onClick={() => handleVoteOpinion(opinion.id, 'helpful')}
                                              title="Helpful"
                                            >
                                              👍 {opinion.helpful_count}
                                            </button>
                                            <span className="opinion-vote-separator">|</span>
                                            <button
                                              type="button"
                                              className="opinion-vote-btn"
                                              disabled={!!opinionVoteSaving[opinion.id]}
                                              onClick={() => handleVoteOpinion(opinion.id, 'unhelpful')}
                                              title="Unhelpful"
                                            >
                                              👎 {opinion.unhelpful_count}
                                            </button>
                                          </div>
                                          {opinion.car_id && (
                                            <Link to={`/cars/${opinion.car_id}`} className="opinion-view-car">
                                              {t.pages.viewCar}
                                            </Link>
                                          )}
                                        </div>
                                      </>
                                    )}
                                    {canEditByAuthorId(opinion.author?.id) && editingOpinionId !== opinion.id && (
                                      <div className="admin-actions-row" style={{ marginTop: '0.35rem' }}>
                                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleStartEditOpinion(opinion)}>
                                          {t.pages.editLabel}
                                        </button>
                                        <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDeleteOpinion(opinion.id)}>
                                          {t.pages.deleteLabel}
                                        </button>
                                      </div>
                                    )}
                                  </article>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
