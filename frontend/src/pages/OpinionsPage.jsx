import { useEffect, useMemo, useState } from 'react'
import DOMPurify from 'dompurify'
import { Link } from 'react-router-dom'
import ReactQuill from 'react-quill'
import 'react-quill/dist/quill.snow.css'
import { useTranslation } from '../i18n'
import api from '../services/api'
import { getBrandLogoOrPlaceholder } from '../utils/brandLogos'
import { getCarImage, handleCarImageError } from '../utils/carImages'
import { canEditByAuthorId } from '../utils/auth'
import { useAuthSession } from '../hooks/useAuthSession'
import DetailedOpinionCard from '../components/DetailedOpinionCard'
import DetailedOpinionForm from '../components/DetailedOpinionForm'
import {
  buildEmptyDetailedRatings,
  buildOpinionDraftFromApi,
  buildOpinionPayload,
  validateOpinionDraft,
} from '../constants/opinionRatings'

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

function createEmptyOpinionDraft() {
  return {
    car_model: '',
    title: '',
    content: '',
    detailed_ratings: buildEmptyDetailedRatings(),
    fuel_consumption_min: '',
    fuel_consumption_max: '',
  }
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
  const [topOpinions, setTopOpinions] = useState([])
  const [brandCatalog, setBrandCatalog] = useState([])
  const [carBrandById, setCarBrandById] = useState({})
  const [carsById, setCarsById] = useState({})
  const [loading, setLoading] = useState(true)
  const [expandedBrands, setExpandedBrands] = useState(new Set())
  const [expandedModels, setExpandedModels] = useState(new Set())
  const [editingOpinionId, setEditingOpinionId] = useState(null)
  const [editingOpinionDraft, setEditingOpinionDraft] = useState(null)
  const [opinionActionSaving, setOpinionActionSaving] = useState(false)
  const [opinionVoteSaving, setOpinionVoteSaving] = useState({})
  const [expandedOpinions, setExpandedOpinions] = useState(new Set())
  const [opinionComments, setOpinionComments] = useState({})
  const [commentTexts, setCommentTexts] = useState({})
  const [commentSaving, setCommentSaving] = useState({})
  const [opinionMessage, setOpinionMessage] = useState('')
  const [opinionError, setOpinionError] = useState('')
  const [isCreateOpinionOpen, setIsCreateOpinionOpen] = useState(false)
  const [newOpinionDraft, setNewOpinionDraft] = useState(createEmptyOpinionDraft)
  const [createOpinionSaving, setCreateOpinionSaving] = useState(false)
  const { isLoggedIn, canContribute } = useAuthSession()

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const [opinionsResponse, brandsResponse, carsResponse, topOpinionsResponse] = await Promise.all([
          api.get('/opinions/?page_size=200&ordering=-created_at'),
          api.get('/cars/brands/?ordering=name&page_size=200'),
          api.get('/cars/?page_size=300'),
          api.get('/opinions/top_rated/'),
        ])

        const opinionsList = opinionsResponse.data.results || opinionsResponse.data || []
        const topOpinionsList = topOpinionsResponse.data.results || topOpinionsResponse.data || []
        const brandsList = brandsResponse.data.results || brandsResponse.data || []
        const carsList = carsResponse.data.results || carsResponse.data || []

        const nextCarBrandById = {}
        const nextCarsById = {}
        carsList.forEach((car) => {
          if (!car?.id) return
          nextCarsById[car.id] = car
          nextCarBrandById[car.id] = car.brand_name || ''
        })

        setOpinions(opinionsList)
        setTopOpinions(topOpinionsList)
        setBrandCatalog(brandsList)
        setCarBrandById(nextCarBrandById)
        setCarsById(nextCarsById)
      } catch (error) {
        console.error('Error fetching opinions:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const normalizedTopOpinions = useMemo(() => {
    return topOpinions.map((opinion) => {
      const fallbackBrandName = carBrandById[opinion.car_id] || ''
      const brandName = String(opinion.car_brand_name || fallbackBrandName || '').trim()
      return {
        ...opinion,
        _brandName: brandName,
      }
    })
  }, [topOpinions, carBrandById])

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
    const [opinionsResponse, topOpinionsResponse] = await Promise.all([
      api.get('/opinions/?page_size=200&ordering=-created_at'),
      api.get('/opinions/top_rated/'),
    ])
    const opinionsList = opinionsResponse.data.results || opinionsResponse.data || []
    const topOpinionsList = topOpinionsResponse.data.results || topOpinionsResponse.data || []
    setOpinions(opinionsList)
    setTopOpinions(topOpinionsList)
  }

  const handleCreateOpinion = async (e) => {
    e.preventDefault()
    if (!canContribute) return

    if (!validateOpinionDraft(newOpinionDraft, { requireCarModel: true })) {
      setOpinionMessage('')
      setOpinionError(t.pages.opinionCreateValidation)
      return
    }

    try {
      setCreateOpinionSaving(true)
      setOpinionMessage('')
      setOpinionError('')
      await api.post('/opinions/', buildOpinionPayload(newOpinionDraft))
      setNewOpinionDraft(createEmptyOpinionDraft())
      setIsCreateOpinionOpen(false)
      await reloadOpinions()
      setOpinionMessage(t.pages.opinionCreated)
    } catch {
      setOpinionError(t.pages.opinionCreateError)
    } finally {
      setCreateOpinionSaving(false)
    }
  }

  const handleToggleComments = async (opinionId) => {
    setExpandedOpinions((prev) => {
      const next = new Set(prev)
      if (next.has(opinionId)) {
        next.delete(opinionId)
      } else {
        next.add(opinionId)
      }
      return next
    })

    if (!opinionComments[opinionId]) {
      try {
        const res = await api.get(`/opinions/${opinionId}/`)
        setOpinionComments((prev) => ({ ...prev, [opinionId]: res.data.comments || [] }))
      } catch {
        setOpinionComments((prev) => ({ ...prev, [opinionId]: [] }))
      }
    }
  }

  const handleAddComment = async (opinionId) => {
    const text = (commentTexts[opinionId] || '').trim()
    if (!text) return

    setCommentSaving((prev) => ({ ...prev, [opinionId]: true }))
    try {
      await api.post(`/opinions/${opinionId}/add_comment/`, { content: text })
      const res = await api.get(`/opinions/${opinionId}/`)
      setOpinionComments((prev) => ({ ...prev, [opinionId]: res.data.comments || [] }))
      setCommentTexts((prev) => ({ ...prev, [opinionId]: '' }))
      await reloadOpinions()
    } catch {
      setOpinionError(t.pages.opinionUpdateError)
    } finally {
      setCommentSaving((prev) => ({ ...prev, [opinionId]: false }))
    }
  }

  const handleStartEditOpinion = (opinion) => {
    setEditingOpinionId(opinion.id)
    setEditingOpinionDraft(buildOpinionDraftFromApi(opinion))
    setOpinionMessage('')
    setOpinionError('')
  }

  const handleSaveOpinion = async (opinionId) => {
    if (!editingOpinionDraft) return
    if (!validateOpinionDraft(editingOpinionDraft, { requireCarModel: true })) {
      setOpinionError(t.pages.opinionCreateValidation)
      return
    }

    try {
      setOpinionActionSaving(true)
      setOpinionError('')
      setOpinionMessage('')
      await api.patch(`/opinions/${opinionId}/`, buildOpinionPayload(editingOpinionDraft))
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
    if (!canContribute) {
      setOpinionError(isLoggedIn ? t.pages.pendingApproval : t.pages.loginToContribute)
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

  const allCars = useMemo(() => Object.values(carsById), [carsById])

  return (
    <div className="opinions-page-wrap">
      <h1 className="page-title">{t.nav.opinions}</h1>
      <p className="admin-subtitle">{t.pages.opinionsCatalogIntro}</p>
      {opinionMessage && <p className="form-success">{opinionMessage}</p>}
      {opinionError && <p className="form-error">{opinionError}</p>}

      {canContribute ? (
        <section className="admin-form-card" style={{ marginTop: '1.25rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: isCreateOpinionOpen ? '0.75rem' : 0 }}>
            <h2 className="admin-section-heading" style={{ margin: 0 }}>{t.pages.addOpinionTitle}</h2>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setIsCreateOpinionOpen((prev) => !prev)}
              aria-expanded={isCreateOpinionOpen}
            >
              {isCreateOpinionOpen ? t.pages.cancelLabel : t.pages.addOpinionSubmit}
            </button>
          </div>
          {isCreateOpinionOpen && (
            <form onSubmit={handleCreateOpinion}>
              <DetailedOpinionForm
                draft={newOpinionDraft}
                onChange={setNewOpinionDraft}
                t={t}
                RichTextEditorComponent={RichTextEditor}
                showCarSelect
                cars={allCars}
              />
              <button type="submit" className="btn btn-primary" disabled={createOpinionSaving}>
                {createOpinionSaving ? t.pages.loading : t.pages.addOpinionSubmit}
              </button>
            </form>
          )}
        </section>
      ) : (
        <div style={{ marginTop: '1.25rem', marginBottom: '1rem' }}>
          <p className="admin-subtitle">{isLoggedIn ? t.pages.pendingApproval : t.pages.loginToContribute}</p>
          {isLoggedIn && <p className="admin-meta">{t.pages.pendingApprovalHint}</p>}
        </div>
      )}

      {loading ? (
        <div className="page-loading">{t.pages.loading}</div>
      ) : groupedByBrandAndModel.length === 0 ? (
        <div className="page-card">{t.pages.noOpinionsInCatalog}</div>
      ) : (
        <>
          {normalizedTopOpinions.length > 0 && (
            <section className="opinions-top-section">
              <h2 className="opinions-section-heading">{t.pages.topOpinionsTitle}</h2>
              <p className="admin-subtitle">{t.pages.topOpinionsHint}</p>
              <div className="opinions-top-grid">
                {normalizedTopOpinions.map((opinion, index) => (
                  <article key={opinion.id} className="opinion-top-card">
                    <span className="opinion-top-rank">{index + 1}</span>
                    <img
                      src={getCarImage(carsById[opinion.car_id] || { name: opinion.car_name, brand_name: opinion.car_brand_name })}
                      alt={`${opinion._brandName || ''} ${opinion.car_name || ''}`.trim() || 'Car model'}
                      className="opinion-top-image"
                      loading="lazy"
                      onError={handleCarImageError}
                    />
                    <h3 className="opinion-top-title">
                      <Link to={`/opinions/${opinion.id}`}>{opinion.title}</Link>
                    </h3>
                    <div className="opinion-top-footer">
                      <div className="opinion-top-meta">
                        <span>{opinion._brandName || t.pages.unknownBrand}</span>
                        <span>{opinion.car_name || '-'}</span>
                        <span>{formatDate(opinion.created_at)}</span>
                      </div>
                      <div className="opinion-top-stats">
                        <span className="opinion-rating">{formatRatingDisplay(opinion.rating)}</span>
                        <span className="opinion-meta">👍 {opinion.helpful_count || 0}</span>
                      </div>
                      <Link to={`/opinions/${opinion.id}`} className="opinion-top-read-link">
                        {t.pages.readMore} →
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          <section className="opinions-all-section">
            <h2 className="opinions-section-heading">{t.pages.allOpinionsSectionTitle}</h2>
            <p className="admin-subtitle" style={{ marginBottom: '0.5rem' }}>
              {t.pages.allOpinionsLabel}: {normalizedOpinions.length}
            </p>

            <div className="brand-catalog-list">
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
                                    <div className="opinion-model-image-wrap">
                                      <img
                                        src={getCarImage(carsById[opinion.car_id] || { name: opinion.car_name, brand_name: opinion.car_brand_name })}
                                        alt={`${opinion.car_brand_name || ''} ${opinion.car_name || ''}`.trim() || 'Car model'}
                                        className="opinion-model-image"
                                        loading="lazy"
                                        onError={handleCarImageError}
                                      />
                                    </div>
                                    {editingOpinionId === opinion.id && editingOpinionDraft ? (
                                      <div className="admin-form-card" style={{ marginBottom: '0.5rem' }}>
                                        <DetailedOpinionForm
                                          draft={editingOpinionDraft}
                                          onChange={setEditingOpinionDraft}
                                          t={t}
                                          RichTextEditorComponent={RichTextEditor}
                                          showCarSelect
                                          cars={allCars}
                                        />
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
                                          <h4 className="opinion-title">
                                            <Link to={`/opinions/${opinion.id}`}>{opinion.title}</Link>
                                          </h4>
                                          <span className="opinion-date">{formatDate(opinion.created_at)}</span>
                                        </div>
                                        <DetailedOpinionCard
                                          opinion={{
                                            ...opinion,
                                            content: sanitizeRichHtml(opinion.content),
                                          }}
                                          t={t}
                                        />
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
                                          <div className="opinion-footer-actions">
                                            <button
                                              type="button"
                                              className="btn-comment-toggle"
                                              onClick={() => handleToggleComments(opinion.id)}
                                            >
                                              {expandedOpinions.has(opinion.id) ? '−' : '+'} {opinion.comments_count || 0} {t.pages.showComments}
                                            </button>
                                            {opinion.car_id && (
                                              <Link to={`/cars/${opinion.car_id}`} className="opinion-view-car">
                                                {t.pages.viewCar}
                                              </Link>
                                            )}
                                            {canEditByAuthorId(opinion.author?.id) && editingOpinionId !== opinion.id && (
                                              <>
                                                <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleStartEditOpinion(opinion)}>
                                                  {t.pages.editLabel}
                                                </button>
                                                <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDeleteOpinion(opinion.id)}>
                                                  {t.pages.deleteLabel}
                                                </button>
                                              </>
                                            )}
                                          </div>
                                        </div>
                                        {expandedOpinions.has(opinion.id) && (
                                          <div className="opinion-comments">
                                            {(opinionComments[opinion.id] || []).length === 0 ? (
                                              <p className="opinion-no-comments">{t.pages.noComments}</p>
                                            ) : (
                                              (opinionComments[opinion.id] || []).map((c) => (
                                                <div key={c.id} className="comment-item">
                                                  <span className="comment-author">{c.author?.username}</span>
                                                  <span className="comment-text">{c.content}</span>
                                                </div>
                                              ))
                                            )}
                                            <div className="comment-add-row">
                                              {canContribute ? (
                                                <>
                                                  <input
                                                    className="form-input comment-input"
                                                    placeholder={t.pages.commentPlaceholder}
                                                    value={commentTexts[opinion.id] || ''}
                                                    onChange={(e) =>
                                                      setCommentTexts((prev) => ({ ...prev, [opinion.id]: e.target.value }))
                                                    }
                                                    onKeyDown={(e) => {
                                                      if (e.key === 'Enter') handleAddComment(opinion.id)
                                                    }}
                                                  />
                                                  <button
                                                    type="button"
                                                    className="btn btn-primary btn-sm"
                                                    disabled={commentSaving[opinion.id]}
                                                    onClick={() => handleAddComment(opinion.id)}
                                                  >
                                                    {t.pages.commentSubmit}
                                                  </button>
                                                </>
                                              ) : (
                                                <p className="admin-meta">{isLoggedIn ? t.pages.pendingApproval : t.pages.loginToContribute}</p>
                                              )}
                                            </div>
                                          </div>
                                        )}
                                      </>
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
          </section>
        </>
      )}
    </div>
  )
}
