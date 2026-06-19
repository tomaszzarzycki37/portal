import { useEffect, useMemo, useRef, useState } from 'react'
import DOMPurify from 'dompurify'
import { Link } from 'react-router-dom'
import { useLocation } from 'react-router-dom'
import ReactQuill from 'react-quill'
import 'react-quill/dist/quill.snow.css'
import { useTranslation } from '../i18n'
import api from '../services/api'
import { canEditByAuthorId, getCurrentUser, isAuthenticatedUser } from '../utils/auth'
import { getReviewCategoryLabel } from '../utils/reviewCategory'

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

const INLINE_REVIEW_EDIT_FIELDS = new Set(['title', 'summary', 'content', 'publication_name', 'author_name', 'tags', 'overview', 'testResults', 'verdict', 'images', 'secondImages', 'car_model', 'category'])
const IMAGE_LIMITS = {
  images: 12,
}
const TEST_RESULT_FIELDS = [
  {
    key: '0-100 km/h (measured)',
    unit: 's',
    labels: { en: '0-100 km/h (measured)', pl: '0-100 km/h (pomiar)' },
    aliases: ['0-100 km/h (measured)'],
  },
  {
    key: '100-0 km/h braking distance',
    unit: 'm',
    labels: { en: '100-0 km/h braking distance', pl: 'Droga hamowania 100-0 km/h' },
    aliases: ['100-0 km/h braking distance'],
  },
  {
    key: 'Real-world mixed consumption',
    unit: 'kWh/100 km',
    labels: { en: 'Real-world mixed consumption', pl: 'Realne zuzycie mieszane' },
    aliases: ['Real-world mixed consumption', 'Real-world motorway consumption (130 km/h)'],
  },
  {
    key: 'Real-world range (mixed)',
    unit: 'km',
    labels: { en: 'Real-world range (mixed)', pl: 'Realny zasieg (mieszany)' },
    aliases: ['Real-world range (mixed)'],
  },
  {
    key: 'DC charging 10-80%',
    unit: 'min',
    labels: { en: 'DC charging 10-80%', pl: 'Ladowanie DC 10-80%' },
    aliases: ['DC charging 10-80%', 'DC charging 20-80%'],
  },
]

function normalizeTestKey(value) {
  return String(value || '').trim().toLowerCase()
}

function getTestFieldByKey(key) {
  const normalized = normalizeTestKey(key)
  return TEST_RESULT_FIELDS.find((field) =>
    field.aliases.some((alias) => normalizeTestKey(alias) === normalized)
    || normalizeTestKey(field.key) === normalized,
  ) || null
}

function stripKnownUnit(value, unit) {
  const current = String(value || '').trim()
  if (!current || !unit) return current
  if (current.toLowerCase().endsWith(` ${unit.toLowerCase()}`)) {
    return current.slice(0, -(unit.length + 1)).trim()
  }
  if (current.toLowerCase() === unit.toLowerCase()) {
    return ''
  }
  return current
}

function appendUnit(value, unit) {
  const base = String(value || '').trim()
  if (!base) return ''
  if (!unit) return base
  if (base.toLowerCase().endsWith(` ${unit.toLowerCase()}`) || base.toLowerCase() === unit.toLowerCase()) {
    return base
  }
  return `${base} ${unit}`
}

function getTestLabel(key, lang) {
  const field = getTestFieldByKey(key)
  if (!field) return key
  return field.labels[lang] || field.labels.en || key
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

function ImageSlider({ images, title, emptyLabel, onEdit, isEditable, className = 'review-gallery' }) {
  const [activeIndex, setActiveIndex] = useState(0)
  const hasImages = images.length > 0

  useEffect(() => {
    if (activeIndex >= images.length) {
      setActiveIndex(0)
    }
  }, [images.length, activeIndex])

  const handlePrev = (event) => {
    event.stopPropagation()
    if (!hasImages) return
    setActiveIndex((prev) => (prev - 1 + images.length) % images.length)
  }

  const handleNext = (event) => {
    event.stopPropagation()
    if (!hasImages) return
    setActiveIndex((prev) => (prev + 1) % images.length)
  }

  const handleThumbClick = (event, index) => {
    event.stopPropagation()
    setActiveIndex(index)
  }

  return (
    <div
      className={`${className} ${isEditable ? 'review-inline-editable-block' : ''}`}
      role={isEditable ? 'button' : undefined}
      tabIndex={isEditable ? 0 : undefined}
      onClick={isEditable ? onEdit : undefined}
      onKeyDown={isEditable ? (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onEdit()
        }
      } : undefined}
      aria-label={title}
    >
      {hasImages ? (
        <>
          <div className="review-slider-main-wrapper">
            <img
              src={images[activeIndex]}
              alt={`${title} ${activeIndex + 1}`}
              className="review-gallery-main"
              loading="lazy"
            />
            {images.length > 1 && (
              <>
                <button type="button" className="review-slider-nav review-slider-nav-prev" onClick={handlePrev} aria-label="Poprzednie zdjęcie">‹</button>
                <button type="button" className="review-slider-nav review-slider-nav-next" onClick={handleNext} aria-label="Następne zdjęcie">›</button>
              </>
            )}
          </div>
          {images.length > 1 && (
            <div className="review-gallery-thumbs">
              {images.map((img, i) => (
                <button
                  key={`${img}-${i}`}
                  type="button"
                  className={`review-slider-thumb-btn ${i === activeIndex ? 'is-active' : ''}`}
                  onClick={(event) => handleThumbClick(event, i)}
                  aria-label={`Przejdz do zdjęcia ${i + 1}`}
                >
                  <img
                    src={img}
                    alt={`${title} miniatura ${i + 1}`}
                    className="review-gallery-thumb"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="review-gallery-empty">{emptyLabel}</div>
      )}
    </div>
  )
}

function decodeHtmlEntities(value) {
  if (!value) return ''
  const textarea = document.createElement('textarea')
  textarea.innerHTML = String(value)
  return textarea.value
}

function sanitizeEditorialHtml(value) {
  return DOMPurify.sanitize(decodeHtmlEntities(value))
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function formatEditorialText(value) {
  let html = escapeHtml(value)

  html = html.replace(/\[size=(sm|md|lg)\]([\s\S]*?)\[\/size\]/g, (_, size, content) => {
    return `<span class="review-font-${size}">${content}</span>`
  })

  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/_([^_]+)_/g, '<em>$1</em>')
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
  html = html.replace(/^##\s+(.+)$/gm, '<h4>$1</h4>')
  html = html.replace(/^-\s+(.+)$/gm, '<li>$1</li>')
  html = html.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
  html = html.replace(/\n/g, '<br/>')

  return html
}

function parseReviewContent(content) {
  const normalizedContent = String(content || '').trim()
  if (!normalizedContent) {
    return { overview: '', images: [], secondImages: [], testResults: [], verdict: '' }
  }

  if (normalizedContent.startsWith('{')) {
    try {
      const parsed = JSON.parse(normalizedContent)
      return {
        overview: String(parsed.overview || ''),
        images: Array.isArray(parsed.images) ? parsed.images.filter(Boolean) : [],
        secondImages: Array.isArray(parsed.secondImages)
          ? parsed.secondImages.filter(Boolean)
          : Array.isArray(parsed.imagesAfterTests)
            ? parsed.imagesAfterTests.filter(Boolean)
            : [],
        testResults: Array.isArray(parsed.testResults)
          ? parsed.testResults
            .filter((item) => item && (item.key || item.value))
            .map((item) => ({ key: String(item.key || ''), value: String(item.value || '') }))
          : [],
        verdict: String(parsed.verdict || ''),
      }
    } catch {
      // Fall back to legacy section parsing.
    }
  }

  const lines = (content || '').split('\n')
  const overview = []
  const images = []
  const secondImages = []
  const testResults = []
  const verdict = []
  let section = null

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed === 'Overview') { section = 'overview'; continue }
    if (trimmed === 'Example photo gallery') { section = 'gallery'; continue }
    if (trimmed === 'Test results') { section = 'results'; continue }
    if (trimmed === 'Second photo gallery') { section = 'gallery2'; continue }
    if (trimmed === 'Verdict') { section = 'verdict'; continue }
    if (!trimmed) continue

    if (section === 'overview') overview.push(trimmed)
    else if (section === 'gallery') {
      const match = trimmed.match(/^\d+\.\s+((?:https?:\/\/|\/media\/).+)/)
      if (match) images.push(match[1].trim())
    } else if (section === 'gallery2') {
      const match = trimmed.match(/^\d+\.\s+((?:https?:\/\/|\/media\/).+)/)
      if (match) secondImages.push(match[1].trim())
    } else if (section === 'results') {
      const match = trimmed.match(/^-\s+(.+?):\s+(.+)/)
      if (match) testResults.push({ key: match[1].trim(), value: match[2].trim() })
    } else if (section === 'verdict') verdict.push(trimmed)
  }

  return { overview: overview.join(' '), images, secondImages, testResults, verdict: verdict.join(' ') }
}

function buildReviewContent({ overview, images, secondImages, testResults, verdict }) {
  const sections = []

  if (overview && overview.trim()) {
    sections.push('Overview')
    sections.push(overview.trim())
  }

  if (Array.isArray(images) && images.length > 0) {
    if (sections.length > 0) sections.push('')
    sections.push('Example photo gallery')
    images.forEach((image, index) => {
      if (image && String(image).trim()) {
        sections.push(`${index + 1}. ${String(image).trim()}`)
      }
    })
  }

  if (Array.isArray(testResults) && testResults.length > 0) {
    if (sections.length > 0) sections.push('')
    sections.push('Test results')
    testResults.forEach((result) => {
      const key = String(result?.key || '').trim()
      const value = String(result?.value || '').trim()
      if (key || value) {
        sections.push(`- ${key}: ${value}`)
      }
    })
  }

  if (Array.isArray(secondImages) && secondImages.length > 0) {
    if (sections.length > 0) sections.push('')
    sections.push('Second photo gallery')
    secondImages.forEach((image, index) => {
      if (image && String(image).trim()) {
        sections.push(`${index + 1}. ${String(image).trim()}`)
      }
    })
  }

  if (verdict && verdict.trim()) {
    if (sections.length > 0) sections.push('')
    sections.push('Verdict')
    sections.push(verdict.trim())
  }

  return sections.join('\n')
}

export default function ReviewsPage() {
  const { t, lang } = useTranslation()
  const location = useLocation()
  const currentUser = useMemo(() => getCurrentUser(), [])
  const isLoggedIn = useMemo(() => isAuthenticatedUser(), [])
  const [reviews, setReviews] = useState([])
  const [cars, setCars] = useState([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState('newest')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedBrand, setSelectedBrand] = useState('all')
  const [selectedModel, setSelectedModel] = useState('all')
  const [editingReviewId, setEditingReviewId] = useState(null)
  const [reviewDraft, setReviewDraft] = useState(null)
  const [sectionEditor, setSectionEditor] = useState(null)
  const [sectionValue, setSectionValue] = useState('')
  const [sectionImagePreviews, setSectionImagePreviews] = useState([])
  const [sectionImageUploading, setSectionImageUploading] = useState(false)
  const [sectionTestResultsValues, setSectionTestResultsValues] = useState([])
  const [reviewSaving, setReviewSaving] = useState(false)
  const [reviewMessage, setReviewMessage] = useState('')
  const [reviewError, setReviewError] = useState('')
  const [isCreateReviewSectionOpen, setIsCreateReviewSectionOpen] = useState(false)
  const [newReviewFirstSliderFiles, setNewReviewFirstSliderFiles] = useState([])
  const [newReviewSecondSliderFiles, setNewReviewSecondSliderFiles] = useState([])
  const firstSliderInputRef = useRef(null)
  const secondSliderInputRef = useRef(null)
  const [newReviewDraft, setNewReviewDraft] = useState({
    car_model: '',
    title: '',
    summary: '',
    content: '',
    category: 'test',
    tags: '',
    reading_time_minutes: '',
    publication_name: '',
    publication_url: '',
    author_name: '',
    published_at: '',
    is_published: true,
  })

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const [reviewsResponse, carsResponse] = await Promise.all([
          api.get('/reviews/?page_size=200&ordering=-published_at'),
          api.get('/cars/?page_size=400'),
        ])
        const reviewsList = reviewsResponse.data.results || reviewsResponse.data || []
        const carsList = carsResponse.data.results || carsResponse.data || []

        setReviews(reviewsList)
        setCars(carsList)
        setNewReviewDraft((prev) => ({
          ...prev,
          car_model: prev.car_model || String(carsList[0]?.id || ''),
        }))
      } catch (error) {
        console.error('Error fetching reviews:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const reloadReviews = async () => {
    const response = await api.get('/reviews/?page_size=200&ordering=-published_at')
    setReviews(response.data.results || response.data || [])
  }

  const normalizedReviews = useMemo(
    () => reviews.map((review) => ({ ...review, _brandName: String(review.car_brand_name || '').trim() })),
    [reviews],
  )

  const availableBrands = useMemo(() => {
    const values = new Set(normalizedReviews.map((review) => String(review._brandName || '').trim()).filter(Boolean))
    return Array.from(values).sort((a, b) => a.localeCompare(b))
  }, [normalizedReviews])

  const models = useMemo(() => {
    const byModelId = new Map()
    normalizedReviews.forEach((review) => {
      if (selectedBrand !== 'all' && review._brandName !== selectedBrand) return
      if (!review.car_id || !review.car_name) return
      byModelId.set(review.car_id, review.car_name)
    })

    return Array.from(byModelId.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [normalizedReviews, selectedBrand])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const modelFromUrl = String(params.get('model') || '').trim()
    if (modelFromUrl) {
      setSelectedModel(modelFromUrl)
    }
  }, [location.search])

  useEffect(() => {
    if (selectedModel === 'all') return
    const stillAvailable = models.some((model) => String(model.id) === String(selectedModel))
    if (!stillAvailable) setSelectedModel('all')
  }, [models, selectedModel])

  const filteredAndSortedReviews = useMemo(() => {
    let filtered = normalizedReviews

    if (selectedBrand !== 'all') filtered = filtered.filter((review) => review._brandName === selectedBrand)
    if (selectedModel !== 'all') filtered = filtered.filter((review) => String(review.car_id) === String(selectedModel))
    if (searchTerm.trim()) {
      const normalizedSearch = searchTerm.toLowerCase()
      filtered = filtered.filter((review) => {
        const searchableText = `${review.title || ''} ${review.content || ''} ${review.car_name || ''} ${review._brandName || ''} ${review.author?.username || ''}`.toLowerCase()
        return searchableText.includes(normalizedSearch)
      })
    }

    const sorted = [...filtered]
    if (sortBy === 'newest') sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    if (sortBy === 'oldest') sorted.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    if (sortBy === 'highest-rated') sorted.sort((a, b) => new Date(b.published_at) - new Date(a.published_at))
    if (sortBy === 'most-helpful') sorted.sort((a, b) => new Date(b.published_at) - new Date(a.published_at))
    return sorted
  }, [normalizedReviews, selectedBrand, selectedModel, sortBy, searchTerm])

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString(lang === 'pl' ? 'pl-PL' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const getReviewCountLabel = (count) => {
    if (lang !== 'pl') return count === 1 ? t.pages.reviewSingle : t.pages.reviewPlural
    if (count === 1) return t.pages.reviewSingle

    const mod10 = count % 10
    const mod100 = count % 100
    const isFew = mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
    return isFew ? t.pages.reviewFew : t.pages.reviewPlural
  }

  const handleStartEditReview = async (reviewId) => {
    setReviewError('')
    setReviewMessage('')
    try {
      const response = await api.get(`/reviews/${reviewId}/`)
      const detail = response.data
      const nextDraft = {
        car_model: String(detail.car_id || ''),
        title: detail.title || '',
        summary: detail.summary || '',
        content: detail.content || '',
        category: detail.category || 'test',
        tags: detail.tags || '',
        reading_time_minutes: String(detail.reading_time_minutes || ''),
        internal_notes: detail.internal_notes || '',
        publication_name: detail.publication_name || '',
        publication_url: detail.publication_url || '',
        author_name: detail.author_name || '',
        published_at: String(detail.published_at || '').slice(0, 10),
        is_published: !!detail.is_published,
      }
      setEditingReviewId(reviewId)
      setReviewDraft(nextDraft)
      return nextDraft
    } catch {
      setReviewError(t.adminPanel.reviewLoadError)
      return null
    }
  }

  const getInlineFieldLabel = (field) => {
    if (field === 'title') return t.pages.opinionTitle
    if (field === 'summary') return t.adminPanel.reviewSummary
    if (field === 'content') return t.adminPanel.reviewContent
    if (field === 'publication_name') return t.adminPanel.reviewPublication
    if (field === 'author_name') return t.adminPanel.reviewAuthor
    if (field === 'tags') return t.adminPanel.reviewTags
    if (field === 'overview') return t.pages.overview || 'Overview'
    if (field === 'testResults') return t.pages.testResults || 'Test Results'
    if (field === 'verdict') return t.pages.verdict || 'Verdict'
    if (field === 'images') return t.pages.images || 'Images'
    if (field === 'secondImages') return t.pages.secondImages || 'Second Slider Images'
    if (field === 'car_model') return t.pages.modelFilterLabel || 'Model'
    if (field === 'category') return t.pages.reviewCategory || 'Typ'
    return t.pages.editLabel
  }

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return

    setSectionImageUploading(true)
    setReviewError('')
    try {
      const field = sectionEditor?.field || 'images'
      const maxForField = IMAGE_LIMITS[field] || null
      let filesToUpload = files

      if (maxForField !== null) {
        const remainingSlots = maxForField - sectionImagePreviews.length
        if (remainingSlots <= 0) {
          setReviewError(`Mozesz dodac maksymalnie ${maxForField} zdjec do tego slidera`)
          return
        }
        if (files.length > remainingSlots) {
          filesToUpload = files.slice(0, remainingSlots)
          setReviewMessage(`Dodano ${remainingSlots} z ${files.length} wybranych zdjec (limit ${maxForField})`)
        }
      }

      const uploadedUrls = await Promise.all(
        filesToUpload.map(async (file) => {
          const formData = new FormData()
          formData.append('file', file)
          let response
          try {
            response = await api.post('/common/content/upload/', formData, {
              headers: { 'Content-Type': 'multipart/form-data' }
            })
          } catch {
            // Backward compatibility for deployments that expose /common/upload/.
            response = await api.post('/common/upload/', formData, {
              headers: { 'Content-Type': 'multipart/form-data' }
            })
          }
          return response.data.url
        })
      )
      setSectionImagePreviews(prev => [...prev, ...uploadedUrls])
    } catch (error) {
      setReviewError('Blad przy wysylaniu zdjec')
    } finally {
      setSectionImageUploading(false)
      e.target.value = ''
    }
  }

  const handleRemoveImage = (index) => {
    setSectionImagePreviews(prev => prev.filter((_, i) => i !== index))
  }

  const handleOpenSectionEditor = async (reviewId, field) => {
    if (!INLINE_REVIEW_EDIT_FIELDS.has(field)) return
    setReviewError('')
    setReviewMessage('')

    let draft = reviewDraft
    if (editingReviewId !== reviewId || !reviewDraft) {
      draft = await handleStartEditReview(reviewId)
    }
    if (!draft) return

    setSectionEditor({ reviewId, field })

    // Handle nested fields from content JSON
    const nestedFields = ['overview', 'testResults', 'verdict', 'images', 'secondImages']
    if (nestedFields.includes(field)) {
      const parsedContent = parseReviewContent(draft.content)
      if (field === 'testResults') {
        const rows = TEST_RESULT_FIELDS.map((fieldDef) => {
          const existing = (parsedContent.testResults || []).find((item) => {
            const incomingKey = String(item?.key || '')
            return !!fieldDef.aliases.find((alias) => normalizeTestKey(alias) === normalizeTestKey(incomingKey))
              || normalizeTestKey(fieldDef.key) === normalizeTestKey(incomingKey)
          })
          return {
            key: fieldDef.key,
            unit: fieldDef.unit,
            value: stripKnownUnit(existing?.value || '', fieldDef.unit),
          }
        })
        setSectionTestResultsValues(rows)
        setSectionValue('')
      } else if (field === 'images') {
        setSectionImagePreviews(parsedContent.images)
        setSectionValue('')
      } else if (field === 'secondImages') {
        setSectionImagePreviews(parsedContent.secondImages || [])
        setSectionValue('')
      } else {
        setSectionValue(String(parsedContent[field] || ''))
      }
    } else {
      setSectionValue(String(draft[field] || ''))
    }
  }

  const handleCloseSectionEditor = () => {
    setSectionEditor(null)
    setSectionValue('')
    setSectionImagePreviews([])
    setSectionImageUploading(false)
    setSectionTestResultsValues([])
  }

  const handleSaveSectionEditor = async () => {
    if (!sectionEditor) return

    const { reviewId, field } = sectionEditor
    const normalizedValue = String(sectionValue || '').trim()
    if ((field === 'title' || field === 'content' || field === 'publication_name') && !normalizedValue) {
      setReviewError(t.adminPanel.createReviewValidation)
      return
    }

    setReviewSaving(true)
    setReviewError('')
    setReviewMessage('')
    try {
      // Handle nested fields (overview, testResults, verdict, images)
      const nestedFields = ['overview', 'testResults', 'verdict', 'images', 'secondImages']
      let updatePayload = {}

      if (nestedFields.includes(field)) {
        const existingContent = reviewDraft?.content || ''
        const parsedContent = parseReviewContent(existingContent)

        if (field === 'testResults') {
          parsedContent.testResults = sectionTestResultsValues
            .map((item) => {
              const key = String(item.key || '').trim()
              const fieldDef = getTestFieldByKey(key)
              const unit = fieldDef?.unit || String(item.unit || '').trim()
              return {
                key,
                value: appendUnit(item.value, unit),
              }
            })
            .filter((item) => item.key)
        } else if (field === 'images') {
          parsedContent.images = sectionImagePreviews
        } else if (field === 'secondImages') {
          parsedContent.secondImages = sectionImagePreviews
        } else {
          parsedContent[field] = normalizedValue
        }

        updatePayload.content = buildReviewContent(parsedContent)
      } else if (field === 'car_model') {
        const parsedModelId = Number.parseInt(normalizedValue, 10)
        if (!Number.isInteger(parsedModelId) || parsedModelId <= 0) {
          setReviewError(t.adminPanel.createReviewValidation)
          setReviewSaving(false)
          return
        }
        updatePayload[field] = parsedModelId
      } else {
        updatePayload[field] = normalizedValue
      }

      await api.patch(`/reviews/${reviewId}/`, updatePayload)
      await reloadReviews()
      setReviewDraft((prev) => {
        if (!prev || editingReviewId !== reviewId) return prev
        if (nestedFields.includes(field)) {
          return { ...prev, content: updatePayload.content }
        }
        return { ...prev, [field]: normalizedValue }
      })
      setReviewMessage(t.pages.reviewUpdatedUser)
      handleCloseSectionEditor()
    } catch {
      setReviewError(t.adminPanel.reviewUpdateError)
    } finally {
      setReviewSaving(false)
    }
  }

  const handleEditableKeyDown = (event, cb) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      cb()
    }
  }

  const handleDeleteReview = async (reviewId) => {
    if (!window.confirm(t.pages.reviewDeleteConfirmUser)) return
    setReviewSaving(true)
    setReviewError('')
    setReviewMessage('')
    try {
      await api.delete(`/reviews/${reviewId}/`)
      await reloadReviews()
      if (editingReviewId === reviewId) {
        setEditingReviewId(null)
        setReviewDraft(null)
      }
      if (sectionEditor?.reviewId === reviewId) {
        handleCloseSectionEditor()
      }
      setReviewMessage(t.pages.reviewDeletedUser)
    } catch {
      setReviewError(t.adminPanel.reviewDeleteError)
    } finally {
      setReviewSaving(false)
    }
  }

  const uploadNewReviewImages = async (files) => {
    if (!files || files.length === 0) return []
    return Promise.all(
      files.map(async (file) => {
        const formData = new FormData()
        formData.append('file', file)
        let response
        try {
          response = await api.post('/common/content/upload/', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          })
        } catch {
          response = await api.post('/common/upload/', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          })
        }
        return response?.data?.url || ''
      }),
    )
  }

  const handleCreateReview = async (e) => {
    e.preventDefault()
    setReviewError('')
    setReviewMessage('')

    if (!newReviewDraft.car_model || !newReviewDraft.title.trim() || !newReviewDraft.content.trim() || !newReviewDraft.publication_name.trim() || !newReviewDraft.published_at) {
      setReviewError(t.adminPanel.createReviewValidation)
      return
    }

    setReviewSaving(true)
    try {
      const firstSliderUrls = (await uploadNewReviewImages(newReviewFirstSliderFiles)).filter(Boolean)
      const secondSliderUrls = (await uploadNewReviewImages(newReviewSecondSliderFiles)).filter(Boolean)
      const parsedContent = parseReviewContent(newReviewDraft.content.trim())
      const hasStructuredContent = Boolean(
        parsedContent.overview
        || (parsedContent.images && parsedContent.images.length > 0)
        || (parsedContent.secondImages && parsedContent.secondImages.length > 0)
        || (parsedContent.testResults && parsedContent.testResults.length > 0)
        || parsedContent.verdict,
      )
      const normalizedContent = hasStructuredContent ? buildReviewContent({
        ...parsedContent,
        images: firstSliderUrls.length > 0 ? firstSliderUrls : parsedContent.images,
        secondImages: secondSliderUrls.length > 0 ? secondSliderUrls : parsedContent.secondImages,
      }) : newReviewDraft.content.trim()

      await api.post('/reviews/', {
        car_model: Number.parseInt(newReviewDraft.car_model, 10),
        title: newReviewDraft.title.trim(),
        summary: newReviewDraft.summary.trim(),
        content: normalizedContent,
        category: newReviewDraft.category,
        tags: newReviewDraft.tags.trim(),
        reading_time_minutes: Number.parseInt(String(newReviewDraft.reading_time_minutes || '0'), 10) || 0,
        publication_name: newReviewDraft.publication_name.trim(),
        publication_url: newReviewDraft.publication_url.trim(),
        author_name: newReviewDraft.author_name.trim(),
        published_at: newReviewDraft.published_at,
        is_published: !!newReviewDraft.is_published,
      })
      await reloadReviews()
      setNewReviewDraft((prev) => ({
        ...prev,
        title: '',
        summary: '',
        content: '',
        tags: '',
        reading_time_minutes: '',
        publication_name: '',
        publication_url: '',
        author_name: '',
        published_at: '',
        is_published: true,
      }))
      setNewReviewFirstSliderFiles([])
      setNewReviewSecondSliderFiles([])
      if (firstSliderInputRef.current) firstSliderInputRef.current.value = ''
      if (secondSliderInputRef.current) secondSliderInputRef.current.value = ''
      setReviewMessage(t.adminPanel.reviewCreated)
    } catch {
      setReviewError(t.adminPanel.reviewCreateError)
    } finally {
      setReviewSaving(false)
    }
  }

  return (
    <div className="opinions-page-wrap">
      <h1 className="page-title">{t.nav.reviews}</h1>
      <p className="admin-subtitle">{t.pages.reviewsCatalogIntro}</p>

      <div className="opinions-filters">
        <div className="filter-group">
          <label className="form-label">{t.pages.searchModels}</label>
          <input
            type="text"
            className="form-input"
            placeholder={t.pages.searchModelsPlaceholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <label className="form-label">{t.pages.brandLabel}</label>
          <select
            className="form-input"
            value={selectedBrand}
            onChange={(e) => {
              setSelectedBrand(e.target.value)
              setSelectedModel('all')
            }}
          >
            <option value="all">{t.pages.allLabel}</option>
            {availableBrands.map((brand) => (
              <option key={brand} value={brand}>{brand}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label className="form-label">{t.pages.modelFilterLabel}</label>
          <select className="form-input" value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)}>
            <option value="all">{t.pages.allLabel}</option>
            {models.map((model) => (
              <option key={model.id} value={model.id}>{model.name}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label className="form-label">{t.pages.sortBy}</label>
          <select className="form-input" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="newest">{t.pages.sortNewest}</option>
            <option value="oldest">{t.pages.sortOldest}</option>
            <option value="highest-rated">{t.pages.sortHighestRated}</option>
            <option value="most-helpful">{t.pages.sortMostHelpful}</option>
          </select>
        </div>
      </div>

      {isLoggedIn ? (
        <section className="admin-form-card" style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: isCreateReviewSectionOpen ? '0.5rem' : 0, minHeight: '2rem' }}>
            <h2 className="admin-section-heading" style={{ margin: 0, flex: 1 }}>{t.pages.createReviewTitle}</h2>
            <button
              type="button"
              className={`admin-inline-toggle admin-inline-gear ${isCreateReviewSectionOpen ? 'is-open' : ''}`}
              onClick={() => {
                setIsCreateReviewSectionOpen((prev) => !prev)
                setReviewMessage('')
                setReviewError('')
              }}
              aria-expanded={isCreateReviewSectionOpen}
              aria-label={isCreateReviewSectionOpen ? t.adminPanel.hideImageEditor : t.adminPanel.editImage}
              title={isCreateReviewSectionOpen ? t.adminPanel.hideImageEditor : t.adminPanel.editImage}
              style={{ flexShrink: 0 }}
            >
              <svg className="admin-inline-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.3 7.3 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.49-.42h-3.84a.5.5 0 0 0-.49.42l-.36 2.54c-.58.22-1.12.53-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.7 8.84a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.82 14.52a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96c.5.4 1.05.72 1.63.94l.36 2.54a.5.5 0 0 0 .49.42h3.84a.5.5 0 0 0 .49-.42l.36-2.54c.58-.22 1.12-.53 1.63-.94l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z" />
              </svg>
            </button>
          </div>
          {isCreateReviewSectionOpen && (
            <>
              <p className="admin-subtitle" style={{ marginBottom: '0.75rem' }}>{t.pages.createReviewHint}</p>
              <form onSubmit={handleCreateReview} className="admin-form-grid">
            <div>
              <label className="form-label" htmlFor="user-review-car">{t.adminPanel.chooseModel}</label>
              <select
                id="user-review-car"
                className="form-input"
                value={newReviewDraft.car_model}
                onChange={(e) => setNewReviewDraft((prev) => ({ ...prev, car_model: e.target.value }))}
              >
                {cars.map((car) => (
                  <option key={car.id} value={car.id}>{car.brand_name} {car.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label" htmlFor="user-review-title">{t.pages.opinionTitle}</label>
              <input
                id="user-review-title"
                className="form-input"
                value={newReviewDraft.title}
                onChange={(e) => setNewReviewDraft((prev) => ({ ...prev, title: e.target.value }))}
              />
            </div>
            <div>
              <label className="form-label" htmlFor="user-review-publication">{t.adminPanel.reviewPublication}</label>
              <input
                id="user-review-publication"
                className="form-input"
                value={newReviewDraft.publication_name}
                onChange={(e) => setNewReviewDraft((prev) => ({ ...prev, publication_name: e.target.value }))}
              />
            </div>
            <div>
              <label className="form-label" htmlFor="user-review-author">{t.adminPanel.reviewAuthor}</label>
              <input
                id="user-review-author"
                className="form-input"
                value={newReviewDraft.author_name}
                onChange={(e) => setNewReviewDraft((prev) => ({ ...prev, author_name: e.target.value }))}
                placeholder={currentUser?.username || ''}
              />
            </div>
            <div>
              <label className="form-label" htmlFor="user-review-date">{t.adminPanel.reviewDate}</label>
              <input
                id="user-review-date"
                type="date"
                className="form-input"
                value={newReviewDraft.published_at}
                onChange={(e) => setNewReviewDraft((prev) => ({ ...prev, published_at: e.target.value }))}
              />
            </div>
            <div>
              <label className="form-label" htmlFor="user-review-category">{t.adminPanel.reviewCategory}</label>
              <select
                id="user-review-category"
                className="form-input"
                value={newReviewDraft.category}
                onChange={(e) => setNewReviewDraft((prev) => ({ ...prev, category: e.target.value }))}
              >
                <option value="test">{t.adminPanel.reviewCategoryTest}</option>
                <option value="news">{t.adminPanel.reviewCategoryNews}</option>
                <option value="guide">{t.adminPanel.reviewCategoryGuide}</option>
                <option value="opinion">{t.adminPanel.reviewCategoryOpinion}</option>
              </select>
            </div>
            <div>
              <label className="form-label" htmlFor="user-review-reading-time">{t.adminPanel.reviewReadingTime}</label>
              <input
                id="user-review-reading-time"
                className="form-input"
                type="number"
                min="0"
                value={newReviewDraft.reading_time_minutes}
                onChange={(e) => setNewReviewDraft((prev) => ({ ...prev, reading_time_minutes: e.target.value }))}
              />
            </div>
            <div className="admin-form-grid-full">
              <label className="form-label" htmlFor="user-review-tags">{t.adminPanel.reviewTags}</label>
              <input
                id="user-review-tags"
                className="form-input"
                value={newReviewDraft.tags}
                onChange={(e) => setNewReviewDraft((prev) => ({ ...prev, tags: e.target.value }))}
              />
            </div>
            <div className="admin-form-grid-full">
              <label className="form-label" htmlFor="user-review-summary">{t.adminPanel.reviewSummary}</label>
              <textarea
                id="user-review-summary"
                className="form-input form-textarea"
                rows={3}
                value={newReviewDraft.summary}
                onChange={(e) => setNewReviewDraft((prev) => ({ ...prev, summary: e.target.value }))}
              />
            </div>
            <div className="admin-form-grid-full">
              <RichTextEditor
                id="user-review-content"
                label={t.adminPanel.reviewContent}
                value={newReviewDraft.content}
                onChange={(val) => setNewReviewDraft((prev) => ({ ...prev, content: val }))}
                placeholder={t.adminPanel.reviewEditorPlaceholder}
              />
            </div>
            <div className="admin-form-grid-full">
              <label className="form-label" htmlFor="user-review-first-slider">{t.adminPanel.reviewFirstSliderLabel}</label>
              <input
                ref={firstSliderInputRef}
                id="user-review-first-slider"
                type="file"
                multiple
                accept="image/*"
                className="form-input"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const files = Array.from(e.target.files || [])
                  if (files.length > 12) {
                    setReviewError(t.adminPanel.reviewFirstSliderLimitError)
                    return
                  }
                  setReviewError('')
                  setNewReviewFirstSliderFiles(files)
                }}
              />
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => firstSliderInputRef.current?.click()}
              >
                {t.adminPanel.chooseFile}
              </button>
              <p className="review-slider-limit-note">
                {newReviewFirstSliderFiles.length > 0
                  ? t.adminPanel.reviewFilesSelected.replace('{count}', String(newReviewFirstSliderFiles.length))
                  : t.adminPanel.noFileSelected}
              </p>
            </div>
            <div className="admin-form-grid-full">
              <label className="form-label" htmlFor="user-review-second-slider">{t.adminPanel.reviewSecondSliderLabel}</label>
              <input
                ref={secondSliderInputRef}
                id="user-review-second-slider"
                type="file"
                multiple
                accept="image/*"
                className="form-input"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const files = Array.from(e.target.files || [])
                  setNewReviewSecondSliderFiles(files)
                }}
              />
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => secondSliderInputRef.current?.click()}
              >
                {t.adminPanel.chooseFile}
              </button>
              <p className="review-slider-limit-note">
                {newReviewSecondSliderFiles.length > 0
                  ? t.adminPanel.reviewFilesSelected.replace('{count}', String(newReviewSecondSliderFiles.length))
                  : t.adminPanel.noFileSelected}
              </p>
            </div>
            <label className="form-checkbox-row admin-form-grid-full">
              <input
                type="checkbox"
                checked={newReviewDraft.is_published}
                onChange={(e) => setNewReviewDraft((prev) => ({ ...prev, is_published: e.target.checked }))}
              />
              {t.adminPanel.reviewPublished}
            </label>
            <div className="admin-actions-row admin-form-grid-full">
              <button type="submit" className="btn btn-primary" disabled={reviewSaving}>{reviewSaving ? t.pages.loading : t.adminPanel.createReview}</button>
            </div>
          </form>
            </>
          )}
        </section>
      ) : (
        <p className="admin-subtitle" style={{ marginBottom: '1rem' }}>{t.pages.loginToContribute}</p>
      )}

      {reviewMessage && <p className="form-success">{reviewMessage}</p>}
      {reviewError && <p className="form-error">{reviewError}</p>}

      {loading ? (
        <div className="page-loading">{t.pages.loading}</div>
      ) : filteredAndSortedReviews.length === 0 ? (
        <div className="page-card">{t.pages.noReviewsInCatalog}</div>
      ) : (
        <div className="opinions-list-wrap">
          <p className="admin-subtitle">
            {filteredAndSortedReviews.length} {getReviewCountLabel(filteredAndSortedReviews.length)}
          </p>

          <div className="opinions-list">
            {filteredAndSortedReviews.map((review) => {
              const content = decodeHtmlEntities(review.content)
              const isHtmlContent = /<\/?[a-z][\s\S]*>/i.test(content)
              const parsed = isHtmlContent ? null : parseReviewContent(content)
              const canManageReview = canEditByAuthorId(review.author_id)
              const emptyGalleryLabel = canManageReview ? 'Kliknij, aby dodać zdjęcia' : 'Brak zdjęć'
              const emptySecondGalleryLabel = canManageReview ? 'Kliknij, aby dodać zdjęcia do drugiego slidera' : 'Brak zdjęć w drugim sliderze'
              const emptyOverviewLabel = canManageReview ? 'Kliknij, aby dodać opis testu' : 'Brak opisu testu'
              const emptyResultsLabel = canManageReview ? 'Kliknij, aby dodać wyniki testu' : 'Brak wyników testu'
              const emptyVerdictLabel = canManageReview ? 'Kliknij, aby dodać werdykt' : 'Brak werdyktu'
              return (
                <article key={review.id} className="review-card-rich">
                  {canManageReview && (
                    <button
                      type="button"
                      className="review-admin-quick-edit"
                      onClick={() => handleOpenSectionEditor(review.id, 'title')}
                      aria-label={t.adminPanel.editReview || 'Edit review'}
                      title={t.adminPanel.editReview || 'Edit review'}
                    >
                      <svg className="review-admin-quick-edit-icon" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.3 7.3 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.49-.42h-3.84a.5.5 0 0 0-.49.42l-.36 2.54c-.58.22-1.12.53-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.7 8.84a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.82 14.52a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96c.5.4 1.05.72 1.63.94l.36 2.54a.5.5 0 0 0 .49.42h3.84a.5.5 0 0 0 .49-.42l.36-2.54c.58-.22 1.12-.53 1.63-.94l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z" />
                      </svg>
                    </button>
                  )}

                  {/* Header */}
                  <div className="review-card-header">
                    <div className="review-card-meta-top">
                      {canManageReview ? (
                        <button
                          type="button"
                          className="review-inline-text-btn review-inline-meta-btn"
                          onClick={() => handleOpenSectionEditor(review.id, 'publication_name')}
                        >
                          {review.publication_name}
                        </button>
                      ) : (
                        <span className="review-publication">{review.publication_name}</span>
                      )}
                      {review.author_name && (
                        canManageReview ? (
                          <button
                            type="button"
                            className="review-inline-text-btn review-inline-meta-btn review-author-name"
                            onClick={() => handleOpenSectionEditor(review.id, 'author_name')}
                          >
                            {' · '}{review.author_name}
                          </button>
                        ) : <span className="review-author-name"> · {review.author_name}</span>
                      )}
                      <span className="review-date-tag"> · {formatDate(review.published_at)}</span>
                      {review.reading_time_minutes ? <span className="review-date-tag"> · {review.reading_time_minutes} min read</span> : null}
                    </div>
                    <h3 className="review-card-title">
                      {canManageReview ? (
                        <button
                          type="button"
                          className="review-inline-text-btn review-inline-title-btn"
                          onClick={() => handleOpenSectionEditor(review.id, 'title')}
                        >
                          {review.title}
                        </button>
                      ) : review.title}
                    </h3>
                    {review.summary && (
                      <p
                        className={`review-card-summary ${canManageReview ? 'review-inline-editable-block' : ''}`}
                        dangerouslySetInnerHTML={{ __html: sanitizeEditorialHtml(review.summary) }}
                        role={canManageReview ? 'button' : undefined}
                        tabIndex={canManageReview ? 0 : undefined}
                        onClick={canManageReview ? () => handleOpenSectionEditor(review.id, 'summary') : undefined}
                        onKeyDown={canManageReview ? (event) => handleEditableKeyDown(event, () => handleOpenSectionEditor(review.id, 'summary')) : undefined}
                      />
                    )}
                    {review.category && (
                      <p
                        className={`admin-meta ${canManageReview ? 'review-inline-editable-block' : ''}`}
                        role={canManageReview ? 'button' : undefined}
                        tabIndex={canManageReview ? 0 : undefined}
                        onClick={canManageReview ? () => handleOpenSectionEditor(review.id, 'category') : undefined}
                        onKeyDown={canManageReview ? (event) => handleEditableKeyDown(event, () => handleOpenSectionEditor(review.id, 'category')) : undefined}
                      >
                        {getReviewCategoryLabel(review.category, t)}
                      </p>
                    )}
                    {review.tags && (
                      <p
                        className={`admin-meta ${canManageReview ? 'review-inline-editable-block review-inline-tags' : ''}`}
                        role={canManageReview ? 'button' : undefined}
                        tabIndex={canManageReview ? 0 : undefined}
                        onClick={canManageReview ? () => handleOpenSectionEditor(review.id, 'tags') : undefined}
                        onKeyDown={canManageReview ? (event) => handleEditableKeyDown(event, () => handleOpenSectionEditor(review.id, 'tags')) : undefined}
                      >
                        {review.tags}
                      </p>
                    )}
                    {(review.car_brand_name || review.car_name) && (
                      <div
                        className={`review-car-tag ${canManageReview ? 'review-inline-editable-block' : ''}`}
                        role={canManageReview ? 'button' : undefined}
                        tabIndex={canManageReview ? 0 : undefined}
                        onClick={canManageReview ? () => handleOpenSectionEditor(review.id, 'car_model') : undefined}
                        onKeyDown={canManageReview ? (event) => handleEditableKeyDown(event, () => handleOpenSectionEditor(review.id, 'car_model')) : undefined}
                      >
                        {canManageReview ? (
                          <span>{review.car_brand_name} {review.car_name}</span>
                        ) : review.car_id ? (
                          <Link to={`/cars/${review.car_id}`}>{review.car_brand_name} {review.car_name}</Link>
                        ) : (
                          <span>{review.car_brand_name} {review.car_name}</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Image gallery (legacy content only) */}
                  {parsed && (
                    <ImageSlider
                      images={parsed.images}
                      title={`${review.title} - slider 1`}
                      emptyLabel={emptyGalleryLabel}
                      isEditable={canManageReview}
                      onEdit={() => handleOpenSectionEditor(review.id, 'images')}
                    />
                  )}

                  {/* Rich HTML content */}
                  {isHtmlContent && (
                    <div
                      className={`review-html-content ${canManageReview ? 'review-inline-editable-block' : ''}`}
                      dangerouslySetInnerHTML={{ __html: sanitizeEditorialHtml(content) }}
                      role={canManageReview ? 'button' : undefined}
                      tabIndex={canManageReview ? 0 : undefined}
                      onClick={canManageReview ? () => handleOpenSectionEditor(review.id, 'content') : undefined}
                      onKeyDown={canManageReview ? (event) => handleEditableKeyDown(event, () => handleOpenSectionEditor(review.id, 'content')) : undefined}
                    />
                  )}

                  {/* Overview (legacy content only) */}
                  {parsed && (
                    <p
                      className={`review-overview-text ${canManageReview ? 'review-inline-editable-block' : ''} ${parsed.overview ? '' : 'review-section-empty'}`}
                      dangerouslySetInnerHTML={{ __html: parsed.overview ? formatEditorialText(parsed.overview) : escapeHtml(emptyOverviewLabel) }}
                      role={canManageReview ? 'button' : undefined}
                      tabIndex={canManageReview ? 0 : undefined}
                      onClick={canManageReview ? () => handleOpenSectionEditor(review.id, 'overview') : undefined}
                      onKeyDown={canManageReview ? (event) => handleEditableKeyDown(event, () => handleOpenSectionEditor(review.id, 'overview')) : undefined}
                    />
                  )}

                  {/* Test results (legacy content only) */}
                  {parsed && (
                    <div className={`review-results ${canManageReview ? 'review-inline-editable-block' : ''}`}
                      role={canManageReview ? 'button' : undefined}
                      tabIndex={canManageReview ? 0 : undefined}
                      onClick={canManageReview ? () => handleOpenSectionEditor(review.id, 'testResults') : undefined}
                      onKeyDown={canManageReview ? (event) => handleEditableKeyDown(event, () => handleOpenSectionEditor(review.id, 'testResults')) : undefined}>
                      <h4 className="review-results-title">{t.pages.testResults}</h4>
                      {parsed.testResults.length > 0 ? (
                        <div className="review-results-grid">
                          {parsed.testResults.map((result, i) => (
                            <div
                              key={i}
                              className="review-result-item"
                            >
                              <span className="review-result-value">{result.value}</span>
                              <span className="review-result-key">{getTestLabel(result.key, lang)}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="review-section-empty review-results-empty">{emptyResultsLabel}</p>
                      )}
                    </div>
                  )}

                  {/* Second slider (below test results) */}
                  {parsed && (
                    <ImageSlider
                      images={parsed.secondImages || []}
                      title={`${review.title} - slider 2`}
                      emptyLabel={emptySecondGalleryLabel}
                      isEditable={canManageReview}
                      onEdit={() => handleOpenSectionEditor(review.id, 'secondImages')}
                      className="review-gallery review-gallery-secondary"
                    />
                  )}

                  {/* Verdict (legacy content only) */}
                  {parsed && (
                    <div className={`review-verdict ${canManageReview ? 'review-inline-editable-block' : ''}`}
                      role={canManageReview ? 'button' : undefined}
                      tabIndex={canManageReview ? 0 : undefined}
                      onClick={canManageReview ? () => handleOpenSectionEditor(review.id, 'verdict') : undefined}
                      onKeyDown={canManageReview ? (event) => handleEditableKeyDown(event, () => handleOpenSectionEditor(review.id, 'verdict')) : undefined}>
                      <span className="review-verdict-label">{t.pages.verdict}</span>
                      <p className={`review-verdict-text ${parsed.verdict ? '' : 'review-section-empty'}`} dangerouslySetInnerHTML={{ __html: parsed.verdict ? formatEditorialText(parsed.verdict) : escapeHtml(emptyVerdictLabel) }} />
                    </div>
                  )}

                  {/* Footer links */}
                  <div className="review-card-footer">
                    {review.car_id && (
                      <Link to={`/cars/${review.car_id}`} className="btn btn-primary btn-sm">
                        {t.pages.viewCar}
                      </Link>
                    )}
                    {canManageReview && (
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDeleteReview(review.id)}>
                        {t.pages.deleteLabel}
                      </button>
                    )}
                  </div>

                </article>
              )
            })}
          </div>
        </div>
      )}

      {sectionEditor && (
        <div className="review-inline-editor-backdrop" onClick={handleCloseSectionEditor}>
          <div className="review-inline-editor-modal" onClick={(event) => event.stopPropagation()}>
            <h3 className="review-inline-editor-title">{t.pages.editLabel}: {getInlineFieldLabel(sectionEditor.field)}</h3>
            {sectionEditor.field === 'content' || sectionEditor.field === 'overview' || sectionEditor.field === 'verdict' ? (
              <RichTextEditor
                id={`review-inline-editor-${sectionEditor.reviewId}-${sectionEditor.field}`}
                label={getInlineFieldLabel(sectionEditor.field)}
                value={sectionValue}
                onChange={setSectionValue}
                placeholder={t.adminPanel.reviewEditorPlaceholder}
              />
            ) : sectionEditor.field === 'car_model' ? (
              <div>
                <label className="form-label" htmlFor="review-car-model-select">{getInlineFieldLabel(sectionEditor.field)}</label>
                <select
                  id="review-car-model-select"
                  className="form-input"
                  value={sectionValue}
                  onChange={(event) => setSectionValue(event.target.value)}
                >
                  <option value="">{t.pages.selectLabel || 'Select'}</option>
                  {cars.map((car) => (
                    <option key={car.id} value={car.id}>{car.name}</option>
                  ))}
                </select>
              </div>
            ) : sectionEditor.field === 'category' ? (
              <div>
                <label className="form-label" htmlFor="review-category-select">{getInlineFieldLabel(sectionEditor.field)}</label>
                <select
                  id="review-category-select"
                  className="form-input"
                  value={sectionValue}
                  onChange={(event) => setSectionValue(event.target.value)}
                >
                  <option value="test">{t.adminPanel.reviewCategoryTest}</option>
                  <option value="news">{t.adminPanel.reviewCategoryNews}</option>
                  <option value="guide">{t.adminPanel.reviewCategoryGuide}</option>
                  <option value="opinion">{t.adminPanel.reviewCategoryOpinion}</option>
                </select>
              </div>
            ) : sectionEditor.field === 'images' || sectionEditor.field === 'secondImages' ? (
              <div className="review-image-editor">
                <label className="form-label" htmlFor="review-image-input">Zdjęcia</label>
                {sectionEditor.field === 'images' && (
                  <p className="review-slider-limit-note">Maksymalnie 12 zdjęć w pierwszym sliderze</p>
                )}
                <div className="review-image-upload-area">
                  <input
                    id="review-image-input"
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={sectionImageUploading}
                    style={{ display: 'none' }}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => document.getElementById('review-image-input').click()}
                    disabled={sectionImageUploading}
                  >
                    {sectionImageUploading ? t.pages.loading : 'Wybierz zdjęcia'}
                  </button>
                </div>
                {sectionImagePreviews.length > 0 && (
                  <div className="review-image-gallery">
                    <div className="review-gallery-main-container">
                      <div className="review-gallery-main-wrapper">
                        <img
                          src={sectionImagePreviews[0]}
                          alt="Main"
                          className="review-gallery-main"
                        />
                        <button
                          type="button"
                          className="review-image-remove-btn"
                          onClick={() => handleRemoveImage(0)}
                          title="Usuń główne zdjęcie"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                    {sectionImagePreviews.length > 1 && (
                      <div className="review-gallery-thumbs">
                        {sectionImagePreviews.slice(1).map((img, i) => (
                          <div key={i} className="review-gallery-thumb-wrapper">
                            <img
                              src={img}
                              alt={`Thumb ${i + 1}`}
                              className="review-gallery-thumb"
                            />
                            <button
                              type="button"
                              className="review-image-remove-btn-thumb"
                              onClick={() => handleRemoveImage(i + 1)}
                              title="Usuń zdjęcie"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : sectionEditor.field === 'testResults' ? (
              <div className="review-test-results-editor">
                <p className="review-test-results-note">
                  {lang === 'pl' ? 'Nazwy parametrow sa stale. Edytujesz tylko wartosci.' : 'Field names are fixed. Edit values only.'}
                </p>
                <div className="review-test-results-editor-grid">
                  {sectionTestResultsValues.map((item, index) => (
                    <div key={`${item.key}-${index}`} className="review-test-results-editor-row">
                      <label className="review-test-results-editor-key">{getTestLabel(item.key, lang)}</label>
                      <input
                        className="form-input review-test-results-editor-value"
                        value={item.value}
                        onChange={(event) => {
                          const next = [...sectionTestResultsValues]
                          next[index] = { ...next[index], value: event.target.value }
                          setSectionTestResultsValues(next)
                        }}
                        placeholder={lang === 'pl' ? 'Wartosc' : 'Value'}
                      />
                      <span className="review-test-results-editor-unit">{item.unit || '-'}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : sectionEditor.field === 'summary' ? (
              <div>
                <label className="form-label" htmlFor="review-inline-textarea">{getInlineFieldLabel(sectionEditor.field)}</label>
                <textarea
                  id="review-inline-textarea"
                  className="form-input form-textarea"
                  rows={4}
                  value={sectionValue}
                  onChange={(event) => setSectionValue(event.target.value)}
                  placeholder=""
                />
              </div>
            ) : (
              <div>
                <label className="form-label" htmlFor="review-inline-value">{getInlineFieldLabel(sectionEditor.field)}</label>
                <input
                  id="review-inline-value"
                  className="form-input"
                  value={sectionValue}
                  onChange={(event) => setSectionValue(event.target.value)}
                />
              </div>
            )}
            <div className="admin-actions-row">
              <button type="button" className="btn btn-secondary" onClick={handleCloseSectionEditor}>{t.pages.cancelLabel}</button>
              <button type="button" className="btn btn-primary" disabled={reviewSaving} onClick={handleSaveSectionEditor}>{reviewSaving ? t.pages.loading : t.pages.saveLabel}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
